import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { apiFetch } from '../lib/api';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { ReferenceDb, ThemeMode, UserPreference, UserProfile } from '../types';

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  institution?: string;
  researchInterest?: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  preferences: UserPreference | null;
  isAdmin: boolean;
  loading: boolean;
  theme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  registerWithEmail: (input: RegisterInput) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ isAdmin: boolean }>;
  loginWithGoogle: () => Promise<{ isAdmin: boolean }>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendResetEmail: (email: string) => Promise<void>;
  updateUserProfileFields: (fields: Partial<Pick<UserProfile, 'fullName' | 'institution' | 'researchInterest' | 'photoUrl'>>) => Promise<void>;
  updatePreferences: (fields: Partial<Pick<UserPreference, 'theme' | 'emailNotifications' | 'analysisAlerts' | 'defaultReferenceDb'>>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function applyHtmlTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreference | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = (localStorage.getItem('edna_theme') as ThemeMode | null) || 'light';
    const resolved = resolveTheme(stored);
    applyHtmlTheme(resolved);
    return resolved;
  });

  const syncUserDocuments = useCallback(async (user: User, extra?: { fullName?: string; institution?: string; researchInterest?: string }) => {
    const userRef = doc(db, 'users', user.uid);
    const prefRef = doc(db, 'userPreferences', user.uid);

    let loadedProfile: UserProfile | null = null;
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const baseProfile = {
          uid: user.uid,
          fullName: (extra?.fullName || user.displayName || user.email?.split('@')[0] || 'Researcher').slice(0, 120),
          email: (user.email || '').slice(0, 254),
          institution: (extra?.institution || '').slice(0, 200),
          researchInterest: (extra?.researchInterest || '').slice(0, 300),
          role: 'user' as const,
          accountStatus: 'active' as const,
          emailVerified: Boolean(user.emailVerified),
          photoUrl: (user.photoURL || '').slice(0, 500),
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        };
        await setDoc(userRef, baseProfile);
        loadedProfile = { ...baseProfile, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() };
      } else {
        const existing = snap.data() as UserProfile;
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
          emailVerified: Boolean(user.emailVerified),
        });
        loadedProfile = { ...existing, emailVerified: Boolean(user.emailVerified) };
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }

    let loadedPref: UserPreference | null = null;
    try {
      const prefSnap = await getDoc(prefRef);
      if (!prefSnap.exists()) {
        const defaultPref = {
          uid: user.uid,
          theme: ((localStorage.getItem('edna_theme') as ThemeMode) || 'light') as ThemeMode,
          emailNotifications: true,
          analysisAlerts: true,
          defaultReferenceDb: 'NCBI_NT' as ReferenceDb,
          updatedAt: serverTimestamp(),
        };
        await setDoc(prefRef, defaultPref);
        loadedPref = { ...defaultPref, updatedAt: new Date().toISOString() };
      } else {
        loadedPref = prefSnap.data() as UserPreference;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `userPreferences/${user.uid}`);
    }

    // Verify server-side admin privileges (never trust client-side role field alone)
    let serverIsAdmin = false;
    try {
      const session = await apiFetch<{ isAdmin: boolean }>('/api/auth/session');
      serverIsAdmin = Boolean(session.isAdmin);
    } catch {
      serverIsAdmin = false;
    }

    setProfile(loadedProfile);
    setPreferences(loadedPref);
    setIsAdmin(serverIsAdmin);

    if (loadedPref?.theme) {
      const resolved = resolveTheme(loadedPref.theme);
      setTheme(resolved);
      applyHtmlTheme(resolved);
      localStorage.setItem('edna_theme', loadedPref.theme);
    }

    return { profile: loadedProfile, isAdmin: serverIsAdmin };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setPreferences(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        await syncUserDocuments(user);
      } catch (err) {
        console.error('Failed to sync user documents:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [syncUserDocuments]);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      const resolved = resolveTheme(mode);
      setTheme(resolved);
      applyHtmlTheme(resolved);
      localStorage.setItem('edna_theme', mode);
      if (firebaseUser) {
        try {
          await updateDoc(doc(db, 'userPreferences', firebaseUser.uid), {
            theme: mode,
            updatedAt: serverTimestamp(),
          });
          setPreferences((prev) => (prev ? { ...prev, theme: mode } : prev));
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `userPreferences/${firebaseUser.uid}`);
        }
      }
    },
    [firebaseUser]
  );

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    await setThemeMode(next);
  }, [setThemeMode, theme]);

  const registerWithEmail = useCallback(
    async (input: RegisterInput) => {
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      await updateProfile(cred.user, { displayName: input.fullName.trim() });
      await sendEmailVerification(cred.user);
      await syncUserDocuments(cred.user, {
        fullName: input.fullName.trim(),
        institution: input.institution?.trim() || '',
        researchInterest: input.researchInterest?.trim() || '',
      });
    },
    [syncUserDocuments]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const { profile: syncedProfile, isAdmin: adminFlag } = await syncUserDocuments(cred.user);
      if (syncedProfile?.accountStatus === 'suspended') {
        await signOut(auth);
        throw new Error('This account has been suspended by an administrator. Contact support for assistance.');
      }
      return { isAdmin: adminFlag };
    },
    [syncUserDocuments]
  );

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const { profile: syncedProfile, isAdmin: adminFlag } = await syncUserDocuments(cred.user);
    if (syncedProfile?.accountStatus === 'suspended') {
      await signOut(auth);
      throw new Error('This account has been suspended by an administrator. Contact support for assistance.');
    }
    return { isAdmin: adminFlag };
  }, [syncUserDocuments]);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshVerificationStatus = useCallback(async () => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      await syncUserDocuments(auth.currentUser);
      return true;
    }
    return false;
  }, [syncUserDocuments]);

  const sendResetEmail = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const updateUserProfileFields = useCallback(
    async (fields: Partial<Pick<UserProfile, 'fullName' | 'institution' | 'researchInterest' | 'photoUrl'>>) => {
      if (!firebaseUser) throw new Error('Not authenticated.');
      const sanitized: Record<string, unknown> = { lastLogin: serverTimestamp() };
      if (fields.fullName !== undefined) sanitized.fullName = fields.fullName.trim().slice(0, 120);
      if (fields.institution !== undefined) sanitized.institution = fields.institution.trim().slice(0, 200);
      if (fields.researchInterest !== undefined) sanitized.researchInterest = fields.researchInterest.trim().slice(0, 300);
      if (fields.photoUrl !== undefined) sanitized.photoUrl = fields.photoUrl.trim().slice(0, 500);

      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), sanitized);
        if (fields.fullName) {
          await updateProfile(firebaseUser, { displayName: fields.fullName.trim().slice(0, 120) });
        }
        setProfile((prev) => (prev ? { ...prev, ...fields } : prev));
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
    },
    [firebaseUser]
  );

  const updatePreferences = useCallback(
    async (fields: Partial<Pick<UserPreference, 'theme' | 'emailNotifications' | 'analysisAlerts' | 'defaultReferenceDb'>>) => {
      if (!firebaseUser) throw new Error('Not authenticated.');
      try {
        await updateDoc(doc(db, 'userPreferences', firebaseUser.uid), {
          ...fields,
          updatedAt: serverTimestamp(),
        });
        setPreferences((prev) => (prev ? { ...prev, ...fields } : prev));
        if (fields.theme) {
          const resolved = resolveTheme(fields.theme);
          setTheme(resolved);
          applyHtmlTheme(resolved);
          localStorage.setItem('edna_theme', fields.theme);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `userPreferences/${firebaseUser.uid}`);
      }
    },
    [firebaseUser]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setPreferences(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        preferences,
        isAdmin,
        loading,
        theme,
        setThemeMode,
        toggleTheme,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        resendVerificationEmail,
        refreshVerificationStatus,
        sendResetEmail,
        updateUserProfileFields,
        updatePreferences,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
