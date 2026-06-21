import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input, Label } from '@familyhub/ui';
import { supabase } from '../../lib/supabase';
import { friendlyAuthErrorMessage } from '../../lib/auth-errors';
import { AuthLayout } from './AuthLayout';
import { KidSignIn } from './KidSignIn';

// LoginPage — the Magic Patterns "Welcome Back!" card (FHS-237 / FHS-360).
//
// One card with a Parent/Kid toggle. Parent = passwordless magic-link or
// Google OAuth. Kid = the avatar-tiles + PIN flow (shared KidSignIn): on a
// device that remembers the family the tiles show straight away; otherwise the
// kid types their family code first.
//
// URL state: `?role=kid` selects the kid view on first load (PWA deep-link).

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

  useEffect(() => {
    setStatus((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
  }, [email]);

  const onRoleChange = useCallback(
    (next: Role) => {
      const updated = new URLSearchParams(params);
      if (next === 'parent') updated.delete('role');
      else updated.set('role', next);
      setParams(updated, { replace: true });
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
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      setStatus({ kind: 'error', message: friendlyAuthErrorMessage(error.message) });
      return;
    }
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
      setStatus({ kind: 'error', message: friendlyAuthErrorMessage(error.message) });
    }
  }

  const submitting = status.kind === 'submitting' || status.kind === 'submitting-google';

  return (
    <AuthLayout title="Welcome Back!" subtitle="Sign in to Family Hub" centered>
      <RoleToggle role={role} onChange={onRoleChange} />

      {role === 'parent' ? (
        <section
          id="login-parent-panel"
          aria-labelledby="login-parent-heading"
          data-testid="login-parent-panel"
          className="mt-6"
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
        </section>
      ) : (
        <div className="mt-6">
          <KidLoginPanel />
        </div>
      )}

      {/* MP "Create a new family" footer — single CTA for both views. */}
      <p className="mt-6 text-center font-body text-sm text-gray-700">
        <Link
          to="/signup"
          className="font-semibold text-purple-700 underline decoration-2 underline-offset-2 hover:text-purple-900"
          data-testid="login-create-family"
        >
          Create a new family
        </Link>
      </p>
    </AuthLayout>
  );
}

// MP segmented control — two mutually-exclusive buttons toggling which login
// view is mounted. Plain group + per-button aria-pressed (not an ARIA tablist,
// so no arrow-key nav requirement).
function RoleToggle({ role, onChange }: { role: Role; onChange: (next: Role) => void }) {
  return (
    <div
      role="group"
      aria-label="Login role"
      className="flex gap-2 rounded-xl border-2 border-black bg-gray-100 p-1.5"
      data-testid="login-role-toggle"
    >
      <RoleButton
        id="parent"
        emoji="👩"
        label="I'm a Parent"
        active={role === 'parent'}
        onSelect={onChange}
      />
      <RoleButton
        id="kid"
        emoji="🧒"
        label="I'm a Kid"
        active={role === 'kid'}
        onSelect={onChange}
      />
    </div>
  );
}

function RoleButton({
  id,
  emoji,
  label,
  active,
  onSelect,
}: {
  id: Role;
  emoji: string;
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
        'flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-all',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400',
        active
          ? id === 'kid'
            ? 'border-black bg-yellow-300 text-black shadow-neo-xs'
            : 'border-black bg-white text-black shadow-neo-xs'
          : 'border-transparent text-gray-400 hover:text-gray-600',
      ].join(' ')}
    >
      {/* Emoji is decorative — hidden from screen readers so the button's
          accessible name is just "I'm a Parent" / "I'm a Kid". */}
      <span aria-hidden="true">{emoji}</span> {label}
    </button>
  );
}

// FHS-353 / FHS-360 — self-serve kid login. On a device that remembers the
// family (KidLoginPage stores it on its last successful load), the avatar tiles
// show straight away; otherwise the kid types their family code first. The
// tiles + PIN live in the shared KidSignIn component so this matches the
// /t/:slug/kid-login route.
const KID_LAST_FAMILY_KEY = 'fh.kid.lastFamily';
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function readLastFamily(): { slug: string; name: string } | null {
  try {
    const raw = localStorage.getItem(KID_LAST_FAMILY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { slug?: unknown; name?: unknown };
    if (
      typeof v.slug === 'string' &&
      typeof v.name === 'string' &&
      v.name.length <= 100 &&
      SLUG_RE.test(v.slug)
    ) {
      return { slug: v.slug, name: v.name };
    }
  } catch {
    /* corrupt / unavailable storage — fall back to the code entry */
  }
  return null;
}

function KidLoginPanel() {
  const lastFamily = useMemo(() => readLastFamily(), []);
  const [slug, setSlug] = useState<string | null>(lastFamily?.slug ?? null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changeFamily = (
    <p className="mt-4 text-center font-body text-xs text-gray-600">
      Not your family?{' '}
      <button
        type="button"
        onClick={() => setSlug(null)}
        data-testid="login-kid-change-family"
        className="font-semibold underline"
      >
        Enter a different code
      </button>
      .
    </p>
  );

  // Family known → show the avatar tiles + PIN (MP "Who are you?"). The
  // "change family" link sits below in all states (incl. not-found), so it's
  // NOT also passed as KidSignIn's notFoundFooter (that would double it up).
  if (slug) {
    return (
      <section data-testid="login-kid-panel">
        <KidSignIn slug={slug} />
        {changeFamily}
      </section>
    );
  }

  // No family yet → ask for the family code.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = code.trim().toLowerCase();
    if (!SLUG_RE.test(next)) {
      setError("That doesn't look like a family code. Ask a grown-up if you're not sure.");
      return;
    }
    setSlug(next);
  }

  return (
    <section id="login-kid-panel" aria-labelledby="login-kid-heading" data-testid="login-kid-panel">
      <h2 id="login-kid-heading" className="sr-only">
        Kid log in
      </h2>
      <p className="mb-3 font-body text-sm text-gray-700">
        Type your <span className="font-semibold">family code</span> to see your faces.
      </p>

      <form onSubmit={onSubmit} className="space-y-3" data-testid="login-kid-form" noValidate>
        <div>
          <Label htmlFor="kid-family-code" required>
            Family code
          </Label>
          <Input
            id="kid-family-code"
            name="kid-family-code"
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="your-family"
            testId="login-kid-code"
          />
          <p className="mt-1 font-body text-xs text-gray-600">
            It&rsquo;s the short name in your family&rsquo;s web address.
          </p>
        </div>

        {error && (
          <p className="font-body text-sm text-red-600" data-testid="login-kid-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="md" fullWidth testId="login-kid-go">
          Let&rsquo;s go →
        </Button>
      </form>
    </section>
  );
}
