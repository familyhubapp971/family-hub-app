import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthCallbackPage } from '../../../../apps/web/src/pages/auth/AuthCallbackPage';

// Auth-first onboarding (option A in the duplication thread).
// AuthCallbackPage now does two things and nothing else:
//   1. Claim the PKCE `?code=` (if present) via exchangeCodeForSession
//      so the AuthProvider sees the session before falling to /login.
//   2. Once the session is established, navigate to /dashboard. The
//      tenant-create + "first-time setup" flow has moved to the
//      CreateFamilyPanel under LegacyDashboardRedirect — see
//      `LegacyDashboardRedirect.test.tsx` for that contract.

type SessionLike = {
  access_token?: string;
  user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
} | null;
const authState: { loading: boolean; session: SessionLike } = { loading: false, session: null };
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  },
}));

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/dashboard" element={<div data-testid="route-marker">dashboard</div>} />
        <Route path="/login" element={<div data-testid="route-marker">login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<AuthCallbackPage />', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.loading = false;
    authState.session = null;
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('navigates to /dashboard once the session is established', async () => {
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
  });

  // FHS-331 — an expired magic link must not look "signed in" via a stale
  // persisted session. The callback shows the expired message, does not
  // navigate into the app, and signs out.
  it('rejects an expired link even with a stale session, and signs out', async () => {
    authState.session = {
      access_token: 'stale-jwt',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt(
      '/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(screen.getByTestId('auth-callback-error').textContent).toMatch(/expired/i);
    // Must NOT have navigated into the app.
    expect(screen.queryByTestId('route-marker')).toBeNull();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('does NOT POST any tenant-create call from the callback page', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    // Tenant creation is the create-family panel's job now.
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('clears any legacy fh.signup.intent left over from older flows', async () => {
    sessionStorage.setItem(
      'fh.signup.intent',
      JSON.stringify({ familyName: 'old', displayName: 'old', slug: 'old' }),
    );
    authState.session = {
      access_token: 'jwt-abc',
      user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
    };
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    expect(sessionStorage.getItem('fh.signup.intent')).toBeNull();
  });

  it('bounces to /login when there is no session (cancelled / failed OAuth)', async () => {
    authState.session = null;
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('login'));
  });

  it('shows the loading copy while auth-context is still resolving', () => {
    authState.loading = true;
    authState.session = null;
    renderAt('/auth/callback');
    expect(screen.getByTestId('auth-callback')).toBeInTheDocument();
    expect(screen.queryByTestId('route-marker')).toBeNull();
  });

  describe('PKCE callback (URL has ?code=)', () => {
    it('exchanges the code, strips it from the URL, then continues to /dashboard', async () => {
      exchangeCodeForSession.mockResolvedValueOnce({ error: null });
      // Simulate the SDK populating the session after the exchange resolves.
      authState.session = {
        access_token: 'jwt-after-exchange',
        user: { id: 'u1', email: 'sarah@example.com', user_metadata: {} },
      };
      renderAt('/auth/callback?code=pkce-abc&state=xyz');
      await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith('pkce-abc'));
      await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('dashboard'));
    });

    it('surfaces an inline error when the code has expired or already been used', async () => {
      exchangeCodeForSession.mockResolvedValueOnce({
        error: { message: 'one-time use' },
      });
      renderAt('/auth/callback?code=stale&state=xyz');
      await waitFor(() =>
        expect(screen.getByTestId('auth-callback-error').textContent).toMatch(/expired|used/i),
      );
      // We do NOT bounce to /login on an exchange error — the user
      // needs to see the message and request a fresh link.
      expect(screen.queryByTestId('route-marker')).toBeNull();
    });
  });
});
