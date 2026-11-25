import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LogoMark } from './LogoMark';

interface AuthPagesProps {
  mode: 'login' | 'register';
  onNavigate: (route: string) => void;
}

function mapFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return 'Invalid email address or password. Please verify your credentials.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password is too weak. Use at least 8 characters including letters and numbers.';
  }
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in your Firebase Console (Authentication > Sign-in method). You can enable it there or use Google Sign-In immediately.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing authentication.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Too many authentication attempts. Please wait a few minutes before trying again.';
  }
  return msg;
}

export function AuthPages({ mode, onNavigate }: AuthPagesProps) {
  const { loginWithEmail, loginWithGoogle, registerWithEmail, sendResetEmail } = useAuth();
  const { notify } = useToast();

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration-only fields
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [researchInterest, setResearchInterest] = useState('');

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateRegister = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      return 'Please enter your full name (at least 2 characters).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Password must be at least 8 characters and contain both letters and numbers.';
    }
    if (password !== confirmPassword) {
      return 'Password and Confirm Password do not match.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (forgotMode) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrorMessage('Enter a valid email address to receive a password reset link.');
        return;
      }
      setSubmitting(true);
      try {
        await sendResetEmail(email);
        setResetSent(true);
        notify('Password reset sent', 'Check your inbox for password recovery instructions.', 'success');
      } catch (err) {
        setErrorMessage(mapFirebaseAuthError(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'register') {
      const validationErr = validateRegister();
      if (validationErr) {
        setErrorMessage(validationErr);
        return;
      }
      setSubmitting(true);
      try {
        await registerWithEmail({
          fullName,
          email,
          password,
          institution,
          researchInterest,
        });
        notify('Account created', 'Please verify your email address to access the dashboard.', 'success');
        onNavigate('/dashboard');
      } catch (err) {
        setErrorMessage(mapFirebaseAuthError(err));
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!email.trim() || !password) {
        setErrorMessage('Please enter both email address and password.');
        return;
      }
      setSubmitting(true);
      try {
        const { isAdmin } = await loginWithEmail(email, password);
        notify('Signed in', 'Welcome back to eDNA Explorer.', 'success');
        onNavigate(isAdmin ? '/secure-admin' : '/dashboard');
      } catch (err) {
        setErrorMessage(mapFirebaseAuthError(err));
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const { isAdmin } = await loginWithGoogle();
      notify('Signed in with Google', 'Welcome to eDNA Explorer.', 'success');
      onNavigate(isAdmin ? '/secure-admin' : '/dashboard');
    } catch (err) {
      setErrorMessage(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[#F4F8F5] dark:bg-[#071D17] px-4 py-12">
      <div className="max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-[#2E5547] dark:text-[#8FB7A6] hover:text-[#087A50] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to eDNA Explorer
        </button>

        <div className="rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <LogoMark size={34} />
            <div>
              <h1 className="text-xl font-bold text-[#063B2B] dark:text-white">
                {forgotMode
                  ? 'Reset Password'
                  : mode === 'register'
                  ? 'Create Researcher Account'
                  : 'Sign In to eDNA Explorer'}
              </h1>
              <p className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">Discover · Identify · Conserve</p>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resetSent && forgotMode && (
            <div className="mb-5 rounded-lg border border-[#087A50]/30 bg-[#E6F4EC] dark:bg-[#11382C] p-3 text-xs text-[#063B2B] dark:text-[#9BE564] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Password reset email dispatched. Check your inbox and return here to sign in.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && !forgotMode && (
              <div>
                <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Maya Lin"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm text-[#063B2B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#087A50]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@university.edu"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm text-[#063B2B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#087A50]"
              />
            </div>

            {!forgotMode && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA]">
                    Password *
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(true);
                        setErrorMessage(null);
                      }}
                      className="text-xs text-[#087A50] dark:text-[#55D6C2] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 chars (letters + numbers)"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm text-[#063B2B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#087A50]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && !forgotMode && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm text-[#063B2B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#087A50]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                    Institution / College (optional)
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Department of Ecology & Conservation"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm text-[#063B2B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#087A50]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1E4D3D] dark:text-[#B9D8CA] mb-1.5">
                    Research Interest (optional)
                  </label>
                  <input
                    type="text"
                    value={researchInterest}
                    onChange={(e) => setResearchInterest(e.target.value)}
                    placeholder="Freshwater salmonid & amphibian monitoring"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm text-[#063B2B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#087A50]"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {forgotMode
                ? 'Send Password Reset Email'
                : mode === 'register'
                ? 'Create Account'
                : 'Sign In'}
            </button>
          </form>

          {forgotMode ? (
            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setResetSent(false);
                setErrorMessage(null);
              }}
              className="mt-4 w-full text-center text-xs text-[#087A50] dark:text-[#55D6C2] hover:underline"
            >
              Return to Sign In
            </button>
          ) : (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#D8E5DD] dark:bg-[#143A2F]" />
                <span className="text-xs text-[#4B6F61] dark:text-[#8FB7A6]">or</span>
                <div className="h-px flex-1 bg-[#D8E5DD] dark:bg-[#143A2F]" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] bg-white dark:bg-[#071D17] text-sm font-medium text-[#063B2B] dark:text-white hover:bg-[#F4F8F5] dark:hover:bg-[#113329] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="mt-6 text-center text-xs text-[#4B6F61] dark:text-[#8FB7A6]">
                {mode === 'register' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('/login')}
                      className="font-medium text-[#087A50] dark:text-[#55D6C2] hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    New to eDNA Explorer?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('/register')}
                      className="font-medium text-[#087A50] dark:text-[#55D6C2] hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function VerifyEmailScreen() {
  const { firebaseUser, resendVerificationEmail, refreshVerificationStatus, logout } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  const handleResend = async () => {
    setBusy(true);
    try {
      await resendVerificationEmail();
      notify('Verification email sent', 'Check your inbox and click the verification link.', 'success');
    } catch (err) {
      notify('Unable to resend', err instanceof Error ? err.message : 'Try again shortly.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCheck = async () => {
    setBusy(true);
    try {
      const verified = await refreshVerificationStatus();
      if (verified) {
        notify('Email verified', 'Welcome to your eDNA Explorer research workspace.', 'success');
      } else {
        notify('Not verified yet', 'Click the link in your verification email, then refresh again.', 'warning');
      }
    } catch (err) {
      notify('Check failed', err instanceof Error ? err.message : 'Unable to refresh.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F8F5] dark:bg-[#071D17] p-4">
      <div className="max-w-md w-full rounded-xl border border-[#D8E5DD] dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-[#E6F4EC] dark:bg-[#11382C] text-[#087A50] dark:text-[#55D6C2] mx-auto flex items-center justify-center">
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-[#063B2B] dark:text-white">Verify Your Email Address</h2>
        <p className="mt-2 text-sm text-[#355E4F] dark:text-[#B9D8CA] leading-relaxed">
          We sent a verification link to <span className="font-medium text-[#063B2B] dark:text-white">{firebaseUser?.email}</span>. Verify your email before uploading datasets or running analyses.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleCheck}
            className="w-full py-2.5 px-4 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            I&apos;ve Verified — Continue to Dashboard
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleResend}
            className="w-full py-2.5 px-4 rounded-lg border border-[#C5D8CD] dark:border-[#1D4D3E] text-sm font-medium text-[#063B2B] dark:text-white hover:bg-[#F4F8F5] dark:hover:bg-[#113329]"
          >
            Resend Verification Email
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full py-2 text-xs text-[#4B6F61] dark:text-[#8FB7A6] hover:underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
