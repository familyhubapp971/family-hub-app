import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-292 — My World habit grid (typed stickers) + rewards shop.

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
    habits: over.habits ?? [
      {
        id: HABIT,
        name: 'Brush teeth',
        description: null,
        color: '#facc15',
        icon: null,
        isBonus: false,
      },
    ],
    stickers: over.stickers ?? [],
    balance: over.balance ?? 0,
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
        json: async () => ({ habitId: HABIT, day: b.day, sticker: b.sticker, stickerValue: 1 }),
      });
    }
    if (init?.method === 'DELETE' && u.includes('/stickers')) {
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    if (init?.method === 'POST' && /\/api\/habits$/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'new',
          name: 'X',
          description: null,
          color: '#facc15',
          icon: null,
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
    if (u.includes('/api/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards: state.rewards, stickerBalance: state.balance }),
      });
    }
    // GET /api/habits
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
afterEach(() => vi.unstubAllGlobals());

describe('<MyWorldTab />', () => {
  it('renders the habit grid + sticker picker + balance', async () => {
    installApi({ balance: 3 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    expect(screen.getByTestId('habit-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('habit-name-' + HABIT).textContent).toContain('Brush teeth');
    expect(screen.getByTestId(`habit-cell-${HABIT}-0`)).toBeInTheDocument();
    expect(screen.getByTestId('sticker-picker')).toBeInTheDocument();
    expect(screen.getByTestId('sticker-balance').textContent).toContain('3');
  });

  it('renders an error state on a failed load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world-error')).toBeInTheDocument());
  });

  it('placing a sticker POSTs the chosen type + day and bumps the balance', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`habit-cell-${HABIT}-0`)).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-0`));
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
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('1'));
  });

  it('places the picked sticker type when a different one is selected', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('sticker-pick-heart')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('sticker-pick-heart'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-1`));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
    );
    expect(JSON.parse((post![1] as RequestInit).body as string).sticker).toBe('heart');
  });

  it('removing a placed sticker DELETEs and drops the balance', async () => {
    installApi({
      balance: 1,
      stickers: [{ habitId: HABIT, day: 0, sticker: 'gold-star', stickerValue: 1 }],
    });
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-cell-${HABIT}-0`).getAttribute('aria-pressed')).toBe('true'),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-0`));
    });
    const del = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'DELETE' && String(u).includes('/stickers'),
    );
    expect(del).toBeDefined();
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('0'));
  });

  it('reverts the cell + balance when the sticker POST fails', async () => {
    const state = installApi({ balance: 0 });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST' && u.includes('/stickers')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      if (u.includes('/api/rewards')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: state.rewards, stickerBalance: state.balance }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          habits: state.habits,
          stickers: state.stickers,
          week: {
            id: WEEK,
            weekNumber: 9,
            year: 2026,
            startDate: '2026-02-23',
            isFinalized: false,
          },
          balance: state.balance,
        }),
      });
    });
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`habit-cell-${HABIT}-0`)).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-0`));
    });
    // Reverts: cell un-pressed + balance back to 0.
    await waitFor(() =>
      expect(screen.getByTestId(`habit-cell-${HABIT}-0`).getAttribute('aria-pressed')).toBe(
        'false',
      ),
    );
    expect(screen.getByTestId('sticker-balance').textContent).toContain('0');
  });

  it('guards against a double-tap on the same cell (one POST)', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`habit-cell-${HABIT}-0`)).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-0`));
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-0`));
    });
    const posts = fetchMock.mock.calls.filter(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/stickers'),
    );
    expect(posts).toHaveLength(1);
  });

  it('disables Buy when the balance is below the reward cost', async () => {
    installApi({ balance: 1 }); // reward costs 2
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeDisabled());
  });

  it('redeems an affordable reward and updates the balance', async () => {
    installApi({ balance: 2 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`reward-buy-${REWARD}`));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/redeem'),
    );
    expect(post).toBeDefined();
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('0'));
  });

  it('adds a habit via the form', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('habit-add')).toBeInTheDocument());
    act(() => {
      fireEvent.click(screen.getByTestId('habit-add'));
    });
    act(() => {
      fireEvent.change(screen.getByTestId('habit-add-name'), { target: { value: 'Read a book' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('habit-add-form'));
    });
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && /\/api\/habits$/.test(String(u)),
    );
    expect(post).toBeDefined();
    expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
      name: 'Read a book',
      isBonus: false,
    });
  });
});
