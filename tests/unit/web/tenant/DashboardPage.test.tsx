import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// FHS-227 + FHS-261 — Parent Dashboard shell. Tab framework invariants
// (6 tabs render, default = home, ?tab= drives the active panel) plus
// the FHS-261 header refactor: family-name hero replaces the plain
// "Family Hub" wordmark; profile pill dropdown replaces the email +
// Log out pair; per-tab icons + badge support are wired into TopNav.

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  signOutAll: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('../../../../apps/web/src/lib/supabase', () => ({
  supabase: { auth: { signOut: mocks.signOut } },
}));

const authState: {
  user: { email?: string; id?: string; user_metadata?: Record<string, unknown> } | null;
  session: { access_token?: string } | null;
} = {
  user: { email: 'sarah@example.com', id: 'u-1', user_metadata: {} },
  session: { access_token: 'tok-1' },
};
vi.mock('../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
  signOutAll: mocks.signOutAll,
  // FHS-257 — DashboardPage now branches to the kid shell when a kid
  // token is present. These parent tests have no kid token.
  getKidToken: () => null,
  clearKidToken: vi.fn(),
}));

vi.stubGlobal('fetch', mocks.fetchMock);

import { DashboardPage } from '../../../../apps/web/src/pages/tenant/DashboardPage';
import { TenantProvider } from '../../../../apps/web/src/lib/tenant-context';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="location-search">{loc.search}</span>;
}

