import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

// FHS-227 — bridge for the un-prefixed `/dashboard` route. Fetches
// /api/me, picks the user's first tenant, and forwards to the
// tenant-scoped dashboard. Replaces the previous setup where the
// legacy route mounted DashboardPage directly — which now requires a
// TenantProvider and would crash without a slug.
//
// Cleanup tracked under FHS-205 (drop legacy un-prefixed routes once
// AuthCallback resolves the tenant itself).

interface MeResponse {
  tenants?: Array<{ slug: string }>;
}

type State = { kind: 'loading' } | { kind: 'redirect'; to: string } | { kind: 'no-tenant' };

export function LegacyDashboardRedirect() {
  const { session } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          if (!cancelled) setState({ kind: 'no-tenant' });
          return;
        }
        const body = (await res.json()) as MeResponse;
        const slug = body.tenants?.[0]?.slug;
        if (!cancelled) {
          setState(slug ? { kind: 'redirect', to: `/t/${slug}/dashboard` } : { kind: 'no-tenant' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'no-tenant' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (state.kind === 'redirect') return <Navigate to={state.to} replace />;
  if (state.kind === 'no-tenant') return <Navigate to="/" replace />;
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <p
        className="font-body text-sm text-gray-600"
        data-testid="legacy-dashboard-redirect-loading"
      >
        Finding your family hub…
      </p>
    </main>
  );
}
