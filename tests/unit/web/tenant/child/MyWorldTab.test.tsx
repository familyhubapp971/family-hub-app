import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-293: My World habit tracker (faithful legacy port): week navigator,
// Weekly Habits / Analytics tabs, habit cards with the day → sticker
// dialog, add/edit/delete habit, and the rewards shop.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({ useAuth: () => authState }));

import { MyWorldTab } from '../../../../../apps/web/src/pages/tenant/child/MyWorldTab';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HABIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REWARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WEEK = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

interface St {
  weeks: Array<Record<string, unknown>>;
  habits: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
    isBonus: boolean;
  }>;
  stickers: Array<{ habitId: string; day: number; sticker: string; stickerValue: number }>;
  balance: number;
  savedStickers: number;
  savedCash: number;
  unallocated: number;
  stickerRate: number;
  rewards: Array<{
    id: string;
    name: string;
    description: string | null;
    stickerCost: number;
    icon: string | null;
  }>;
}

function installApi(over: Partial<St> = {}) {
  const state: St = {
    weeks: over.weeks ?? [
      {
        id: WEEK,
        weekNumber: 9,
        year: 2026,
        startDate: '2026-02-23',
        isFinalized: false,
        carriedOverStickers: 0,
        carriedOverCash: 0,
        retrievedStickers: 0,
        retrievedCash: 0,
      },
    ],
    habits: over.habits ?? [
      {
        id: HABIT,
        name: 'Brush teeth',
        description: null,
        color: 'bg-yellow-400',
        icon: 'star',
        isBonus: false,
      },
    ],
    stickers: over.stickers ?? [],
    balance: over.balance ?? 0,
    savedStickers: over.savedStickers ?? 0,
    savedCash: over.savedCash ?? 0,
    unallocated: over.unallocated ?? 0,
    stickerRate: over.stickerRate ?? 0.5,
    rewards: over.rewards ?? [
      { id: REWARD, name: 'Ice cream', description: null, stickerCost: 2, icon: '🍦' },
    ],
  };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST' && u.includes('/stickers')) {
      const b = JSON.parse(init.body as string) as { day: number; sticker: string };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ habitId: HABIT, ...b, stickerValue: 1 }),
      });
    }
    if (init?.method === 'DELETE' && u.includes('/stickers')) {
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (init?.method === 'POST' && /\/api\/habits$/.test(u)) {
      // The real endpoint returns the created habit object DIRECTLY (not wrapped).
      const b = JSON.parse(init.body as string) as { name: string; color?: string; icon?: string };
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          name: b.name,
          description: null,
          color: b.color ?? 'bg-yellow-400',
          icon: b.icon ?? 'star',
          isBonus: false,
        }),
      });
    }
    if (init?.method === 'POST' && u.includes('/redeem')) {
      state.balance -= state.rewards[0]!.stickerCost;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ stickerBalance: state.balance, redemptionId: 'r1' }),
      });
    }
    // FHS-392: RewardRequestsPanel in the sidebar calls this endpoint.
    if (u.includes('/api/mw/redemption-requests')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ requests: [] }),
      });
    }
    if (u.includes('/api/members')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ callerRole: 'admin' }),
      });
    }
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          savedStickers: state.savedStickers,
          savedCash: state.savedCash,
          currency: 'AED',
          stickerRate: state.stickerRate,
          stickerRateMinor: Math.round(state.stickerRate * 100),
        }),
      });
    }
    if (u.includes('/api/mw/weeks') && u.includes('/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          weekId: WEEK,
          totalStickers: 0,
          unallocatedStickers: state.unallocated,
          allocatedStickers: 0,
          cashValue: state.unallocated * state.stickerRate,
        }),
      });
    }
    if (u.includes('/api/mw/analytics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ stickersPerWeek: [], habitStats: [] }),
      });
    }
    if (u.includes('/api/mw/weeks') && u.includes('/actions')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
    }
    if (u.includes('/api/mw/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: state.weeks }) });
    }
    if (u.includes('/api/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: state.rewards, stickerBalance: state.balance }),
      });
    }
    // GET /api/habits?weekId=
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        habits: state.habits,
        stickers: state.stickers,
        week: { id: WEEK, weekNumber: 9, year: 2026, startDate: '2026-02-23', isFinalized: false },
        balance: state.balance,
      }),
    });
  });
  return state;
}

