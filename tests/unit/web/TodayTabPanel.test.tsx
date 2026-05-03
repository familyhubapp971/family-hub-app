import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-228 — TodayTabPanel. Loading / error / empty / populated paths
// + the request shape (Authorization + x-tenant-slug headers) hitting
// /api/dashboard/today.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { TodayTabPanel } from '../../../apps/web/src/pages/dashboard/TodayTabPanel';
import { TenantProvider } from '../../../apps/web/src/lib/tenant-context';

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <TodayTabPanel />
            </TenantProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<TodayTabPanel />', () => {
  it('renders a loading hint while the request is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('today-loading')).toBeInTheDocument();
  });

  it('renders the inline error when the API returns a non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-error')).toBeInTheDocument());
  });

  it('renders the empty-family hint when members[] is empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        date: '2026-05-03',
        greetingName: 'Sarah',
        members: [],
        counts: { members: 0, habits: 0, rewards: 0 },
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.getByTestId('today-members-empty')).toBeInTheDocument();
    expect(screen.getByTestId('today-count-members').textContent).toBe('0');
    expect(screen.getByTestId('today-count-habits').textContent).toBe('0');
    expect(screen.getByTestId('today-count-rewards').textContent).toBe('0');
  });

  it('renders greeting + counts + member rows when populated', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        date: '2026-05-03',
        greetingName: 'Sarah',
        members: [
          { id: 'm1', displayName: 'Sarah Khan', role: 'admin', avatarEmoji: '👩' },
          { id: 'm2', displayName: 'Iman', role: 'child', avatarEmoji: null },
        ],
        counts: { members: 2, habits: 5, rewards: 3 },
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());

    // Greeting includes the greetingName from the server.
    expect(screen.getByTestId('today-greeting').textContent).toContain('Sarah');

    // Counts mirror the response body.
    expect(screen.getByTestId('today-count-members').textContent).toBe('2');
    expect(screen.getByTestId('today-count-habits').textContent).toBe('5');
    expect(screen.getByTestId('today-count-rewards').textContent).toBe('3');

    // Member rows render in response order with role badge text.
    expect(screen.getByTestId('today-member-0-name').textContent).toBe('Sarah Khan');
    expect(screen.getByTestId('today-member-0-role').textContent?.toLowerCase()).toContain('admin');
    expect(screen.getByTestId('today-member-1-name').textContent).toBe('Iman');
    expect(screen.getByTestId('today-member-1-role').textContent?.toLowerCase()).toContain('child');
  });

  it('passes the tenant slug + bearer token on the request', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        date: '2026-05-03',
        greetingName: 'Sarah',
        members: [],
        counts: { members: 0, habits: 0, rewards: 0 },
      }),
    });
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/dashboard/today');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok-abc',
      'x-tenant-slug': 'khans',
    });
  });

  it('does not fetch when no session is present', () => {
    authState.session = null;
    renderAt('/t/khans/dashboard');
    expect(fetchMock).not.toHaveBeenCalled();
    // Stays in loading state — no error rendered.
    expect(screen.getByTestId('today-loading')).toBeInTheDocument();
  });
});
