import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// FHS-268 — ChildWorld shell: five tabs (My World active, the rest
// placeholders) + a "Back to family" button.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn(async () => ({ error: null })),
}));

import { ChildWorldPage } from '../../../../../apps/web/src/pages/tenant/child/ChildWorldPage';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SIBLING = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function installApi() {
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ savedStickers: 12, savedCash: 5 }),
      });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          callerRole: 'admin',
          members: [
            { id: MEMBER, displayName: 'Ali', avatarEmoji: '👦', isChild: true },
            { id: SIBLING, displayName: 'Sara', avatarEmoji: '👧', isChild: true },
          ],
        }),
      });
    }
    if (u.includes('/api/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: [], stickerBalance: 0 }),
      });
    }
    if (u.includes('/api/mw/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [] }) });
    }
    if (u.includes('/api/journal')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ entries: [] }) });
    }
    if (u.includes('/api/learn')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ subjects: [] }) });
    }
    // /api/habits
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        habits: [],
        stickers: [],
        week: { id: 'wk1', weekNumber: 9, year: 2026, startDate: '2026-02-23', isFinalized: false },
        balance: 0,
      }),
    });
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <ChildWorldPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page">DASH</div>} />
        <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  installApi();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-abc' };
});
afterEach(() => vi.unstubAllGlobals());

describe('<ChildWorldPage />', () => {
  it('renders the five ChildWorld tabs with My World active', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world')).toBeInTheDocument());
    for (const label of ['My World', 'Meals', 'Calendar', 'Journal', 'Learn']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByTestId('child-panel-world')).toBeInTheDocument();
  });

  it("shows the child's name in the header once members load", async () => {
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
  });

  it('switches to the Journal tab', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Journal/ }));
    });
    expect(screen.getByTestId('child-panel-journal')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('journal-tab')).toBeInTheDocument());
  });

  it('Back to family returns to the dashboard', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world-back')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('child-world-back'));
    });
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
  });

  // FHS-288 — header: balance chips, switch-child, logout.
  it("shows the child's stars + cash balance in the header", async () => {
    renderAt();
    const chips = await screen.findByTestId('child-world-balance');
    expect(chips).toHaveTextContent('12'); // stars
    expect(chips).toHaveTextContent('5'); // cash
  });

  it('switch-child navigates to the sibling world (in-app dropdown)', async () => {
    renderAt();
    const switcher = await screen.findByTestId('child-world-switcher');
    // Open the in-app dropdown (trigger button), then pick the sibling.
    await act(async () => {
      fireEvent.click(within(switcher).getByRole('button'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Sara/));
    });
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(`/t/khan/child/${SIBLING}`),
    );
  });

  it('logout signs out and lands on /login', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('child-world-logout')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('child-world-logout'));
    });
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument());
  });

  it('hides the switcher when there is only one child', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/savings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0 }),
        });
      }
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            callerRole: 'admin',
            members: [{ id: MEMBER, displayName: 'Ali', avatarEmoji: '👦', isChild: true }],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: [] }) });
    });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
    expect(screen.queryByTestId('child-world-switcher')).not.toBeInTheDocument();
  });

  it('hides the balance chips when the savings fetch fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/savings')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            callerRole: 'admin',
            members: [{ id: MEMBER, displayName: 'Ali', avatarEmoji: '👦', isChild: true }],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: [] }) });
    });
    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId('child-world-name').textContent).toContain('Ali'),
    );
    expect(screen.queryByTestId('child-world-balance')).not.toBeInTheDocument();
  });
});
