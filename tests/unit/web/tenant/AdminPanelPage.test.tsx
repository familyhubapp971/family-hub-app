import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-308 — AdminPanelPage unit tests.
// Uses URL-matched fetch mock — no MSW, no window.confirm.
// Tests: render with child selected, tab switching, Savings edit PUT,
// History reopen via ConfirmDialog, App Info PUT.

const fetchMock = vi.fn();
const authState: {
  session: { access_token?: string } | null;
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
} = {
  session: { access_token: 'tok-admin' },
  user: { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} },
};

vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: vi.fn().mockResolvedValue({ error: null }),
  getKidToken: () => null,
  clearKidToken: vi.fn(),
}));

import { AdminPanelPage } from '../../../../apps/web/src/pages/tenant/AdminPanelPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHILD_ID = 'child-uuid-1111';
const WEEK_ID = 'week-uuid-aaaa';

const MEMBERS = [
  { id: 'admin-1', displayName: 'Sarah', role: 'admin', avatarEmoji: null, isChild: false },
  { id: CHILD_ID, displayName: 'Amina', role: 'child', avatarEmoji: '🦄', isChild: true },
];

const CURRENT_WEEK = {
  id: WEEK_ID,
  weekNumber: 23,
  year: 2026,
  isFinalized: false,
};

const WEEK_STATS = {
  availableStickers: 12,
  availableCash: 6,
  totalEarned: 20,
  weekId: WEEK_ID,
};

const SAVINGS = {
  savedStickers: 5,
  savedCash: 3.5,
  cashEquivalent: 6,
};

const WEEKS_LIST = [
  {
    id: WEEK_ID,
    weekNumber: 23,
    year: 2026,
    status: 'Active',
    isFinalized: false,
    carriedOverStickers: 0,
    carriedOverCash: 0,
    retrievedStickers: 0,
    retrievedCash: 0,
  },
  {
    id: 'week-prev',
    weekNumber: 22,
    year: 2026,
    status: 'Finalized',
    isFinalized: true,
    carriedOverStickers: 2,
    carriedOverCash: 1,
    retrievedStickers: 1,
    retrievedCash: 0.5,
  },
];

const APP_SETTINGS = { appName: 'Iman World', appSubtitle: 'Track habits and earn!' };

// ── Mock fetch router ─────────────────────────────────────────────────────────

