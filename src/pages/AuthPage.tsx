import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, UserPlus, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { Button } from '../components/common/Button';
import { TextField } from '../components/common/TextField';
import { Alert } from '../components/common/Alert';

export default function AuthPage() {
  const { user, loading: authLoading, signIn, signInWithGoogle, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!authLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.trim();
    if (mode === 'signup') {
      const digits = cleanPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        setError('Please enter a valid phone or WhatsApp number.');
        return;
      }
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error: signInErr } = await signIn(cleanEmail, password);
        if (signInErr) {
          setError(signInErr);
          return;
        }
        navigate(redirectTo, { replace: true });
      } else {
        const { error: signUpErr, needsEmailConfirmation } = await signUp(
          cleanEmail,
          password,
          cleanPhone,
        );
        if (signUpErr) {
          setError(signUpErr);
          return;
        }
        if (needsEmailConfirmation) {
          setInfoMessage(
            'Account created! Please check your email inbox to confirm your address, then sign in below.',
          );
          setMode('signin');
        } else {
          navigate('/setup', { replace: true });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const { error: googleErr } = await signInWithGoogle(redirectTo);
      if (googleErr) {
        setError(googleErr);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]">
          <KeyRound className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[28px]">
          {mode === 'signin' ? 'Business Owner Sign In' : 'Create Owner Account'}
        </h1>
        <p className="text-[14px] text-[#626B65]">
          {mode === 'signin'
            ? 'Sign in to manage your businesses, QR codes, and customer review drafts.'
            : 'Create an owner account to register your business and generate your review QR code.'}
        </p>
      </div>

      {/* Mode Switcher */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="grid grid-cols-2 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-1 text-[14px] font-medium"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
            mode === 'signin'
              ? 'bg-[#244B40] text-[#FFFFFF] font-semibold'
              : 'text-[#626B65] hover:text-[#252B29]'
          }`}
        >
          <LogIn className="h-4 w-4" aria-hidden /> Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
            mode === 'signup'
              ? 'bg-[#244B40] text-[#FFFFFF] font-semibold'
              : 'text-[#626B65] hover:text-[#252B29]'
          }`}
        >
          <UserPlus className="h-4 w-4" aria-hidden /> Create Account
        </button>
      </div>

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {infoMessage && (
        <Alert tone="info">
          <p>{infoMessage}</p>
        </Alert>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs space-y-5"
      >
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="owner@yourbusiness.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {mode === 'signup' && (
          <TextField
            label="Phone / WhatsApp Number"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        )}

        <TextField
          label="Password"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" loading={submitting} className="w-full">
          {mode === 'signin' ? (
            <>
              <LogIn className="h-4 w-4" aria-hidden /> Sign In to Dashboard
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" aria-hidden /> Create Owner Account
            </>
          )}
        </Button>

        <div className="relative flex items-center py-1">
          <div className="grow border-t border-[#DDE4DC]" />
          <span className="mx-3 shrink text-[12px] font-medium uppercase tracking-wider text-[#626B65]">
            or
          </span>
          <div className="grow border-t border-[#DDE4DC]" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleGoogleSignIn()}
          className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-4 py-2 text-[14px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] cursor-pointer disabled:opacity-60"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="flex items-center justify-center gap-2 text-[13px] text-[#626B65]">
        <ShieldCheck className="h-4 w-4 text-[#244B40] shrink-0" aria-hidden />
        <span>Your account and business data are private and protected.</span>
      </div>
    </div>
  );
}
