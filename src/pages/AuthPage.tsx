import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, UserPlus, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { Button } from '../components/common/Button';
import { TextField } from '../components/common/TextField';
import { Alert } from '../components/common/Alert';

export default function AuthPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
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

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {mode === 'signin' ? 'Business Owner Sign In' : 'Create Owner Account'}
        </h1>
        <p className="text-sm text-slate-600">
          {mode === 'signin'
            ? 'Sign in to manage your businesses, QR codes, and customer review drafts.'
            : 'Create an owner account to register your business and generate your review QR code.'}
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
            mode === 'signin'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LogIn className="h-4 w-4" /> Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
            mode === 'signup'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="h-4 w-4" /> Create Account
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
        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5"
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
              <LogIn className="h-4 w-4" /> Sign In to Dashboard
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" /> Create Owner Account
            </>
          )}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>Protected by Supabase Row Level Security — only you can access your businesses.</span>
      </div>
    </div>
  );
}
