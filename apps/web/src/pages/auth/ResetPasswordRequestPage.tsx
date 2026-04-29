import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Input, Label } from '@familyhub/ui';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

const resetSchema = z.object({
  email: z.string().email('enter a valid email'),
});

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' });
      return;
    }
    setStatus({ kind: 'submitting' });
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/reset`,
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
        <p className="font-body text-sm text-gray-700" data-testid="reset-success">
          If an account exists for <strong>{email}</strong> we sent a password reset link. Open it
          on this device to choose a new password.
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
    <AuthLayout title="Reset password">
      <form onSubmit={onSubmit} className="space-y-4" data-testid="reset-form" noValidate>
        <p className="font-body text-sm text-gray-700">
          Enter the email on your account and we&apos;ll send you a reset link.
        </p>
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
            testId="reset-email"
          />
        </div>

        {status.kind === 'error' && (
          <p className="font-body text-sm text-red-600" data-testid="reset-error" role="alert">
            {status.message}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={status.kind === 'submitting'}
          testId="reset-submit"
        >
          {status.kind === 'submitting' ? 'Sending…' : 'Send reset link'}
        </Button>

        <p className="font-body text-sm text-gray-700">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold underline">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
