import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Input, Label } from '@familyhub/ui';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

// Client-side schema mirrors the server contract but is intentionally
// lax (8-char min) — Supabase enforces its own password policy server
// side. Surfacing both is fine; the server is the source of truth.
const signupSchema = z.object({
  email: z.string().email('enter a valid email'),
  password: z.string().min(8, 'at least 8 characters'),
});

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password });
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' });
      return;
    }
    setStatus({ kind: 'submitting' });
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    setStatus({ kind: 'success' });
  }

  if (status.kind === 'success') {
    return (
      <AuthLayout title="Check your inbox">
        <p className="font-body text-sm text-gray-700" data-testid="signup-success">
          We sent a confirmation email to <strong>{email}</strong>. Click the link in that message
          to finish creating your account.
        </p>
        <p className="mt-4 font-body text-sm">
          <Link to="/login" className="font-semibold underline">
            Back to login
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="signup-form" noValidate>
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
            testId="signup-email"
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            testId="signup-password"
          />
        </div>

        {status.kind === 'error' && (
          <p className="font-body text-sm text-red-600" data-testid="signup-error" role="alert">
            {status.message}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={status.kind === 'submitting'}
          testId="signup-submit"
        >
          {status.kind === 'submitting' ? 'Creating…' : 'Sign up'}
        </Button>

        <p className="font-body text-sm text-gray-700">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