function installApi(callerRole = 'admin') {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);

    // AppHeader self-fetches these two on mount.
    // Use exact-path match (/api/me) to avoid catching /api/members.
    if (/\/api\/me(\?|$)/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u-admin',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
        }),
      });
    }
    if (u.includes('/api/dashboard/today')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          date: '2026-06-15',
          callerMemberId: 'admin-1',
          members: [],
        }),
      });
    }

    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ members: MEMBERS, callerRole }),
      });
    }
    if (u.includes('/api/mw/weeks/current')) {
      // Real API wraps the week: { week: {...} } — mock must match or the
      // Balance tab's unwrap regression slips through (FHS-311).
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ week: CURRENT_WEEK }) });
    }
    if (u.includes('/api/mw/weeks/') && u.includes('/stats')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => WEEK_STATS });
    }
    if (
      u.includes('/api/mw/weeks') &&
      !u.includes('/stats') &&
      !u.includes('/current') &&
      !u.includes('/reopen') &&
      !u.includes('/repair') &&
      !u.includes('/finalize') &&
      !u.includes('/actions') &&
      !u.includes('/cash')
    ) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: WEEKS_LIST }) });
    }
    if (u.includes('/actions')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
    }
    if (u.includes('/reopen')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/repair')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/finalize')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/cash') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/api/mw/financial/savings/admin-set')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => SAVINGS });
    }
    if (u.includes('/api/admin/settings/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (u.includes('/api/admin/settings')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => APP_SETTINGS });
    }
    // Fallback
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

function renderAt(path = '/t/khans/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/t/:slug/admin"
          element={
            <TenantProvider>
              <AdminPanelPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/members" element={<div data-testid="members-page" />} />
        <Route path="/t/:slug/dashboard" element={<div data-testid="dashboard-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  authState.session = { access_token: 'tok-admin' };
  authState.user = { email: 'sarah@example.com', id: 'u-admin', user_metadata: {} };
  installApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('<AdminPanelPage />', () => {
  it('redirects a non-admin/adult caller away from the admin panel', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'child' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
  });

  it('redirects a normal-user adult away from the admin panel (FHS-343)', async () => {
    installApi('adult');
    renderAt();
    await waitFor(() => expect(screen.getByTestId('dashboard-page')).toBeInTheDocument());
    expect(screen.queryByTestId('admin-panel')).not.toBeInTheDocument();
  });

  it('renders the gradient header and child selector on Balance tab', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel')).toBeInTheDocument());
    // Orange→pink gradient header
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    // Child selector renders Amina
    await waitFor(() =>
      expect(screen.getByTestId(`admin-child-selector-${CHILD_ID}`)).toBeInTheDocument(),
    );
  });

  it('shows the global app header (brand home button) on the admin panel', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel')).toBeInTheDocument());
    expect(screen.getByTestId('dashboard-brand-home')).toBeInTheDocument();
  });

  it('Balance tab shows available stickers and cash value for the selected child', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-balance-stickers-display').textContent).toBe('12');
    expect(screen.getByTestId('admin-balance-cash-display').textContent).toBe('AED 6.00');
  });

  it('renders all five Quick Action buttons', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-balance-action-claim')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-cashout')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-save')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-invest')).toBeInTheDocument();
    expect(screen.getByTestId('admin-balance-action-withdraw')).toBeInTheDocument();
  });

  it('FHS-416 — invest with too few stickers shows a clear reason, not the raw 409', async () => {
    const HABIT = { id: 'habit-1', name: 'Read a book' };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (/\/api\/me(\?|$)/.test(u))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u-admin',
            email: 'sarah@example.com',
            tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
          }),
        });
      if (u.includes('/api/dashboard/today'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ date: '2026-06-15', callerMemberId: 'admin-1', members: [] }),
        });
      if (u.includes('/api/members'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ members: MEMBERS, callerRole: 'admin' }),
        });
      if (u.includes('/api/mw/weeks/current'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ week: CURRENT_WEEK }),
        });
      if (u.includes('/stats'))
        return Promise.resolve({ ok: true, status: 200, json: async () => WEEK_STATS });
      if (u.includes('/api/habits'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ habits: [HABIT] }) });
      if (u.includes('/api/mw/financial/investments') && init?.method === 'POST')
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'not enough stickers',
            errorCode: 'INSUFFICIENT_STICKERS',
            available: 1,
          }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-balance-ready')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-balance-action-invest'));
    });
    fireEvent.change(await screen.findByTestId('admin-quick-action-invest-amount'), {
      target: { value: '10' },
    });
    fireEvent.click(await screen.findByText('Read a book'));
    act(() => {
      fireEvent.click(screen.getByTestId('admin-quick-action-invest-submit'));
    });
    // Friendly reason with have-vs-need, NOT the raw status code.
    await screen.findByText(/Not enough stickers to invest.*1 available.*10 needed/);
    expect(screen.queryByText(/Invest failed: 409/)).not.toBeInTheDocument();
  });

  it('switching to Savings tab fetches and renders savings data', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-savings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-savings-cash-display').textContent).toContain('3.50');
    expect(screen.getByTestId('admin-savings-sticker-display').textContent).toBe('5');
  });

  it('Savings edit issues PUT to admin-set endpoint', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-savings')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-savings'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-edit-btn')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-savings-edit-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-savings-cash-input')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('admin-savings-cash-input'), {
        target: { value: '10' },
      });
      fireEvent.change(screen.getByTestId('admin-savings-sticker-input'), {
        target: { value: '8' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-savings-save-btn'));
    });
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, init]) =>
          String(u).includes('/api/mw/financial/savings/admin-set') && init?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as {
        memberId: string;
        savedStickers: number;
        savedCash: number;
      };
      expect(body.memberId).toBe(CHILD_ID);
      expect(body.savedCash).toBe(10);
      expect(body.savedStickers).toBe(8);
    });
  });

  it('History tab shows week list with Active and Finalized rows', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-history')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-history'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-history-ready')).toBeInTheDocument());
    expect(screen.getByTestId(`admin-history-week-${WEEK_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId('admin-history-week-week-prev')).toBeInTheDocument();
    // Active week has Repair + Close Week buttons
    expect(screen.getByTestId(`admin-history-week-repair-btn-${WEEK_ID}`)).toBeInTheDocument();
    expect(screen.getByTestId(`admin-history-week-close-btn-${WEEK_ID}`)).toBeInTheDocument();
    // Finalized week has Reopen button
    expect(screen.getByTestId('admin-history-week-reopen-btn-week-prev')).toBeInTheDocument();
  });

  it('History reopen opens ConfirmDialog and POSTs to /reopen on confirm', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-history')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-history'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('admin-history-week-reopen-btn-week-prev')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('admin-history-week-reopen-btn-week-prev'));
    });
    // ConfirmDialog should be open
    await waitFor(() =>
      expect(screen.getByTestId('admin-history-reopen-confirm')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-history-reopen-confirm-confirm'));
    });
    await waitFor(() => {
      const reopenCall = fetchMock.mock.calls.find(
        ([u, init]) => String(u).includes('/reopen') && init?.method === 'POST',
      );
      expect(reopenCall).toBeTruthy();
    });
  });

  it('App Info tab renders settings and save issues PUT for each changed key', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-app-info')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-app-info'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-app-info-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-app-info-name-display').textContent).toBe('Iman World');

    // Open edit
    act(() => {
      fireEvent.click(screen.getByTestId('admin-app-info-edit-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('admin-app-info-name-input')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.change(screen.getByTestId('admin-app-info-name-input'), {
        target: { value: 'Amina World' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('admin-app-info-save-btn'));
    });
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, fetchInit]) =>
          String(u).includes('/api/admin/settings/appName') && fetchInit?.method === 'PUT',
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string) as { value: string };
      expect(body.value).toBe('Amina World');
    });
  });

  it('Users tab shows a read-only roster (no duplicate Manage button)', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('admin-panel-tab-users')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('admin-panel-tab-users'));
    });
    await waitFor(() => expect(screen.getByTestId('admin-users-ready')).toBeInTheDocument());
    expect(screen.getByTestId('admin-users-list')).toBeInTheDocument();
    // FHS-315 — the redundant header "Manage in Members" button was removed
    // (the same link still lives in the info box below the roster).
    expect(screen.queryByTestId('admin-users-manage-link')).not.toBeInTheDocument();
    // No add-user button — divergence from legacy
    expect(screen.queryByTestId('admin-users-add-btn')).not.toBeInTheDocument();
  });

  it('passes bearer token and tenant slug on every request', async () => {
    renderAt();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const firstCall = fetchMock.mock.calls[0];
    expect((firstCall![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer tok-admin',
      'x-tenant-slug': 'khans',
    });
  });

  it('selecting a different child from the selector re-fetches Balance data', async () => {
    // Add a second child to members
    const secondChildId = 'child-uuid-2222';
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/members')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            members: [
              ...MEMBERS,
              {
                id: secondChildId,
                displayName: 'Ibrahim',
                role: 'child',
                avatarEmoji: null,
                isChild: true,
              },
            ],
            callerRole: 'admin',
          }),
        });
      }
      if (u.includes('/api/mw/weeks/current')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ week: CURRENT_WEEK }),
        });
      }
      if (u.includes('/stats')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => WEEK_STATS });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    renderAt();
    await waitFor(() =>
      expect(screen.getByTestId(`admin-child-selector-${CHILD_ID}`)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId(`admin-child-selector-${secondChildId}`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`admin-child-selector-${secondChildId}`));
    });
    // Stats should be re-fetched for the new child
    await waitFor(() => {
      const statsCalls = fetchMock.mock.calls.filter(
        ([u]) => String(u).includes('/stats') && String(u).includes(secondChildId),
      );
      expect(statsCalls.length).toBeGreaterThan(0);
    });
  });
});
