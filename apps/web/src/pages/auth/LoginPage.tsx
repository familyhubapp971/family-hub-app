import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Input, Label } from '@familyhub/ui';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

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
        {status.kind === 'oauth' ? 'Redirecting…' : 'Continue with Google'}
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
