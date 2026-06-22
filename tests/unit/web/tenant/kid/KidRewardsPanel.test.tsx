import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-364 — the kid's My World money cards: Reward Goals (claim), savings, and
// growing stars. Claiming POSTs to the kid redeem endpoint.

import { KidRewardsPanel } from '../../../../../apps/web/src/pages/tenant/kid/KidRewardsPanel';

const TOKEN = 'kid.jwt';
const fetchMock = vi.fn();
const REWARD = { id: 'rw1', name: 'Ice Cream', description: null, stickerCost: 10, icon: '🍦' };

function mock(opts: {
  rewards?: (typeof REWARD)[];
  balance?: number;
  savedStickers?: number;
  savedCash?: number;
  investments?: Array<Record<string, unknown>>;
  redeemStatus?: number;
}) {
  const {
    rewards = [],
    balance = 0,
    savedStickers = 0,
    savedCash = 0,
    investments = [],
    redeemStatus = 201,
  } = opts;
  fetchMock.mockImplementation((url: string, o?: RequestInit) => {
    const u = String(url);
    if (/\/api\/kid\/rewards\/[^/]+\/redeem/.test(u)) {
      return Promise.resolve({
        ok: redeemStatus < 400,
        status: redeemStatus,
        json: async () => ({ stickerBalance: balance - 10, redemptionId: 'r1' }),
      });
    }
    if (u.includes('/api/kid/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ rewards, stickerBalance: balance }),
      });
    }
    if (u.includes('/api/kid/financial')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ savedStickers, savedCash, currency: 'AED', investments }),
      });
    }
    void o;
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidRewardsPanel />', () => {
  it('shows reward goals, savings, and growing stars', async () => {
    mock({
      rewards: [REWARD],
      balance: 4,
      savedStickers: 6,
      investments: [
        {
          id: 'i1',
          habitName: 'Read',
          habitIcon: '📚',
          investedStickers: 10,
          currentValueStickers: 15,
          currentValue: 7.5,
          daysCompleted: 1,
          daysMissed: 0,
        },
      ],
    });
    render(<KidRewardsPanel kidToken={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('kid-rewards')).toBeInTheDocument());
    expect(screen.getByText('Ice Cream')).toBeInTheDocument();
    // balance 4 < cost 10 → not claimable yet.
    expect(screen.getByText(/more stars to go/)).toBeInTheDocument();
    expect(screen.getByTestId('kid-savings-stars')).toHaveTextContent('6');
    expect(screen.getByTestId('kid-investment')).toBeInTheDocument();
  });

  it('claims an affordable reward via POST redeem', async () => {
    mock({ rewards: [REWARD], balance: 20 });
    render(<KidRewardsPanel kidToken={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('kid-reward-claim-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-reward-claim-rw1'));
    });
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, o]) => /rewards\/rw1\/redeem/.test(String(u)) && (o as RequestInit)?.method === 'POST',
      );
      expect(post).toBeTruthy();
    });
    await waitFor(() =>
      expect(screen.getByTestId('kid-rewards-msg')).toHaveTextContent(/claimed/i),
    );
  });

  it('shows a friendly message when the server says not enough stars (409)', async () => {
    mock({ rewards: [REWARD], balance: 20, redeemStatus: 409 });
    render(<KidRewardsPanel kidToken={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('kid-reward-claim-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-reward-claim-rw1'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('kid-rewards-msg')).toHaveTextContent(/not enough/i),
    );
  });
});
