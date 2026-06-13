import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// FHS-268 — My World tab: habit tracker + rewards shop.

const fetchMock = vi.fn();
const authState: { session: { access_token?: string } | null } = {
  session: { access_token: 'tok-abc' },
};
vi.mock('../../../../../apps/web/src/lib/auth-context', () => ({
  useAuth: () => authState,
}));

import {
  MyWorldTab,
  mondayOfWeek,
  isoDate,
} from '../../../../../apps/web/src/pages/tenant/child/MyWorldTab';
import { TenantProvider } from '../../../../../apps/web/src/lib/tenant-context';

const MEMBER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HABIT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REWARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MONDAY = isoDate(mondayOfWeek(new Date()));

interface ApiState {
  logs: Array<{ habitId: string; logDate: string }>;
  balance: number;
  rewards: Array<{
    id: string;
    name: string;
    description: string | null;
    stickerCost: number;
    icon: string | null;
  }>;
  habits: Array<{
    id: string;
    name: string;
    description: string | null;
    cadence: string;
    targetCount: number;
    color: string;
  }>;
}

function installApi(over: Partial<ApiState> = {}) {
  const state: ApiState = {
    logs: over.logs ?? [],
    balance: over.balance ?? 0,
    habits: over.habits ?? [
      {
        id: HABIT,
        name: 'Brush teeth',
        description: null,
        cadence: 'daily',
        targetCount: 1,
        color: '#facc15',
      },
    ],
    rewards: over.rewards ?? [
      { id: REWARD, name: 'Ice cream', description: null, stickerCost: 2, icon: '🍦' },
    ],
  };
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'PATCH' && u.includes('/log')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ logged: true }) });
    }
    if (init?.method === 'POST' && u.includes('/redeem')) {
      const cost = state.rewards[0]!.stickerCost;
      state.balance -= cost;
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
    // /api/habits
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ habits: state.habits, logs: state.logs }),
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
  it('renders the habit tracker + rewards shop with the sticker balance', async () => {
    installApi({ balance: 3 });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    expect(screen.getByTestId('habit-tracker')).toBeInTheDocument();
    expect(screen.getByTestId(`habit-name-${HABIT}`).textContent).toContain('Brush teeth');
    // 7 day cells for the habit.
    expect(screen.getByTestId(`habit-cell-${HABIT}-${MONDAY}`)).toBeInTheDocument();
    expect(screen.getByTestId('sticker-balance').textContent).toContain('3');
  });

  it('renders an error state on a failed load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world-error')).toBeInTheDocument());
  });

  it('toggling a habit cell PATCHes the log and bumps the balance', async () => {
    installApi({ balance: 0 });
    renderTab();
    await waitFor(() =>
      expect(screen.getByTestId(`habit-cell-${HABIT}-${MONDAY}`)).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId(`habit-cell-${HABIT}-${MONDAY}`));
    });
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(String(patchCall![0])).toContain(`/api/habits/${HABIT}/log`);
    expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({
      memberId: MEMBER,
      date: MONDAY,
      done: true,
    });
    // Optimistic +1 sticker.
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('1'));
    expect(screen.getByTestId(`habit-cell-${HABIT}-${MONDAY}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('disables Buy when the balance is below the reward cost', async () => {
    installApi({ balance: 1 }); // reward costs 2
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-card-${REWARD}`)).toBeInTheDocument());
    expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeDisabled();
  });

  it('redeems an affordable reward and updates the balance', async () => {
    installApi({ balance: 2 }); // reward costs 2
    renderTab();
    await waitFor(() => expect(screen.getByTestId(`reward-buy-${REWARD}`)).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId(`reward-buy-${REWARD}`));
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(String(postCall![0])).toContain(`/api/rewards/${REWARD}/redeem`);
    await waitFor(() => expect(screen.getByTestId('sticker-balance').textContent).toContain('0'));
  });

  it('shows empty states when there are no habits or rewards', async () => {
    installApi({ habits: [], rewards: [] });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('my-world')).toBeInTheDocument());
    expect(screen.getByTestId('habits-empty')).toBeInTheDocument();
    expect(screen.getByTestId('rewards-empty')).toBeInTheDocument();
  });
});
