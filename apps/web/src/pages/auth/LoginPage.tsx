import { useCallback, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input, Label } from '@familyhub/ui';
import { supabase } from '../../lib/supabase';
import { AuthLayout } from './AuthLayout';

// LoginPage — split parent / kid auth (FHS-237).
//
// Parent path: passwordless via Supabase magic-link OR Google OAuth
// (unchanged from FHS-224 / ADR 0011). Kid path: shared-device login
// using avatar + 4-digit PIN, talking to POST /api/auth/kid-pin
// (FHS-236). The actual kid form (avatar grid + PIN keypad) ships in
// FHS-238 — for now the kid panel renders a "coming soon" hint so the
// toggle, URL-state, and a11y wiring can be tested in isolation.
//
// URL state: `?role=kid` selects the kid panel on first load, so a
// kid's home-screen icon ("My Family Hub" PWA shortcut) can deep-link
// into their entry point.

type Role = 'parent' | 'kid';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

const loginSchema = z.object({
  email: z.string().email('enter a valid email'),
});

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitting-google' }
  | { kind: 'error'; message: string };

function isKnownRole(value: string | null): value is Role {
  return value === 'parent' || value === 'kid';
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const requested = params.get('role');
  const role: Role = isKnownRole(requested) ? requested : 'parent';

  const onRoleChange = useCallback(
    (next: Role) => {
      const updated = new URLSearchParams(params);
      if (next === 'parent') {
        updated.delete('role');
      } else {
        updated.set('role', next);
      }
      // replace:true so toggling 4× doesn't leave 4 history entries
      // (and the browser back button still exits /login cleanly).
      setParams(updated, { replace: true });
      // Clear any "wrong email" error when toggling — the kid panel
      // doesn't have an email field, and a stale error reads as
      // confusing if it pops back when the user switches back. Don't
      // wipe in-flight submitting states, in case an OAuth redirect
      // is mid-flight from a stray click.
      setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
    },
    [params, setParams],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' });
      return;
    }
    setStatus({ kind: 'submitting' });
    // shouldCreateUser:false makes /login login-only — Supabase rejects
    // unknown emails with a clear "user not found" error rather than
    // silently creating an account, so /login and /signup stay
    // semantically distinct (AC1 from FHS-224).
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
      return;
    }
    // Stash the email so /verify-email can render "Check your inbox at
    // <email>" without us threading state through the navigation.
    sessionStorage.setItem('fh.signup.email', parsed.data.email);
    navigate('/verify-email');
  }

  async function onGoogle() {
    setStatus({ kind: 'submitting-google' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus({ kind: 'error', message: error.message });
    }
    // signInWithOAuth navigates the browser away on success — no
    // post-call handling needed here.
  }

  const submitting = status.kind === 'submitting' || status.kind === 'submitting-google';

  return (
    <AuthLayout title="Log in">
      <RoleToggle role={role} onChange={onRoleChange} />

      {role === 'parent' ? (
        <section
          id="login-parent-panel"
          aria-labelledby="login-parent-heading"
          data-testid="login-parent-panel"
          className="mt-4"
        >
          <h2 id="login-parent-heading" className="sr-only">
            Parent log in
          </h2>
          <p className="mb-4 font-body text-sm text-gray-700">
            We&rsquo;ll email you a one-time link to log in. No password to remember.
          </p>

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
                placeholder="sarah@example.com"
                testId="login-email"
              />
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
              disabled={submitting}
              fullWidth
              testId="login-submit"
            >
              {status.kind === 'submitting' ? 'Sending…' : 'Continue with email →'}
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
            disabled={submitting}
            testId="login-google"
            fullWidth
          >
            <span className="inline-flex items-center justify-center gap-3">
              <GoogleIcon />
              {status.kind === 'submitting-google' ? 'Redirecting…' : 'Continue with Google'}
            </span>
          </Button>

          <p className="mt-6 font-body text-sm text-gray-700">
            New here?{' '}
            <Link to="/signup" className="font-semibold underline">
              Create an account
            </Link>
          </p>
        </section>
      ) : (
        <KidLoginPanel onSwitchToParent={() => onRoleChange('parent')} />
      )}
    </AuthLayout>
  );
}

// Segmented control (not an ARIA tablist) — two mutually-exclusive
// buttons toggling which login form is mounted. Plain group + per-button
// `aria-pressed` avoids the `tablist` arrow-key navigation requirement
// while still being screen-reader-friendly. Tab key cycles through the
// buttons in DOM order, the focus-visible ring stays bright yellow.
function RoleToggle({ role, onChange }: { role: Role; onChange: (next: Role) => void }) {
  return (
    <div
      role="group"
      aria-label="Login role"
      className="flex gap-2 rounded-md border-2 border-black bg-white p-1 shadow-neo-sm"
      data-testid="login-role-toggle"
    >
      <RoleButton id="parent" label="I'm a parent" active={role === 'parent'} onSelect={onChange} />
      <RoleButton id="kid" label="I'm a kid" active={role === 'kid'} onSelect={onChange} />
    </div>
  );
}

function RoleButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: Role;
  label: string;
  active: boolean;
  onSelect: (id: Role) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid={`login-role-${id}`}
      onClick={() => onSelect(id)}
      className={[
        'flex-1 rounded px-3 py-2 text-sm font-bold transition-colors',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400',
        active ? 'bg-yellow-300 text-black' : 'bg-white text-gray-700 hover:bg-gray-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// FHS-237 — placeholder kid login panel. FHS-238 swaps the body of
// this component for the avatar grid + PIN keypad. The surrounding
// heading + intro copy + "switch to parent" footer all still apply
// once the real form lands, so they live here in the wrapper.
function KidLoginPanel({ onSwitchToParent }: { onSwitchToParent: () => void }) {
  return (
    <section
      id="login-kid-panel"
      aria-labelledby="login-kid-heading"
      data-testid="login-kid-panel"
      className="mt-4"
    >
      <h2 id="login-kid-heading" className="sr-only">
        Kid log in
      </h2>
      <p className="mb-4 font-body text-sm text-gray-700">
        Tap your face and type your 4-digit PIN. Ask a grown-up if you forgot it.
      </p>
      <div
        data-testid="login-kid-placeholder"
        className="rounded-md border-2 border-dashed border-black bg-yellow-50 p-6 text-center"
      >
        <p className="font-heading text-lg text-black">Coming soon</p>
        <p className="mt-2 font-body text-sm text-gray-700">
          The avatar picker + PIN keypad lands in FHS-238.
        </p>
      </div>

      <p className="mt-6 font-body text-sm text-gray-700">
        Are you a grown-up?{' '}
        <button
          type="button"
          onClick={onSwitchToParent}
          data-testid="login-kid-back-to-parent"
          className="font-semibold underline"
        >
          Switch to parent log-in
        </button>
        .
      </p>
    </section>
  );
}