function renderTab(isAdmin = true) {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <MyWorldTab memberId={MEMBER} isAdmin={isAdmin} />
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<MyWorldTab /> (legacy habit tracker)', () => {
  it('renders the week navigator, summary, habit card + rewards balance', async () => {
    installApi({ balance: 3 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 9, 2026');
    expect(screen.getByTestId('habit-tracker-total-display').textContent).toContain('0/7');
    expect(screen.getByTestId(`habit-card-title-${HABIT}`).textContent).toContain('Brush teeth');
    expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument();
    expect(screen.getByTestId('sticker-balance').textContent).toContain('3');
  });

  it('shows the no-data state when there are no weeks', async () => {
    installApi({ weeks: [] });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('habit-tracker-no-data')).toBeInTheDocument());
  });

  it('switches to the Analytics tab', async () => {
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-tab-analytics')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('habit-tracker-tab-analytics'));
    });
    // The Analytics sub-tab now renders the real AnalyticsView (FHS-298),
    // which loads then shows its summary + chart + leaderboard.
    await waitFor(() => expect(screen.getByTestId('analytics-view')).toBeInTheDocument());
  });

  it('placing a sticker via the day dialog POSTs the chosen type', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    await waitFor(() => expect(screen.getByTestId('habit-day-sticker-dialog')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-day-sticker-option-gold-star'));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
    );
    expect(post).toBeDefined();
    expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
      memberId: MEMBER,
      weekId: WEEK,
      day: 0,
      sticker: 'gold-star',
    });
    // Placing a sticker must refresh the dependent cards: investments are
    // re-fetched (once on mount + once after the change).
    await waitFor(() => {
      const invCalls = fetchMock.mock.calls.filter(([u]) =>
        String(u).includes('/api/mw/financial/investments'),
      ).length;
      expect(invCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('adds a habit via the add dialog', async () => {
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-add-habit-btn')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('habit-tracker-add-habit-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('habit-add-title-input')).toBeInTheDocument());
    act(() => {
      fireEvent.change(screen.getByTestId('habit-add-title-input'), {
        target: { value: 'Read a book' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-add-submit-btn'));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && /\/api\/habits$/.test(String(u)),
    );
    expect(post).toBeDefined();
    expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
      name: 'Read a book',
    });
    // The created habit must appear in the list (regression: the UI used to read
    // a wrongly-wrapped response, so the habit saved but never showed + the
    // dialog stayed open).
    await waitFor(() =>
      expect(
        screen.getByTestId('habit-card-title-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee').textContent,
      ).toContain('Read a book'),
    );
    expect(screen.queryByTestId('habit-add-title-input')).toBeNull();
  });

  it('disables Buy when the balance is below the reward cost', async () => {
    installApi({ balance: 1 }); // reward costs 2
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeDisabled());
  });

  it('shows the Your Savings + Bankable cards with the family currency', async () => {
    installApi({ savedStickers: 10, savedCash: 5, unallocated: 4 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('your-savings')).toBeInTheDocument());
    // Total value = 5 cash + 10*0.5 = 10.00, in AED
    expect(screen.getByTestId('your-savings').textContent).toContain('AED');
    expect(screen.getByTestId('bankable-week')).toBeInTheDocument();
  });

  // FHS-512: the total-value conversion must use THIS child's configured
  // rate (from GET /mw/financial/savings), never a hardcoded 0.5. A rate of
  // 0.5 would show 10.00; the configured 1.25 rate must show 17.50.
  it('Your Savings total value uses the configured sticker rate, not a hardcoded 0.5', async () => {
    installApi({ savedStickers: 10, savedCash: 5, unallocated: 4, stickerRate: 1.25 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('your-savings')).toBeInTheDocument());
    // Total value = 5 cash + 10*1.25 = 17.50: NOT 10.00 (the old fixed-0.5 result).
    expect(screen.getByTestId('your-savings').textContent).toContain('17.50');
    expect(screen.getByTestId('your-savings').textContent).not.toContain('10.00');
  });

  it('hides live current-week widgets when viewing a finalised past week (FHS-316)', async () => {
    const PREV_WEEK = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    installApi({
      savedStickers: 10,
      savedCash: 5,
      weeks: [
        {
          id: PREV_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    renderTab();
    // Current week: all the live widgets are present.
    await waitFor(() => expect(screen.getByTestId('rewards-shop')).toBeInTheDocument());
    expect(screen.getByTestId('bankable-week')).toBeInTheDocument();
    expect(screen.getByTestId('your-savings')).toBeInTheDocument();

    // Navigate back to the finalised week.
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });

    // Live current-week-only widgets are gone…
    await waitFor(() => expect(screen.queryByTestId('rewards-shop')).not.toBeInTheDocument());
    expect(screen.queryByTestId('bankable-week')).not.toBeInTheDocument();
    expect(screen.queryByTestId('your-savings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('active-investments')).not.toBeInTheDocument();
    // …but the week record itself still renders.
    expect(screen.getByTestId('habit-tracker-week-label')).toBeInTheDocument();
  });

  it('redeeming an affordable reward updates the balance', async () => {
    installApi({ balance: 5 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`reward-buy-${REWARD}`));
    });
    // reward costs 2 → 5 - 2 = 3
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('3'));
  });

  it('shows the deductible tag on an active investment and an admin can flip it (FHS-378)', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    const settingsCalls: string[] = [];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments/') && u.includes('/settings')) {
        settingsCalls.push(u);
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: 'inv1' }) });
      }
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'inv1',
                habitId: HABIT,
                habitName: 'Read a book',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 5,
                currentValueStickers: 10,
                daysCompleted: 2,
                daysMissed: 1,
                deductible: false,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab(true);
    await waitFor(() => expect(screen.getByTestId('investment-card-inv1')).toBeInTheDocument());
    expect(screen.getByTestId('investment-mode-inv1')).toHaveTextContent('No-penalty');
    // FHS-406: the invested habit shows its "Invested · 5x" tag (now in-flow
    // above the day grid instead of an absolute badge that overlapped the cells).
    // FHS-534: this investment has no `coefficient` field (legacy record),
    // so the badge falls back to the historical default of 5x.
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).toHaveTextContent('5x');
    await act(async () => {
      fireEvent.click(screen.getByTestId('investment-toggle-inv1'));
    });
    await waitFor(() => expect(settingsCalls.length).toBe(1));
    expect(settingsCalls[0]).toContain('/api/mw/financial/investments/inv1/settings');
  });

  it('shows the investment\'s real coefficient on the "Invested · Nx" badge (FHS-534)', async () => {
    installApi();
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/financial/investments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            investments: [
              {
                id: 'inv1',
                habitId: HABIT,
                habitName: 'Brush teeth',
                habitIcon: 'star',
                investedStickers: 10,
                originalInvestedStickers: 10,
                currentValue: 5,
                currentValueStickers: 12,
                daysCompleted: 2,
                daysMissed: 0,
                deductible: true,
                coefficient: 3,
              },
            ],
          }),
        });
      }
      return base(url, init);
    });
    renderTab(true);
    await waitFor(() => expect(screen.getByTestId('investment-card-inv1')).toBeInTheDocument());
    // A coefficient-3 investment shows "3x", never the hardcoded "5x".
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).toHaveTextContent('3x');
    expect(screen.getByTestId(`habit-card-invested-badge-${HABIT}`)).not.toHaveTextContent('5x');
  });

  it('shows the Close Week banner only from the last day of the week (FHS-319)', async () => {
    // Default week starts Mon 2026-02-23 → its last day (Sunday) is 2026-03-01.
    // Fake only Date so async fetch/waitFor still run on real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00')); // Sunday = last day
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('my-world-close-week-banner')).toBeInTheDocument(),
    );
  });

  it('hides the Close Week banner mid-week (FHS-319)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-25T10:00:00')); // Wednesday, within the week
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('habit-tracker-week-label')).toBeInTheDocument());
    expect(screen.queryByTestId('my-world-close-week-banner')).not.toBeInTheDocument();
  });

  it('hides the Close Week banner from a normal user even on the last day (FHS-336)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00')); // Sunday: admin would see the banner
    installApi();
    renderTab(false); // normal user (not admin)
    await waitFor(() => expect(screen.getByTestId('habit-tracker-week-label')).toBeInTheDocument());
    expect(screen.queryByTestId('my-world-close-week-banner')).not.toBeInTheDocument();
  });

  it('locks a week that has not started yet: blurred cards, disabled day cells, no edits (FHS-484)', async () => {
    // Default week fixture starts Mon 2026-02-23; freeze "now" a week earlier
    // so that week reads as a future week (e.g. this week was finalized early).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-16T10:00:00'));
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());

    expect(screen.getByTestId('habit-tracker-week-future-badge')).toHaveTextContent('Not Started');
    expect(screen.getByTestId('habit-tracker-future-week-lock')).toBeInTheDocument();
    expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeDisabled();

    // Clicking a locked day cell doesn't open the sticker picker.
    fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    expect(screen.queryByTestId('habit-day-sticker-dialog')).not.toBeInTheDocument();

    // Admin-only "Add habit" affordance is hidden too: nothing is editable.
    expect(screen.queryByTestId('habit-tracker-add-habit-btn')).not.toBeInTheDocument();
  });

  it('does not lock the live (current) week (FHS-484)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-25T10:00:00')); // Wednesday, within the week
    installApi();
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());

    expect(screen.queryByTestId('habit-tracker-week-future-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('habit-tracker-future-week-lock')).not.toBeInTheDocument();
    expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeEnabled();
  });

  it('hides Add Habit + per-habit edit/delete from a normal user (FHS-342)', async () => {
    installApi();
    renderTab(false); // normal user (not admin)
    await waitFor(() =>
      expect(screen.getByTestId(`habit-card-title-${HABIT}`)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('habit-tracker-add-habit-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`habit-card-edit-btn-${HABIT}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`habit-card-delete-btn-${HABIT}`)).not.toBeInTheDocument();
  });

  it('shows Add Habit + edit/delete to an admin (FHS-342)', async () => {
    installApi();
    renderTab(true);
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-add-habit-btn')).toBeInTheDocument(),
    );
    expect(screen.getByTestId(`habit-card-edit-btn-${HABIT}`)).toBeInTheDocument();
    expect(screen.getByTestId(`habit-card-delete-btn-${HABIT}`)).toBeInTheDocument();
  });

  it('add-habit with an empty name does not POST', async () => {
    installApi();
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-add-habit-btn')).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId('habit-tracker-add-habit-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('habit-add-title-input')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-add-submit-btn'));
    });
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === 'POST' && /\/api\/habits$/.test(String(u)),
      ),
    ).toBe(false);
  });

  // FHS-392: Reward Requests sidebar in parent/admin mode
  it('renders the reward-requests sidebar for an admin parent (FHS-392)', async () => {
    installApi();
    renderTab(true /* isAdmin */);
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    // Sidebar section must be present for parent/admin
    expect(screen.getByTestId('reward-requests-sidebar')).toBeInTheDocument();
    // The panel itself renders inside (even empty-state is fine)
    expect(screen.getByTestId('reward-requests-panel')).toBeInTheDocument();
  });

  it('does NOT render the reward-requests sidebar in kid (readOnly) mode (FHS-392)', async () => {
    installApi();
    // Kid mode uses kidToken prop: readOnly=true suppresses the sidebar.
    // Kid API uses /api/kid/* paths so the data may not load, but the
    // sidebar guard fires before data (readOnly branch).
    render(
      <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
        <Routes>
          <Route
            path="/t/:slug/child/:memberId"
            element={
              <TenantProvider>
                <MyWorldTab kidToken="kid.jwt.tok" />
              </TenantProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    // Wait for the component to mount and settle (loading or no-data)
    await waitFor(() =>
      expect(
        screen.queryByTestId('habit-tracker-loading') ??
          screen.queryByTestId('habit-tracker-no-data') ??
          screen.queryByTestId('my-world'),
      ).toBeInTheDocument(),
    );
    // The sidebar must never appear in kid/readOnly mode
    expect(screen.queryByTestId('reward-requests-sidebar')).not.toBeInTheDocument();
  });

  it('reverts the cell when the sticker POST fails', async () => {
    installApi({ balance: 0 });
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).includes('/stickers')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return base(url, init);
    });
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    await waitFor(() => expect(screen.getByTestId('habit-day-sticker-dialog')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-day-sticker-option-gold-star'));
    });
    // POST failed → optimistic sticker reverts; cell ends up empty again.
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`).getAttribute('aria-pressed')).toBe(
        'false',
      ),
    );
  });

  // ── FHS-399: Finalized week kid view ────────────────────────────────────

  // Two-week setup: week 9 is the live current week (habits load at mount);
  // week 8 is finalized and lazy-loads when the user navigates back.
  // This mirrors the real app flow where actions are only fetched via the
  // lazy-load effect (which fires when habits.length === 0 for a non-active week).
  const FINALIZED_WEEK = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  // 5 stickers placed across days 0-4 on the finalized week
  const FINALIZED_STICKERS = [0, 1, 2, 3, 4].map((day) => ({
    habitId: HABIT,
    day,
    sticker: 'gold-star',
    stickerValue: 1,
  }));

  type TestAction = {
    id: number;
    weekId: string;
    actionType: string;
    stickersUsed: number | null;
    cashAmount: number | null;
    rewardName: string | null;
    habitId: string | null;
    habitName: string | null;
    createdAt: string;
  };

  const DEFAULT_FINALIZED_ACTIONS: TestAction[] = [
    {
      id: 1,
      weekId: FINALIZED_WEEK,
      actionType: 'save',
      stickersUsed: 3,
      cashAmount: 1.5,
      rewardName: null,
      habitId: null,
      habitName: null,
      createdAt: '2026-02-22T00:00:00Z',
    },
    {
      id: 2,
      weekId: FINALIZED_WEEK,
      actionType: 'invest',
      stickersUsed: 2,
      cashAmount: 1.0,
      rewardName: null,
      habitId: HABIT,
      habitName: 'Brush teeth',
      createdAt: '2026-02-22T00:00:00Z',
    },
  ];

  function installFinalizedWeekApi(actions: TestAction[] = DEFAULT_FINALIZED_ACTIONS) {
    // Base install: two weeks: week 8 finalized, week 9 current
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 3,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });

    // Extend the base mock to handle the finalized week's habits + actions
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      // Finalized week actions
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ actions }),
        });
      }
      // Habits for the finalized week: 5 stickers across days 0-4
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: FINALIZED_STICKERS,
            balance: 5,
          }),
        });
      }
      return base(url, init);
    });
  }

  // Navigate to the finalized (previous) week and wait for it to load
  async function navigateToFinalizedWeek() {
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-prev-btn')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });
    // Wait for the finalized week label to appear
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 8'),
    );
  }

  it('FHS-399: shows the friendly finished-week banner on a finalized week', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-banner')).toBeInTheDocument());
    // Friendly copy: no "viewing past records"
    expect(screen.getByTestId('finalized-week-banner').textContent).toContain(
      'looking at a finished week',
    );
    expect(screen.getByTestId('finalized-week-banner').textContent).not.toContain(
      'viewing past records',
    );
  });

  it('FHS-399: shows the "What I Did That Week" summary card with stars + cash', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    // Stars earned section: 5 stickers * 0.5 = 2.50
    const earned = screen.getByTestId('finalized-stars-earned');
    expect(earned.textContent).toContain('5');
    expect(earned.textContent).toContain('2.50');
  });

  it('FHS-399: shows the saved + planted breakdown in the summary card', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId('finalized-stars-allocation')).toBeInTheDocument(),
    );
    // save action → "Saved 3 stars"
    expect(screen.getByTestId('finalized-saved-stars').textContent).toContain('3');
    // invest action → "Planted 2 stars"
    expect(screen.getByTestId('finalized-planted-stars').textContent).toContain('2');
  });

  it('FHS-399: shows "Great job!" at ≥50% and neutral message at <50%', async () => {
    // Default fixture: 5 stickers / 7 possible = 71% → "Great job!"
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-completion')).toBeInTheDocument());
    expect(screen.getByTestId('finalized-completion-pct').textContent).toContain('%');
    expect(screen.getByTestId('finalized-completion-message').textContent).toContain('Great job');
  });

  it('FHS-399: shows neutral message at 0% (kid skipped the week)', async () => {
    // Zero stickers on the finalized week → performance=0 from the lazy-load rebuild
    const base2 = fetchMock.getMockImplementation()!;
    // Call installApi first to set up the weeks array, then override habits for FINALIZED_WEEK
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const base3 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: [], // zero stickers
            balance: 0,
          }),
        });
      }
      return base3(url, init);
    });
    void base2; // suppress unused warning
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-completion')).toBeInTheDocument());
    expect(screen.getByTestId('finalized-completion-message').textContent).not.toContain(
      'Great job',
    );
    expect(screen.getByTestId('finalized-completion-message').textContent).toContain(
      'this week went',
    );
  });

  it('FHS-399: each habit card shows PROGRESS THAT WEEK X/target on a finalized week', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-finalized-progress-${HABIT}`)).toBeInTheDocument(),
    );
    // 5 stickers / target=7 → "5/7"
    expect(screen.getByTestId(`habit-finalized-progress-${HABIT}`).textContent).toMatch(/5.*7/);
  });

  it('FHS-399 #1: bonus habit (target=3, 2 stickers) shows 2/3 in the pill', async () => {
    const BONUS_HABIT = 'bbbbbbbb-cccc-4bbb-8bbb-bbbbbbbbbbbc';
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const baseB = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: BONUS_HABIT,
                name: 'Bonus habit',
                description: null,
                color: 'bg-lime-400',
                icon: 'star',
                isBonus: true,
                target: 3, // bonus habit with lower target
              },
            ],
            stickers: [
              { habitId: BONUS_HABIT, day: 0, sticker: 'gold-star', stickerValue: 1 },
              { habitId: BONUS_HABIT, day: 1, sticker: 'gold-star', stickerValue: 1 },
            ],
            balance: 2,
          }),
        });
      }
      return baseB(url, init);
    });
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-finalized-progress-${BONUS_HABIT}`)).toBeInTheDocument(),
    );
    // Must show 2/3, NOT 2/7
    const pill = screen.getByTestId(`habit-finalized-progress-${BONUS_HABIT}`);
    expect(pill.textContent).toContain('2/3');
    expect(pill.textContent).not.toContain('2/7');
  });

  it('FHS-399: day cells do not trigger a sticker POST on a finalized week (kid readOnly)', async () => {
    installFinalizedWeekApi();
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    expect(screen.queryByTestId('habit-day-sticker-dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
      ),
    ).toBe(false);
  });

  it('FHS-399 #5: admin on a finalized week: clicking a cell fires no POST and opens no dialog', async () => {
    // Admins are also read-only on finalized weeks (canEdit=false when week.isFinalized)
    installFinalizedWeekApi();
    renderTab(true /* isAdmin */);
    await navigateToFinalizedWeek();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-day-cell-${HABIT}-0`)).toBeInTheDocument(),
    );
    act(() => {
      fireEvent.click(screen.getByTestId(`habit-day-cell-${HABIT}-0`));
    });
    expect(screen.queryByTestId('habit-day-sticker-dialog')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
      ),
    ).toBe(false);
  });

  it('FHS-399 #6: carriedOver-only path: actions=[] + carriedOverStickers=5 → Saved shown, Planted absent', async () => {
    installApi({
      weeks: [
        {
          id: FINALIZED_WEEK,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 5,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const baseC = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/mw/weeks') && u.includes(FINALIZED_WEEK) && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      if (u.includes('/api/habits') && u.includes(FINALIZED_WEEK) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: FINALIZED_STICKERS,
            balance: 5,
          }),
        });
      }
      return baseC(url, init);
    });
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('finalized-saved-stars')).toBeInTheDocument());
    // carriedOver=5 maps to effectiveSaved=5
    expect(screen.getByTestId('finalized-saved-stars').textContent).toContain('5');
    // No invest actions → planted absent
    expect(screen.queryByTestId('finalized-planted-stars')).not.toBeInTheDocument();
  });

  it('FHS-399 #7: navigating across two finalized weeks updates finalized-stars-earned', async () => {
    // Three weeks: wk A (finalized, 3 stars), wk B (finalized, 7 stars), wk C (current, 0 stars)
    const WEEK_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
    const WEEK_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc0';
    installApi({
      weeks: [
        {
          id: WEEK_A,
          weekNumber: 7,
          year: 2026,
          startDate: '2026-02-09',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK_B,
          weekNumber: 8,
          year: 2026,
          startDate: '2026-02-16',
          isFinalized: true,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
        {
          id: WEEK,
          weekNumber: 9,
          year: 2026,
          startDate: '2026-02-23',
          isFinalized: false,
          carriedOverStickers: 0,
          carriedOverCash: 0,
          retrievedStickers: 0,
          retrievedCash: 0,
        },
      ],
    });
    const stickersA = [0, 1, 2].map((d) => ({
      habitId: HABIT,
      day: d,
      sticker: 'gold-star',
      stickerValue: 1,
    }));
    const stickersB = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      habitId: HABIT,
      day: d,
      sticker: 'gold-star',
      stickerValue: 1,
    }));
    const baseD = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      // Actions for both finalized weeks
      if (u.includes('/api/mw/weeks') && u.includes('/actions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ actions: [] }) });
      }
      // Habits for week A → 3 stickers
      if (u.includes('/api/habits') && u.includes(WEEK_A) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: stickersA,
            balance: 3,
          }),
        });
      }
      // Habits for week B → 7 stickers
      if (u.includes('/api/habits') && u.includes(WEEK_B) && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            habits: [
              {
                id: HABIT,
                name: 'Brush teeth',
                description: null,
                color: 'bg-yellow-400',
                icon: 'star',
                isBonus: false,
              },
            ],
            stickers: stickersB,
            balance: 7,
          }),
        });
      }
      return baseD(url, init);
    });
    renderTab();
    // Navigate to wk B (one back from current wk C)
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-prev-btn')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 8'),
    );
    await waitFor(() => expect(screen.getByTestId('finalized-stars-earned')).toBeInTheDocument());
    expect(screen.getByTestId('finalized-stars-earned').textContent).toContain('7');

    // Navigate to wk A (two back)
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('habit-tracker-week-label').textContent).toContain('Week 7'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('finalized-stars-earned').textContent).toContain('3'),
    );
    // Must not still show 7 (confirms the card updates per week)
    expect(screen.getByTestId('finalized-stars-earned').textContent).not.toContain('= AED 3.50');
    // 3 stars * 0.5 = 1.50
    expect(screen.getByTestId('finalized-stars-earned').textContent).toContain('1.50');
  });

  it('FHS-399: omits the planted section when only save actions were recorded', async () => {
    installFinalizedWeekApi([DEFAULT_FINALIZED_ACTIONS[0]!]);
    renderTab();
    await navigateToFinalizedWeek();
    await waitFor(() => expect(screen.getByTestId('finalized-week-summary')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('finalized-saved-stars')).toBeInTheDocument());
    expect(screen.queryByTestId('finalized-planted-stars')).not.toBeInTheDocument();
  });
});
