import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { AuthLayout } from './AuthLayout';

// Slug syntax — must mirror the canonical regex in
// `apps/api/src/middleware/resolve-tenant.ts` (SLUG_RE) and the
// tenants table constraint. TODO(FHS-205): move to
// packages/shared/src/schemas/slug.ts so frontend + backend share one
// definition.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// OAuth landing page. Supabase's JS client (with detectSessionInUrl)
// pulls the session out of the URL hash on import — we just wait for
// the AuthProvider to flip from loading → session, then redirect.
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (session) {
      // FHS-249 — prefer the tenant-scoped dashboard URL when we know
      // the slug. Fresh signups stash it in `fh.signup.intent` (set by
      // SignupPage); existing logins fall through to the legacy
      // /dashboard until FHS-12 wires a "current tenant from /me"
      // lookup. Either route lands on the same component today.
      let redirectTo = '/dashboard';
      const intent = sessionStorage.getItem('fh.signup.intent');
      if (intent) {
        try {
          const parsed = JSON.parse(intent) as { slug?: unknown };
          if (typeof parsed.slug === 'string' && SLUG_RE.test(parsed.slug)) {
            redirectTo = `/t/${parsed.slug}/dashboard`;
          }
        } catch {
          // Malformed sessionStorage — fall back to /dashboard quietly.
        }
      }
      navigate(redirectTo, { replace: true });
    } else {
      // No session means OAuth failed or was cancelled. Bounce to login
      // so the user can retry instead of being stuck on a blank screen.
      navigate('/login', { replace: true });
    }
  }, [loading, session, navigate]);

  return (
    <AuthLayout title="Signing you in…">
      <p className="font-body text-sm text-gray-700" data-testid="auth-callback">
        Hold tight — finishing up your login.
      </p>
    </AuthLayout>
  );
}