function renderAt(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      {/* LocationProbe sits above <Routes> so it survives navigation
          and keeps reporting the current URL even after the dashboard
          route unmounts (e.g. when Add member pushes /t/<slug>/members). */}
      <LocationProbe />
      <Routes>
        <Route
          path="/t/:slug/dashboard"
          element={
            <TenantProvider>
              <DashboardPage />
            </TenantProvider>
          }
        />
        <Route path="/t/:slug/members" element={<div data-testid="members-route" />} />
        <Route path="/" element={<div data-testid="welcome-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Sensible defaults for /api/me and /api/dashboard/today so each test
// only overrides what it actually cares about.
function defaultFetchMocks() {
  mocks.fetchMock.mockImplementation(async (url: string) => {
    if (url.includes('/api/me')) {
      return {
        ok: true,
        json: async () => ({
          id: 'u-1',
          email: 'sarah@example.com',
          tenants: [{ id: 't-1', slug: 'khans', name: 'The Khans', role: 'admin' }],
        }),
      } as Response;
    }
    if (url.includes('/api/dashboard/today')) {
      return {
        ok: true,
        json: async () => ({
          date: '2026-06-10',
          greetingName: 'Sarah',
          callerMemberId: 'm-1',
          counts: {
            members: 4,
            habits: 5,
            rewards: 3,
            tasksDoneToday: 1,
            tasksTotalToday: 2,
            mealsPlanned: 2,
          },
          members: [
            {
              id: 'm-1',
              displayName: 'Sarah',
              role: 'admin',
              avatarEmoji: null,
              habitsDone: 0,
              habitsTotal: 0,
              streak: 0,
              tasksPending: 1,
              statusText: '1 task left',
              starBalance: 0,
              pendingSignup: false,
            },
            {
              id: 'm-2',
              displayName: 'Yusuf',
              role: 'adult',
              avatarEmoji: null,
              habitsDone: 0,
              habitsTotal: 0,
              streak: 0,
              tasksPending: 0,
              statusText: 'All done',
              starBalance: 0,
              pendingSignup: false,
            },
            {
              id: 'm-3',
              displayName: 'Iman',
              role: 'child',
              avatarEmoji: '👧',
              habitsDone: 1,
              habitsTotal: 3,
              streak: 2,
              tasksPending: 0,
              statusText: '1/3 habits',
              starBalance: 87,
              pendingSignup: false,
            },
            {
              id: 'm-4',
              displayName: 'Ali',
              role: 'child',
              avatarEmoji: '👦',
              habitsDone: 3,
              habitsTotal: 3,
              streak: 5,
              tasksPending: 0,
              statusText: 'All done',
              starBalance: 122,
              pendingSignup: false,
            },
          ],
          goals: [],
          recentActivity: [],
        }),
      } as Response;
    }
    if (url.includes('/api/members')) {
      return {
        ok: true,
        json: async () => ({ callerRole: 'admin' }),
      } as Response;
    }
    if (url.includes('/api/mw/redemption-requests')) {
      return {
        ok: true,
        json: async () => ({ requests: [] }),
      } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
}

beforeEach(() => {
  mocks.signOut.mockReset();
  mocks.signOut.mockResolvedValue({});
  mocks.signOutAll.mockReset();
  mocks.signOutAll.mockResolvedValue({ error: null });
  mocks.fetchMock.mockReset();
  defaultFetchMocks();
  authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
  authState.session = { access_token: 'tok-1' };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<DashboardPage /> — tab framework', () => {
  it('renders six tabs in the nav (FHS-401: Learning Insights moved to child world view)', () => {
    renderAt('/t/khans/dashboard');
    for (const label of ['Dashboard', 'Meals', 'Calendar', 'Assignments', 'Noticeboard', 'Tasks']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // Learning Insights tab removed from parent dashboard (FHS-401)
    expect(screen.queryByRole('tab', { name: /Learning Insights/ })).not.toBeInTheDocument();
    // Reward Requests tab also not on parent dashboard
    expect(screen.queryByRole('tab', { name: /Reward Requests/ })).not.toBeInTheDocument();
  });

  it('?tab=learning-insights falls back to the default home panel (tab no longer exists)', () => {
    renderAt('/t/khans/dashboard?tab=learning-insights');
    // Tab removed — falls back to home
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-panel-learning-insights')).not.toBeInTheDocument();
  });

  it('defaults to the home (Dashboard) panel when ?tab is absent', () => {
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.getByTestId('today-loading')).toBeInTheDocument();
  });

  it('honours ?tab=meals on initial render', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    expect(screen.getByTestId('dashboard-panel-meals')).toBeInTheDocument();
    expect(screen.getByTestId('meals-loading')).toBeInTheDocument();
  });

  it('renders the Meals tab unwrapped — not inside the white card (FHS-318)', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    // The Meals header uses white text for the purple page; if it were still
    // wrapped in the white card the heading would be invisible. Assert it has
    // no white-card ancestor (Home/Calendar render the same way).
    expect(screen.getByTestId('meals-loading').closest('.bg-white')).toBeNull();
  });

  it('falls back to the default panel when ?tab is unknown', () => {
    renderAt('/t/khans/dashboard?tab=does-not-exist');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
  });

  it('clicking a tab updates the active panel content + URL ?tab param', () => {
    renderAt('/t/khans/dashboard');
    const tab = screen.getByRole('tab', { name: /Tasks/ });
    act(() => {
      fireEvent.click(tab);
    });
    expect(screen.getByTestId('dashboard-panel-tasks')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-panel-home')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=tasks');
  });

  it('clicking back to Dashboard removes the ?tab param entirely', () => {
    renderAt('/t/khans/dashboard?tab=meals');
    expect(screen.getByTestId('location-search').textContent).toBe('?tab=meals');
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: /Dashboard/ }));
    });
    expect(screen.getByTestId('location-search').textContent).toBe('');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true and others false', () => {
    renderAt('/t/khans/dashboard?tab=tasks');
    expect(screen.getByRole('tab', { name: /Tasks/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Meals/ }).getAttribute('aria-selected')).toBe('false');
  });

  // FHS-392 — reward-requests tab removed; panel moved to ChildWorldPage sidebar.
  it('?tab=reward-requests falls back to the default home panel (tab no longer exists)', () => {
    renderAt('/t/khans/dashboard?tab=reward-requests');
    // Unknown tab → fallback to home
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    expect(screen.queryByTestId('reward-requests-panel')).not.toBeInTheDocument();
  });

  it('home tab does not show RewardRequestsPanel', async () => {
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-panel-home')).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId('reward-requests-panel')).not.toBeInTheDocument();
  });
});

