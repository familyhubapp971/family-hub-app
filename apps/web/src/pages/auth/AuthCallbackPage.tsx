import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
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
  // Email local-part as the practical floor — Supabase guarantees
  // user.email is set on confirmed sessions so this is what real
  // signups land on when the form left displayName blank AND Google
  // didn't send a profile name (e.g. magic-link signup with empty
  // form). Capitalise so it doesn't look broken.
  const local = (user.email ?? '').split('@')[0] ?? '';
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  // Truly degenerate — no email on the session. Should be impossible
  // post-Supabase-auth; kept as a safety net so the API never sees an
  // empty string (which would 400 the schema validator).
  return 'You';
}

type CallbackStatus =
  | { kind: 'idle' }
  | { kind: 'creating-tenant' }
  | { kind: 'error'; message: string };

// Cast helpers — Supabase Session has access_token: string + user: User
// non-optional, but we keep the local view narrow so we don't depend on
// the wider User shape (only .email + .user_metadata are read).
type CallbackSession = Pick<Session, 'access_token'> & {
  user: {
    email?: string;
    user_metadata?: { full_name?: string; name?: string };
  };
};

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
  // qa-expert FHS-259 #1 — the in-flight guard MUST be a ref, not
  // useState. setStatus is batched, so a fast TOKEN_REFRESHED event
  // re-runs the effect before the previous render committed and
  // both reads see the stale 'idle' → double POST. A ref flips
  // synchronously and survives the cleanup boundary.
  const tenantPostInFlightRef = useRef(false);

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

    // Race-safe single-flight guard: synchronous flip on the ref means
    // a re-entry from session re-emit (TOKEN_REFRESHED, USER_UPDATED)
    // sees the true value and bails before firing a second POST.
    if (tenantPostInFlightRef.current) return;
    tenantPostInFlightRef.current = true;

    // FHS-259 — actually wire the tenant-create call. Until this
    // landed, the intent was stashed but never POSTed; users completed
    // auth but had no tenant.
    setStatus({ kind: 'creating-tenant' });
    const s = session as unknown as CallbackSession;
    const accessToken = s.access_token;
    const body = {
      familyName: (intent.familyName ?? '').trim(),
      displayName: pickDisplayName(intent, s.user),
      slug: intent.slug,
    };

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/tenant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });
        if (cancelled) return;
        if (res.status === 200 || res.status === 201) {
          sessionStorage.removeItem('fh.signup.intent');
          navigate(`/t/${intent.slug}/onboarding`, { replace: true });
          return;
        }
        // 409 (slug taken mid-OAuth) and 400 (server-side validator
        // rejected the body — usually empty/invalid familyName from a
        // malformed sessionStorage write) both mean "let the user try
        // again from /signup" rather than stranding them on an error
        // pane with no recovery route.
        if (res.status === 409 || res.status === 400) {
          setStatus({
            kind: 'error',
            message:
              res.status === 409
                ? 'That family URL was just taken — pick another and try again.'
                : "Couldn't read your family details — please re-enter them.",
          });
          // Clear the intent on 409 so a retry from /signup starts
          // clean (the user picks a new family name anyway). On 400
          // the intent is already wrong — clearing it lets the form
          // re-hydrate from scratch.
          sessionStorage.removeItem('fh.signup.intent');
          tenantPostInFlightRef.current = false;
          navigate('/signup', { replace: true });
          return;
        }
        setStatus({
          kind: 'error',
          message: `Couldn't finish creating your family (server returned ${res.status}). Please try again or contact support.`,
        });
        tenantPostInFlightRef.current = false;
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Network error — try again.',
        });
        tenantPostInFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
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
