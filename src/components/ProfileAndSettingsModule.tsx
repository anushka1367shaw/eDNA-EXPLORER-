import React, { useState } from 'react';
import { Camera, CheckCircle2, Copy, Database, KeyRound, Loader2, LogOut, Save } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { storage } from '../lib/firebase';
import type { BackendStatus, ReferenceDb, ThemeMode } from '../types';

export function ProfileModule() {
  const { firebaseUser, profile, updateUserProfileFields, logout } = useAuth();
  const { notify } = useToast();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [institution, setInstitution] = useState(profile?.institution || '');
  const [researchInterest, setResearchInterest] = useState(profile?.researchInterest || '');
  const [saving, setSaving] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      await updateUserProfileFields({ fullName, institution, researchInterest });
      notify('Profile updated', 'Your researcher profile details have been saved.', 'success');
    } catch (err) {
      notify('Update failed', err instanceof Error ? err.message : 'Unable to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('File too large', 'Profile avatar must be under 2 MB.', 'error');
      return;
    }
    setUploadingAvatar(true);
    try {
      const storageRef = ref(storage, `users/${firebaseUser.uid}/profile/avatar_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateUserProfileFields({ photoUrl: url });
      notify('Avatar updated', 'Profile photo saved to Firebase Storage.', 'success');
    } catch (err) {
      notify(
        'Avatar upload unavailable',
        err instanceof Error ? err.message : 'Ensure Firebase Storage is enabled in your Firebase Console.',
        'warning'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;
    if (newPassword.length < 8) {
      notify('Weak password', 'New password must be at least 8 characters.', 'error');
      return;
    }
    setChangingPw(true);
    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated', 'Your Firebase Authentication password has been changed.', 'success');
    } catch (err) {
      notify(
        'Password update failed',
        err instanceof Error ? err.message : 'Verify your current password and try again.',
        'error'
      );
    } finally {
      setChangingPw(false);
    }
  };

  const isPasswordUser = firebaseUser?.providerData.some((p) => p.providerId === 'password');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-[#E7EFEA] dark:border-[#143A2F]">
          <div className="relative w-16 h-16 rounded-full bg-[#087A50] text-white text-xl font-bold flex items-center justify-center overflow-hidden shrink-0">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.fullName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              (profile?.fullName?.[0] || 'R').toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[#063B2B] dark:text-white truncate">
              {profile?.fullName}
            </h3>
            <p className="text-xs font-mono text-[#4B6F61] dark:text-[#8FB7A6] truncate">
              {profile?.email} · Account Role: {profile?.role || 'user'} · Status: {profile?.accountStatus || 'active'}
            </p>
            <label className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#087A50] dark:text-[#55D6C2] cursor-pointer hover:underline">
              <Camera className="w-3.5 h-3.5" />
              {uploadingAvatar ? 'Uploading...' : 'Upload Profile Image (Firebase Storage)'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                Institution / College
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Research Interests
            </label>
            <input
              type="text"
              value={researchInterest}
              onChange={(e) => setResearchInterest(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-mono text-[#4B6F61] dark:text-[#8FB7A6]">
              UID: {firebaseUser?.uid}
            </span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087A50] text-white text-xs font-medium hover:bg-[#063B2B] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>

      {isPasswordUser && (
        <form
          onSubmit={handleChangePassword}
          className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-4"
        >
          <h4 className="text-sm font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#087A50]" />
            Change Password
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current Password"
              className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password (min 8 chars)"
              className="px-3.5 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={changingPw}
            className="px-4 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-xs font-medium hover:border-[#087A50]"
          >
            {changingPw ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#063B2B] dark:text-white">Session Control</p>
          <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Sign out securely from this browser session.</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function SettingsModule({ backendStatus }: { backendStatus: BackendStatus | null }) {
  const { preferences, updatePreferences } = useAuth();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async (
    patch: Partial<{
      theme: ThemeMode;
      emailNotifications: boolean;
      analysisAlerts: boolean;
      defaultReferenceDb: ReferenceDb;
    }>
  ) => {
    setSaving(true);
    try {
      await updatePreferences(patch);
      notify('Preferences saved', 'Application settings updated.', 'success');
    } catch (err) {
      notify('Save failed', err instanceof Error ? err.message : 'Unable to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (txt: string, label: string) => {
    await navigator.clipboard.writeText(txt);
    notify('Copied', `${label} copied to clipboard.`, 'info');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-5">
        <h3 className="text-base font-semibold text-[#063B2B] dark:text-white">
          Workspace &amp; Notification Preferences
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Color Theme
            </label>
            <select
              disabled={saving}
              value={preferences?.theme || 'light'}
              onChange={(e) => void handleSave({ theme: e.target.value as ThemeMode })}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              <option value="light">Light Mode (#F4F8F5)</option>
              <option value="dark">Dark Mode (#071D17)</option>
              <option value="system">System Preference</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
              Default Taxonomic Reference Database
            </label>
            <select
              disabled={saving}
              value={preferences?.defaultReferenceDb || 'NCBI_NT'}
              onChange={(e) => void handleSave({ defaultReferenceDb: e.target.value as ReferenceDb })}
              className="w-full px-3 py-2 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm"
            >
              <option value="NCBI_NT">NCBI BLAST / Taxonomy (nt)</option>
              <option value="BOLD">BOLD Systems (COI Barcode)</option>
              <option value="SILVA">SILVA rRNA Reference</option>
            </select>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 text-xs text-[#2E5547] dark:text-[#B9D8CA]">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences?.emailNotifications ?? true}
              onChange={(e) => void handleSave({ emailNotifications: e.target.checked })}
            />
            <span>Receive email notifications for report exports and project milestones</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences?.analysisAlerts ?? true}
              onChange={(e) => void handleSave({ analysisAlerts: e.target.checked })}
            />
            <span>Show in-app alerts when taxonomic identification jobs complete</span>
          </label>
        </div>
      </div>

      {/* Supabase & External Integration Configuration Screen */}
      <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#063B2B] dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-[#087A50] dark:text-[#55D6C2]" />
              Scientific Database Architecture (Supabase + Firebase)
            </h3>
            <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6] mt-0.5">
              Firebase manages authentication &amp; user application state; Supabase PostgreSQL &amp; Storage manage large scientific datasets.
            </p>
          </div>
          <span className="font-mono text-xs inline-flex items-center gap-1.5 text-[#087A50] dark:text-[#55D6C2]">
            <CheckCircle2 className="w-4 h-4" />
            {backendStatus?.supabaseConfigured ? 'Supabase Connected' : 'Local Research Sandbox'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-2">
          <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
            <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Firebase Project</span>
            <span>{backendStatus?.firebaseProjectId || 'Configured'}</span>
          </div>
          <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
            <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Dataset Storage</span>
            <span>{backendStatus?.supabaseConfigured ? 'Supabase PostgreSQL + S3' : 'Server Sandbox (data/)'}</span>
          </div>
          <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] p-3">
            <span className="text-[#4B6F61] dark:text-[#8FB7A6] block">Gemini Scientific AI</span>
            <span>{backendStatus?.geminiConfigured ? 'Connected (Server-Side)' : 'Needs GEMINI_API_KEY'}</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#D8E5DD] dark:border-[#143A2F] bg-[#F4F8F5] dark:bg-[#071D17] p-4 text-xs space-y-2">
          <p className="font-semibold text-[#063B2B] dark:text-white">
            Connecting Production Supabase PostgreSQL &amp; Storage:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[#355E4F] dark:text-[#B9D8CA]">
            <li>
              Execute <code className="font-mono">supabase/schema.sql</code> and{' '}
              <code className="font-mono">supabase/rls_policies.sql</code> in your Supabase SQL Editor.
            </li>
            <li>
              Set <code className="font-mono">SUPABASE_URL</code> and{' '}
              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in your server environment / Secrets panel (never expose service-role keys to the browser).
            </li>
            <li>
              Optional: Deploy <code className="font-mono">supabase/edge-functions/process-edna/index.ts</code> via Supabase CLI.
            </li>
          </ol>
          <button
            type="button"
            onClick={() => void copyText('SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=', 'Supabase env template')}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#0B271F] font-mono text-[11px]"
          >
            <Copy className="w-3 h-3" />
            Copy Env Var Keys
          </button>
        </div>
      </div>
    </div>
  );
}
