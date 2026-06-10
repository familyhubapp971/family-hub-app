import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { DashboardTodayResponse } from '@familyhub/shared';

// FHS-228 / FHS-263 — TodayTabPanel. Loading / error / empty / populated
// paths, the request shape (Authorization + x-tenant-slug), and the
// redesigned layout: snapshot row, stat-rich member cards (habit ring,
// streak, status, child link), goals bars, and the activity feed.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import { TodayTabPanel } from '../../../../../apps/web/src/pages/tenant/dashboard/TodayTabPanel';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

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

function makeResponse(overrides: Partial<DashboardTodayResponse> = {}): DashboardTodayResponse {
  return {
    date: '2026-05-03',
    greetingName: 'Sarah',
    members: [],
    counts: { members: 0, habits: 0, rewards: 0, tasksDoneToday: 0, mealsPlanned: 0 },
    goals: [],
    recentActivity: [],
    ...overrides,
  };
}

function mockJson(body: DashboardTodayResponse, ok = true, statusCode = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status: statusCode, json: async () => body });
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

  it('renders empty states when the family has no members, goals, or activity', async () => {
    mockJson(makeResponse());
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.getByTestId('today-members-empty')).toBeInTheDocument();
    expect(screen.getByTestId('today-goals-empty')).toBeInTheDocument();
    expect(screen.getByTestId('today-activity-empty')).toBeInTheDocument();
    // Snapshot still renders with zeros.
    expect(screen.getByTestId('today-snapshot-tasks').textContent).toContain('0');
  });

  it('renders the snapshot row from the expanded counts + kids habits', async () => {
    mockJson(
      makeResponse({
        members: [
          {
            id: 'm2',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            habitsDone: 2,
            habitsTotal: 3,
            streak: 4,
            tasksPending: 0,
            statusText: '2/3 habits',
          },
        ],
        counts: { members: 1, habits: 3, rewards: 0, tasksDoneToday: 5, mealsPlanned: 2 },
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.getByTestId('today-snapshot-habits').textContent).toContain('2/3');
    expect(screen.getByTestId('today-snapshot-tasks').textContent).toContain('5');
    expect(screen.getByTestId('today-snapshot-meals').textContent).toContain('2');
  });

  it('renders a clickable, stat-rich card for a child and a task card for an adult', async () => {
    mockJson(
      makeResponse({
        members: [
          {
            id: 'm1',
            displayName: 'Sarah Khan',
            role: 'admin',
            avatarEmoji: '👩',
            habitsDone: 0,
            habitsTotal: 0,
            streak: 0,
            tasksPending: 2,
            statusText: '2 tasks left',
          },
          {
            id: 'm2',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            habitsDone: 2,
            habitsTotal: 3,
            streak: 4,
            tasksPending: 1,
            statusText: '2/3 habits',
          },
        ],
        counts: { members: 2, habits: 3, rewards: 0, tasksDoneToday: 1, mealsPlanned: 0 },
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());

    // Adult: task card, role badge, not a link.
    expect(screen.getByTestId('today-member-0-name').textContent).toBe('Sarah Khan');
    expect(screen.getByTestId('today-member-0-role').textContent?.toLowerCase()).toContain('admin');
    expect(screen.getByTestId('today-member-0-tasks').textContent).toBe('2');
    expect(screen.queryByTestId('today-member-0-link')).not.toBeInTheDocument();

    // Child: clickable into their world, with streak + status + ring.
    expect(screen.getByTestId('today-member-1-name').textContent).toBe('Iman');
    expect(screen.getByTestId('today-member-1-link').getAttribute('href')).toBe(
      '/t/khans/child/m2',
    );
    expect(screen.getByTestId('today-member-1-streak').textContent).toContain('4');
    expect(screen.getByTestId('today-member-1-status').textContent).toBe('2/3 habits');
    expect(screen.getByLabelText('2 of 3 habits done')).toBeInTheDocument();
  });

  it('hides the streak for a child with a zero streak', async () => {
    mockJson(
      makeResponse({
        members: [
          {
            id: 'm2',
            displayName: 'Iman',
            role: 'child',
            avatarEmoji: null,
            habitsDone: 0,
            habitsTotal: 3,
            streak: 0,
            tasksPending: 0,
            statusText: '0/3 habits',
          },
        ],
        counts: { members: 1, habits: 3, rewards: 0, tasksDoneToday: 0, mealsPlanned: 0 },
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());
    expect(screen.queryByTestId('today-member-0-streak')).not.toBeInTheDocument();
  });

  it('renders up to 3 goal bars (with a percentage) and the activity feed', async () => {
    mockJson(
      makeResponse({
        goals: [
          { id: 'g1', label: 'Hajj fund', progress: 250, target: 1000 },
          { id: 'g2', label: 'New bikes', progress: 60, target: 300 },
          { id: 'g3', label: 'Open ended', progress: 40, target: null },
          { id: 'g4', label: 'Fourth — should not render', progress: 1, target: 2 },
        ],
        recentActivity: [
          {
            id: 'a1',
            actor: 'Sarah',
            action: 'completed a habit',
            timestamp: '2026-05-03T08:00:00.000Z',
          },
          {
            id: 'a2',
            actor: null,
            action: 'family created',
            timestamp: '2026-05-03T07:00:00.000Z',
          },
        ],
      }),
    );
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(screen.getByTestId('today-ready')).toBeInTheDocument());

    expect(screen.getByTestId('today-goal-0').textContent).toContain('Hajj fund');
    expect(screen.getByTestId('today-goal-0').textContent).toContain('25%');
    expect(screen.getByTestId('today-goal-2').textContent).toContain('Open ended');
    expect(screen.queryByTestId('today-goal-3')).not.toBeInTheDocument(); // capped at 3

    expect(screen.getByTestId('today-activity-0').textContent).toContain('Sarah');
    expect(screen.getByTestId('today-activity-0').textContent).toContain('completed a habit');
    expect(screen.getByTestId('today-activity-1').textContent).toContain('family created');
  });

  it('passes the tenant slug + bearer token on the request', async () => {
    mockJson(makeResponse());
    renderAt('/t/khans/dashboard');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3001/api/dashboard/today');
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
