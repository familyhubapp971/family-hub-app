import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { AuthLayout } from './AuthLayout';
import { supabase } from '../../lib/supabase';

// Auth landing page. Two responsibilities only:
//   1. If the URL carries a `?code=...` (PKCE), exchange it for a
//      session synchronously here. Supabase's `detectSessionInUrl` does
//      start the exchange on import, but it resolves on a different
//      microtask than AuthProvider's initial getSession() — without
//      the explicit claim the latter can return null first, flip
//      loading=false, and bounce the user to /login before the session
//      lands via onAuthStateChange.
//   2. Once the session is established, navigate to /dashboard. The
//      LegacyDashboardRedirect there fetches /api/me and either
//      forwards a returning user to /t/<slug>/dashboard, or renders
//      the inline create-family panel for a first-timer with no
//      tenant yet. Family name + slug are collected in that panel,
//      not pre-auth on /signup. That keeps a single source of truth
//      for family details and removes the sessionStorage-intent dance
//      that used to break when the magic-link was opened in a
//      different tab / browser / device.

type ExchangeState = 'pending' | 'done' | 'error';
type CallbackStatus = { kind: 'idle' } | { kind: 'error'; message: string };

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>({ kind: 'idle' });

  const exchangeCodeRef = useRef<string | null>(searchParams.get('code'));
  const [exchangeState, setExchangeState] = useState<ExchangeState>(() =>
    exchangeCodeRef.current ? 'pending' : 'done',
  );

  useEffect(() => {
    if (exchangeState !== 'pending') return;
    const code = exchangeCodeRef.current;
    if (!code) {
      setExchangeState('done');
      return;
    }
    let cancelled = false;
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        setStatus({
          kind: 'error',
          message: 'Your sign-in link has expired or already been used. Request a new one.',
        });
        setExchangeState('error');
        return;
      }
      // Strip the one-shot PKCE params from the URL so a refresh or
      // share doesn't retry (a second exchange of the same code fails).
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', url.toString());
        } catch {
          // History API unavailable — non-fatal.
        }
      }
      setExchangeState('done');
    });
    return () => {
      cancelled = true;
    };
  }, [exchangeState]);

  useEffect(() => {
    if (exchangeState === 'pending') return;
    if (exchangeState === 'error') return;
    if (loading) return;
    if (!session) {
      // No session means OAuth failed or was cancelled. Bounce to login
      // so the user can retry instead of being stuck on a blank screen.
      navigate('/login', { replace: true });
      return;
    }
    // Cleanup any legacy intent left over from older flows so it
    // doesn't follow the user around across browsers.
    sessionStorage.removeItem('fh.signup.intent');
    navigate('/dashboard', { replace: true });
  }, [exchangeState, loading, session, navigate]);

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
