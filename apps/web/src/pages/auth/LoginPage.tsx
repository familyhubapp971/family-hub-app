import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Input, Label } from '@familyhub/ui';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

// Canonical Google "G" logo, inline so no extra dep / network fetch.
// Brand-mark colours per Google's identity guidelines.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

const loginSchema = z.object({
  email: z.string().email('enter a valid email'),
  password: z.string().min(1, 'password required'),
});

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'oauth' }
  | { kind: 'error'; message: string };

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' });
      return;
    }
    setStatus({ kind: 'submitting' });
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    // On success the AuthProvider's onAuthStateChange will flip the
    // session — navigating immediately is fine because the dashboard's
    // protected-route check will already see the session by then.
    navigate('/dashboard', { replace: true });
  }

  async function onGoogle() {
    setStatus({ kind: 'oauth' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
    }
    // On success the browser navigates to Google's consent screen; no
    // local state change needed.
  }

  return (
    <AuthLayout title="Log in">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form" noValidate>
        <div>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            testId="login-email"
          />
        </div>
        <div>
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            testId="login-password"
          />
          <p className="mt-1 text-right font-body text-xs">
            <Link to="/auth/reset-request" className="underline">
              Forgot password?
            </Link>
          </p>
        </div>

        {status.kind === 'error' && (
          <p className="font-body text-sm text-red-600" data-testid="login-error" role="alert">
            {status.message}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={status.kind === 'submitting' || status.kind === 'oauth'}
          testId="login-submit"
        >
          {status.kind === 'submitting' ? 'Signing in…' : 'Log in'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 font-body text-xs uppercase tracking-widest text-gray-500">
        <div className="h-px flex-1 bg-gray-300" />
        or
        <div className="h-px flex-1 bg-gray-300" />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onGoogle}
        disabled={status.kind === 'submitting' || status.kind === 'oauth'}
        testId="login-google"
        className="w-full"
      >
        <span className="inline-flex items-center justify-center gap-3">
          <GoogleIcon />
          {status.kind === 'oauth' ? 'Redirecting…' : 'Continue with Google'}
        </span>
      </Button>

      <p className="mt-6 font-body text-sm text-gray-700">
        New here?{' '}
        <Link to="/signup" className="font-semibold underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
