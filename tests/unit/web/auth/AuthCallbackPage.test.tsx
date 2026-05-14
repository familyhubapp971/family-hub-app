import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthCallbackPage } from '../../../../apps/web/src/pages/auth/AuthCallbackPage';

// FHS-249 + FHS-259 — AuthCallbackPage now POSTs to /api/public/tenant
// when fh.signup.intent is present, then redirects to the onboarding
// wizard on success. Display name is backfilled from
// user_metadata.full_name (Google) or the email local-part when the
// intent didn't carry one.

// Stub useAuth so we can drive the (loading, session) state vector.
type SessionLike = {
  access_token?: string;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
} | null;
const authState: { loading: boolean; session: SessionLike } = { loading: false, session: null };
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

// Stub Supabase so we can assert exchangeCodeForSession is called and
// drive its result. The PKCE callback path (?code=...) hits this; the
// older tests below (no ?code=) never call it.
const exchangeCodeForSession = vi.fn();
vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
    },
  },
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/dashboard" element={<div data-testid="route-marker">legacy-dashboard</div>} />
        <Route
          path="/t/:slug/onboarding"
          element={<div data-testid="route-marker">tenant-onboarding</div>}
        />
        <Route path="/login" element={<div data-testid="route-marker">login</div>} />
        <Route path="/signup" element={<div data-testid="route-marker">signup</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fetchMock = vi.fn();

describe('FHS-249 + FHS-259 — AuthCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.loading = false;
    authState.session = null;
    fetchMock.mockReset();
    exchangeCodeForSession.mockReset();
    // Default: no PKCE exchange is in flight (URL has no ?code=), so
    // the mock returns null on the unlikely path it's invoked.
    exchangeCodeForSession.mockResolvedValue({ error: null });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  // FHS-259 — happy-path tenant-create call wires intent fields +
  // Authorization header, then redirects to the onboarding wizard.
  it('POSTs /api/public/tenant with intent values + redirects to onboarding on 200', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'The Khan Family', displayName: 'Sarah Khan', slug: 'khan' }),
    );
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ tenant: { id: 't1', slug: 'khan' } }), { status: 200 }),
    );
    renderAt('/auth/callback');

    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-onboarding'),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/public/tenant');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt-abc',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      familyName: 'The Khan Family',
      displayName: 'Sarah Khan',
      slug: 'khan',
    });
    // Intent is consumed once the tenant exists.
    expect(sessionStorage.getItem('fh.signup.intent')).toBeNull();
  });

  // FHS-259 — Google path: user only typed family name. Display name
  // comes from user_metadata.full_name on the post-callback session.
  it('backfills displayName from user_metadata.full_name when intent has no displayName', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'The Khan Family', displayName: '', slug: 'khan' }),
    );
    authState.session = {
      access_token: 'jwt-google',
      user: {
        id: 'u1',
        email: 'sarah@example.com',
        user_metadata: { full_name: 'Sarah Khan' },
      },
    };
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    renderAt('/auth/callback');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.displayName).toBe('Sarah Khan');
  });

  // FHS-259 — last-ditch fallback when neither intent nor Google
  // profile gave us a display name. Email local-part is the floor so
  // the tenant create never lands without a name.
  it('falls back to capitalised email local-part when no displayName + no full_name', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'The Khan Family', displayName: '', slug: 'khan' }),
    );
    authState.session = {
      access_token: 'jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    renderAt('/auth/callback');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.displayName).toBe('Sarah');
  });

  // FHS-259 — slug got taken by another signup mid-OAuth (rare but
  // possible). Bounce to /signup so the user can pick another name.
  it('routes to /signup + clears intent when tenant create returns 409 (slug taken)', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'Khan', displayName: 'Sarah', slug: 'khan' }),
    );
    authState.session = {
      access_token: 'jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 409 }));
    renderAt('/auth/callback');

    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('signup'));
    // Stale intent gets cleared so the next /signup attempt starts clean.
    expect(sessionStorage.getItem('fh.signup.intent')).toBeNull();
  });

  // FHS-259 (qa-expert nice-to-have #1) — 400 from the server (e.g.
  // empty familyName from a malformed sessionStorage write) should
  // also route to /signup, not strand the user on a 5xx error pane.
  it('routes to /signup when tenant create returns 400 (validator rejected the body)', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: '', displayName: 'Sarah', slug: 'khan' }),
    );
    authState.session = {
      access_token: 'jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid"}', { status: 400 }));
    renderAt('/auth/callback');

    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('signup'));
    expect(sessionStorage.getItem('fh.signup.intent')).toBeNull();
  });

  // FHS-259 — server-side failure surfaces a visible error rather
  // than a silent redirect, so the user can take it to support
  // instead of staring at a blank screen.
  it('shows an inline error pane when tenant create returns 500', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'Khan', displayName: 'Sarah', slug: 'khan' }),
    );
    authState.session = {
      access_token: 'jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    renderAt('/auth/callback');

    await waitFor(() => expect(screen.getByTestId('auth-callback-error')).toBeInTheDocument());
    expect(screen.getByTestId('auth-callback-error').textContent).toMatch(/500/);
  });

  // Pre-existing FHS-249 / login-flow paths (unchanged behaviour).

  it('falls back to /dashboard when no signup intent is stashed (login flow)', async () => {
    authState.session = {
      access_token: 'jwt',
      user: { id: 'u1', email: 'returning@example.com' },
    };
    renderAt('/auth/callback');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('legacy-dashboard'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to /dashboard when the stashed slug is malformed', async () => {
    sessionStorage.setItem('fh.signup.intent', JSON.stringify({ slug: 'BAD..slug!!' }));
    authState.session = {
      access_token: 'jwt',
      user: { id: 'u1', email: 'sarah@example.com' },
    };
    renderAt('/auth/callback');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('legacy-dashboard'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to /login when there is no session', async () => {
    authState.session = null;
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('login'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // PKCE callback race fix — when the magic link lands the user at
  // /auth/callback?code=<pkce>, the SDK's automatic
  // detectSessionInUrl racing with AuthProvider.getSession() can
  // cause useAuth() to flip loading=false / session=null first and
  // bounce the user to /login before the session is exchanged.
  // The fix: claim the code explicitly, wait for the exchange to
  // resolve, then proceed.
  describe('PKCE callback (?code=…) race fix', () => {
    it('calls supabase.auth.exchangeCodeForSession before reading the session', async () => {
      // Session is initially null (the SDK is still mid-exchange) but
      // we'd otherwise bounce to /login. Pre-fix, the test would
      // assert "login" — post-fix it must NOT bounce.
      authState.session = null;
      let resolveExchange: (v: { error: null }) => void = () => {};
      exchangeCodeForSession.mockImplementation(
        () =>
          new Promise((res) => {
            resolveExchange = res;
          }),
      );
      renderAt('/auth/callback?code=pkce-abc&state=xyz');

      // The exchange is awaited — no bounce-to-login while pending.
      await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith('pkce-abc'));
      expect(screen.queryByTestId('route-marker')).toBeNull();

      // Once the exchange resolves, the existing flow takes over.
      // With no signup intent stashed the legacy login fallback fires.
      authState.session = {
        access_token: 'jwt',
        user: { id: 'u1', email: 'sarah@example.com' },
      };
      resolveExchange({ error: null });
      await waitFor(() =>
        expect(screen.getByTestId('route-marker').textContent).toBe('legacy-dashboard'),
      );
    });

    it('shows an inline error when the exchange fails (expired or already-used link)', async () => {
      exchangeCodeForSession.mockResolvedValueOnce({
        error: { message: 'invalid_grant' },
      });
      renderAt('/auth/callback?code=stale-code');

      await waitFor(() => expect(screen.getByTestId('auth-callback-error')).toBeInTheDocument());
      expect(screen.getByTestId('auth-callback-error').textContent).toMatch(/expired or already/i);
      // Must NOT bounce on a failed exchange — the user needs to read
      // the error and request a fresh link.
      expect(screen.queryByTestId('route-marker')).toBeNull();
    });

    it('does NOT call exchangeCodeForSession when there is no ?code= in the URL', async () => {
      authState.session = { access_token: 'jwt', user: { id: 'u1', email: 'sarah@example.com' } };
      renderAt('/auth/callback');
      await waitFor(() =>
        expect(screen.getByTestId('route-marker').textContent).toBe('legacy-dashboard'),
      );
      expect(exchangeCodeForSession).not.toHaveBeenCalled();
    });
  });
});
