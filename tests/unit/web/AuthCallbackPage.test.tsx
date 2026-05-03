import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthCallbackPage } from '../../../apps/web/src/pages/auth/AuthCallbackPage';

// FHS-249 — AuthCallbackPage redirect destination depends on whether
// SignupPage stashed a tenant slug in sessionStorage. Fresh signups
// land on /t/<slug>/dashboard; legacy/login flows fall back to
// /dashboard.

// Stub useAuth so we can drive the (loading, session) state vector.
const authState: { loading: boolean; session: unknown } = { loading: false, session: null };
vi.mock('../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
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
      </Routes>
    </MemoryRouter>,
  );
}

describe('FHS-249 — AuthCallbackPage redirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.loading = false;
    authState.session = null;
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('redirects to /t/<slug>/onboarding when fh.signup.intent has a slug', async () => {
    // FHS-36 — fresh signups land on the onboarding wizard. The
    // wizard's own gate bounces returning users to /dashboard.
    sessionStorage.setItem('fh.signup.intent', JSON.stringify({ slug: 'khans' }));
    authState.session = { user: { id: 'u1' } };
    renderAt('/auth/callback');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('tenant-onboarding'),
    );
  });

  it('falls back to /dashboard when no signup intent is stashed', async () => {
    authState.session = { user: { id: 'u1' } };
    renderAt('/auth/callback');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('legacy-dashboard'),
    );
  });

  it('falls back to /dashboard when the stashed slug is malformed', async () => {
    sessionStorage.setItem('fh.signup.intent', JSON.stringify({ slug: 'BAD..slug!!' }));
    authState.session = { user: { id: 'u1' } };
    renderAt('/auth/callback');
    await waitFor(() =>
      expect(screen.getByTestId('route-marker').textContent).toBe('legacy-dashboard'),
    );
  });

  it('redirects to /login when there is no session', async () => {
    authState.session = null;
    renderAt('/auth/callback');
    await waitFor(() => expect(screen.getByTestId('route-marker').textContent).toBe('login'));
  });
});
