import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// FHS-358 — the homepage reflects logged-in state. WelcomePage reads useAuth()
// (adult session) + fh.kid.token (kid) to switch between the public ad hero and
// a "Welcome back" landing. Mock the auth module + fetch.

const authState: { session: { access_token: string; user: object } | null } = { session: null };
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn(async () => ({ error: null })),
  KID_TOKEN_STORAGE_KEY: 'fh.kid.token',
}));

import { WelcomePage } from '../../../../apps/web/src/pages/marketing/WelcomePage';

const fetchMock = vi.fn();

function installAdultApi() {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole: 'admin',
          members: [
            { id: 'k1', displayName: 'Iman', avatarEmoji: '👦', isChild: true },
            { id: 'a1', displayName: 'Dad', avatarEmoji: '🧔', isChild: false },
          ],
        }),
      });
    }
    // /api/me
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ tenants: [{ slug: 'khans', name: 'Khan Family' }] }),
    });
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.session = null;
  fetchMock.mockReset();
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<WelcomePage /> — logged-in state (FHS-358)', () => {
  it('logged out: shows the public CTAs, not the welcome-back landing', () => {
    renderPage();
    expect(screen.getByText('Start free')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-loggedin')).not.toBeInTheDocument();
  });

  it('adult logged in: welcome-back landing with dashboard + members + child world', async () => {
    authState.session = { access_token: 'tok', user: {} };
    installAdultApi();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    // Profile pill + logout instead of Log in / Start free.
    expect(screen.getByTestId('welcome-logout')).toBeInTheDocument();
    expect(screen.queryByText('Start free')).not.toBeInTheDocument();
    // Quick links: dashboard, manage members, and the child's world.
    await waitFor(() => expect(screen.getByText("Iman's World")).toBeInTheDocument());
    expect(screen.getByText('Manage members')).toBeInTheDocument();
    expect(screen.getAllByText('Go to your dashboard').length).toBeGreaterThan(0);
  });

  it('kid logged in: welcome-back landing, no member management', async () => {
    localStorage.setItem('fh.kid.token', 'kid-jwt');
    localStorage.setItem(
      'fh.kid.lastFamily',
      JSON.stringify({ slug: 'khans', name: 'Khan Family' }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('welcome-loggedin')).toBeInTheDocument());
    expect(screen.getByTestId('welcome-logout')).toBeInTheDocument();
    expect(screen.getAllByText('Go to my hub').length).toBeGreaterThan(0);
    expect(screen.queryByText('Manage members')).not.toBeInTheDocument();
    expect(screen.queryByText('Start free')).not.toBeInTheDocument();
  });
});
