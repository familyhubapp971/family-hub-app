import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-293 — My World habit tracker (faithful legacy port): week navigator,
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
    if (u.includes('/api/mw/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          savedStickers: state.savedStickers,
          savedCash: state.savedCash,
          currency: 'AED',
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
          cashValue: state.unallocated * 0.5,
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

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/t/khan/child/' + MEMBER]}>
      <Routes>
        <Route
          path="/t/:slug/child/:memberId"
          element={
            <TenantProvider>
              <MyWorldTab memberId={MEMBER} />
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
    // My Stickers grid (sticker types)
    expect(screen.getByTestId('my-sticker-gold-star')).toBeInTheDocument();
    expect(screen.getByTestId('my-sticker-trophy')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByTestId('my-stickers')).toBeInTheDocument());
    expect(screen.getByTestId('rewards-shop')).toBeInTheDocument();
    expect(screen.getByTestId('bankable-week')).toBeInTheDocument();
    expect(screen.getByTestId('your-savings')).toBeInTheDocument();

    // Navigate back to the finalised week.
    await act(async () => {
      fireEvent.click(screen.getByTestId('habit-tracker-week-prev-btn'));
    });

    // Live current-week-only widgets are gone…
    await waitFor(() => expect(screen.queryByTestId('my-stickers')).not.toBeInTheDocument());
    expect(screen.queryByTestId('rewards-shop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bankable-week')).not.toBeInTheDocument();
    expect(screen.queryByTestId('your-savings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('active-investments')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saving-big-rewards')).not.toBeInTheDocument();
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
});