describe('<DashboardPage /> — FHS-261 header', () => {
  it('fetches /api/me + /api/dashboard/today and renders "<name> Family Hub"', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-family-name').textContent).toBe('The Khans Family Hub'),
    );
    // Both lookups went out with the slug as the tenant context.
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
      }),
    );
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/today'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-tenant-slug': 'khans' }),
      }),
    );
  });

  it('shows "N members active" pulse when /api/dashboard/today returns members', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-members-active').textContent).toMatch(
        /4 members active/i,
      ),
    );
  });

  it('renders the loading skeleton until both fetches resolve', () => {
    // Reset the fetch so it never resolves during this test.
    mocks.fetchMock.mockReset();
    mocks.fetchMock.mockReturnValue(new Promise(() => {}));
    renderAt('/t/khans/dashboard');
    expect(screen.getByTestId('dashboard-family-hero-loading')).toBeInTheDocument();
  });

  it('profile pill is collapsed by default and opens on click', async () => {
    renderAt('/t/khans/dashboard');
    expect(screen.queryByTestId('dashboard-profile-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-menu')).toBeInTheDocument();
  });

  it('dropdown lists every child member with a View World link', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('dashboard-family-name')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-child-m-3').textContent).toMatch(/Iman/);
    expect(screen.getByTestId('dashboard-profile-child-m-4').textContent).toMatch(/Ali/);
    // Adults must NOT appear under Children.
    expect(screen.queryByTestId('dashboard-profile-child-m-1')).toBeNull();
    expect(screen.queryByTestId('dashboard-profile-child-m-2')).toBeNull();
  });

  // FHS-500 — add-member now lives on the Family Overview (FHS-498), so the
  // profile dropdown no longer carries a "+" or an "Add member" button.
  it('the profile dropdown has no add-member controls (FHS-500)', async () => {
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.queryByTestId('dashboard-profile-add-member')).toBeNull();
    expect(screen.queryByTestId('dashboard-profile-add-member-plus')).toBeNull();
    // Manage members stays.
    expect(screen.getByTestId('dashboard-profile-manage-members')).toBeInTheDocument();
  });

  it('Manage members item navigates to the members page (FHS-273)', async () => {
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    fireEvent.click(screen.getByTestId('dashboard-profile-manage-members'));
    await waitFor(() => expect(screen.getByTestId('members-route')).toBeInTheDocument());
    expect(screen.getByTestId('location-search').textContent).toBe('');
  });

  it('standalone Logout button is always visible and calls signOutAll()', async () => {
    renderAt('/t/khans/dashboard');
    // No dropdown needed — the red Logout button sits in the nav (MP).
    expect(screen.queryByTestId('dashboard-profile-menu')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('dashboard-logout'));
    });
    expect(mocks.signOutAll).toHaveBeenCalledTimes(1);
  });

  it('Tasks tab shows an open-tasks badge from the dashboard counts', async () => {
    renderAt('/t/khans/dashboard');
    // Fixture: tasksTotalToday 2 - tasksDoneToday 1 = 1 open task.
    await waitFor(() => expect(screen.getByTestId('tab-tasks-badge')).toBeInTheDocument());
    expect(screen.getByTestId('tab-tasks-badge').textContent).toBe('1');
  });

  it('refreshes the My Tasks badge on the dashboard-stale signal (FHS-309)', async () => {
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('tab-tasks-badge').textContent).toBe('1'));
    // Simulate the caller's pending task being marked done elsewhere: the
    // next /today fetch returns 0 pending for the caller member.
    mocks.fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/dashboard/today')) {
        return {
          ok: true,
          json: async () => ({
            callerMemberId: 'm-1',
            members: [
              {
                id: 'm-1',
                displayName: 'Sarah',
                role: 'admin',
                avatarEmoji: null,
                habitsDone: 0,
                habitsTotal: 0,
                streak: 0,
                tasksPending: 0,
                statusText: 'All done',
                starBalance: 0,
                pendingSignup: false,
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    await act(async () => {
      window.dispatchEvent(new Event('fh:dashboard-stale'));
    });
    // Badge only renders when > 0, so it disappears once pending hits 0.
    await waitFor(() => expect(screen.queryByTestId('tab-tasks-badge')).not.toBeInTheDocument());
  });

  it('falls back to the auth email as parent name when no display name is set', async () => {
    authState.user = { email: 'sarah@example.com', id: 'u-1', user_metadata: {} };
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-parent-name').textContent).toBe(
      'sarah@example.com',
    );
  });

  it('uses user_metadata.full_name as the parent name when present', async () => {
    authState.user = {
      email: 'sarah@example.com',
      id: 'u-1',
      user_metadata: { full_name: 'Sarah Khan' },
    };
    renderAt('/t/khans/dashboard');
    fireEvent.click(screen.getByTestId('dashboard-profile-pill'));
    expect(screen.getByTestId('dashboard-profile-parent-name').textContent).toBe('Sarah Khan');
  });
});
