import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { AuthLayout } from './AuthLayout';

// Slug syntax — must mirror the canonical regex in
// `apps/api/src/middleware/resolve-tenant.ts` (SLUG_RE) and the
// tenants table constraint. TODO(FHS-205): move to
// packages/shared/src/schemas/slug.ts so frontend + backend share one
// definition.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

interface SignupIntent {
  familyName: string;
  displayName: string;
  slug: string;
}

// Guard: a Google-path intent may have empty displayName. The email
// path has it set. We backfill from Google profile if missing.
function parseIntent(raw: string | null): Partial<SignupIntent> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<SignupIntent>;
    if (typeof obj.slug === 'string' && SLUG_RE.test(obj.slug)) return obj;
  } catch {
    // fall through
  }
  return null;
}

// FHS-259 — pull display name from Google's user_metadata when the
// signup form didn't capture one (Option B: only require family
// name on the Google path). Falls back to email local-part as a last
// resort so the tenant create never lands without a displayName.
function pickDisplayName(
  intent: Partial<SignupIntent> | null,
  user: {
    user_metadata?: { full_name?: string; name?: string };
    email?: string;
  },
): string {
  const fromIntent = intent?.displayName?.trim();
  if (fromIntent && fromIntent.length >= 2) return fromIntent;
  const meta = user.user_metadata ?? {};
  const fromGoogle = (meta.full_name ?? meta.name ?? '').trim();
  if (fromGoogle.length >= 2) return fromGoogle;
  // Last resort: email local-part. Capitalise so it doesn't look broken.
  const local = (user.email ?? '').split('@')[0] ?? '';
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return 'You';
}

type CallbackStatus =
  | { kind: 'idle' }
  | { kind: 'creating-tenant' }
  | { kind: 'error'; message: string };

// FHS-259 — OAuth + magic-link landing page. Supabase's JS client
// (with detectSessionInUrl) pulls the session out of the URL hash on
// import. Once the AuthProvider flips loading → session:
//
//   1. If `fh.signup.intent` is stashed, POST to `/api/public/tenant`
//      with familyName + displayName (intent || Google profile ||
//      email-local-part) + slug. This is the actual tenant-create
//      call that was missing before FHS-259.
//   2. On 200 — redirect to /t/<slug>/onboarding (the wizard's own
//      gate bounces returning users to /dashboard).
//   3. On 409 — slug got taken by someone else mid-flight; show an
//      error and route to /signup so the user can pick another.
//   4. With no intent — legacy /dashboard fallback (login flow).
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, session } = useAuth();
  const [status, setStatus] = useState<CallbackStatus>({ kind: 'idle' });

  useEffect(() => {
    if (loading) return;
    if (!session) {
      // No session means OAuth failed or was cancelled. Bounce to login
      // so the user can retry instead of being stuck on a blank screen.
      navigate('/login', { replace: true });
      return;
    }

    const intent = parseIntent(sessionStorage.getItem('fh.signup.intent'));

    // No signup intent → existing user logging in; legacy fallback.
    if (!intent || !intent.slug) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Already creating tenant (re-render under the same effect run) —
    // bail to avoid a double-POST.
    if (status.kind === 'creating-tenant') return;

    // FHS-259 — actually wire the tenant-create call. Until this
    // landed, the intent was stashed but never POSTed; users completed
    // auth but had no tenant.
    setStatus({ kind: 'creating-tenant' });
    const u = session as {
      user?: { user_metadata?: { full_name?: string; name?: string }; email?: string };
      access_token?: string;
    };
    const user = u.user ?? {};
    const accessToken = u.access_token;
    const body = {
      familyName: (intent.familyName ?? '').trim(),
      displayName: pickDisplayName(intent, user),
      slug: intent.slug,
    };

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/tenant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken ?? ''}`,
          },
          body: JSON.stringify(body),
        });
        if (cancelled) return;
        if (res.status === 200 || res.status === 201) {
          sessionStorage.removeItem('fh.signup.intent');
          navigate(`/t/${intent.slug}/onboarding`, { replace: true });
          return;
        }
        if (res.status === 409) {
          // Slug taken by someone else mid-OAuth. Send the user back
          // to /signup so they can pick another. Keep the family-name
          // value in sessionStorage so the form can re-hydrate it
          // later (out of scope for this PR).
          setStatus({
            kind: 'error',
            message: 'That family URL was just taken — pick another and try again.',
          });
          navigate('/signup', { replace: true });
          return;
        }
        setStatus({
          kind: 'error',
          message: `Couldn't finish creating your family (server returned ${res.status}). Please try again or contact support.`,
        });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error — try again.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, navigate]);

  return (
    <AuthLayout title="Signing you in…">
      {status.kind === 'error' ? (
        <p
          className="font-body text-sm text-red-600"
          role="alert"
          data-testid="auth-callback-error"
        >
          {status.message}
        </p>
      ) : (
        <p className="font-body text-sm text-gray-700" data-testid="auth-callback">
          Hold tight — finishing up your login.
        </p>
      )}
    </AuthLayout>
  );
}
