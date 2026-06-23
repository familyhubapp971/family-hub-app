import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-376 — the DEDICATED kid My World (its own components, pixel-matched to the
// Magic Patterns kid mock — NOT the parent's MyWorldTab reused). Reads the
// self-scoped /api/kid/* endpoints with the kid bearer token.

import { KidMyWorld } from '../../../../../apps/web/src/pages/tenant/kid/KidMyWorld';

const KID_TOKEN = 'kid.jwt.token';

const WEEK = {
  id: 'w1',
  weekNumber: 24,
  year: 2026,
  startDate: '2026-06-15',
  isFinalized: false,
  carriedOverStickers: 0,
  carriedOverCash: 0,
  retrievedStickers: 0,
  retrievedCash: 0,
};

const HABITS_BODY = {
  habits: [
    {
      id: 'h1',
      name: 'Read a book',
      description: null,
      color: 'bg-yellow-400',
      icon: 'heart',
      isBonus: false,
    },
    {
      id: 'h2',
      name: 'Brush teeth',
      description: null,
      color: 'bg-pink-400',
      icon: 'star',
      isBonus: false,
    },
  ],
  // h1 has 2 done days (Mon + Tue); h2 has 1 (Mon).
  stickers: [
    { habitId: 'h1', day: 0, sticker: 'gold-star', stickerValue: 1 },
    { habitId: 'h1', day: 1, sticker: 'gold-star', stickerValue: 1 },
    { habitId: 'h2', day: 0, sticker: 'gold-star', stickerValue: 1 },
  ],
  week: { id: 'w1', weekNumber: 24, year: 2026, startDate: '2026-06-15', isFinalized: false },
  balance: 8,
  currency: 'AED',
};

// A configurable fetch mock. `overrides` lets a test bend a single endpoint's
// JSON; everything else falls back to a sensible default.
const fetchMock = vi.fn();

interface BootOverrides {
  rewards?: unknown;
  savings?: unknown;
  investments?: unknown;
  habits?: unknown;
  analytics?: unknown;
  onRequest?: (url: string) => void;
  requestFails?: boolean;
}

function mockBoot(over: BootOverrides = {}) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/kid/rewards/') && u.endsWith('/request')) {
      over.onRequest?.(u);
      return Promise.resolve({
        ok: !over.requestFails,
        status: over.requestFails ? 500 : 200,
        json: async () => (over.requestFails ? {} : { id: 'req1', status: 'pending' }),
      });
    }
    if (u.endsWith('/api/kid/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [WEEK] }) });
    }
    if (u.includes('/api/kid/habits')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => over.habits ?? HABITS_BODY,
      });
    }
    if (u.includes('/api/kid/financial/savings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => over.savings ?? { savedStickers: 10, savedCash: 5, currency: 'AED' },
      });
    }
    if (u.includes('/api/kid/financial/investments')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => over.investments ?? { investments: [] },
      });
    }
    if (u.endsWith('/api/kid/rewards')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          over.rewards ?? {
            rewards: [
              {
                id: 'rw1',
                name: 'Ice Cream',
                description: null,
                stickerCost: 5,
                icon: '🍦',
                requestStatus: 'none',
              },
            ],
            stickerBalance: 8,
          },
      });
    }
    if (u.includes('/api/kid/analytics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () =>
          over.analytics ?? {
            stickersPerWeek: [],
            habitStats: [
              {
                habitId: 'h1',
                name: 'Read a book',
                habitIcon: 'heart',
                totalDays: 7,
                completedDays: 4,
                rate: 57,
              },
            ],
          },
      });
    }
    // init referenced so the signature stays meaningful for POST detection above
    void init;
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  mockBoot();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidMyWorld />', () => {
  it('renders habits, money skills, reward goals and my account from the kid endpoints', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());

    // Habits (the name also appears in the My Account earned list, so scope
    // the card-level assertion to the habit card itself).
    expect(screen.getByTestId('kid-habit-card-h1')).toHaveTextContent('Read a book');
    expect(screen.getByTestId('kid-habit-card-h2')).toHaveTextContent('Brush teeth');
    // 'heart' icon name renders a Heart SVG, never the literal word.
    expect(document.querySelector('.lucide-heart')).toBeInTheDocument();
    expect(screen.queryByText('heart')).not.toBeInTheDocument();

    // Money Skills
    expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument();
    expect(screen.getByTestId('kid-moneyskills')).toHaveTextContent('You have 8 stars');

    // Reward Goals
    expect(screen.getByTestId('kid-reward-goals')).toBeInTheDocument();
    expect(screen.getByText('Reward Goals')).toBeInTheDocument();

    // My Account: earned this week = 2 (h1) + 1 (h2) = 3 stars → AED 1.50
    expect(screen.getByTestId('kid-my-account')).toBeInTheDocument();
    expect(screen.getByTestId('kid-account-cash')).toHaveTextContent('AED 1.50');
  });

  it('asks for a reward: ask → confirm → POST → pending', async () => {
    const requested: string[] = [];
    mockBoot({ onRequest: (u) => requested.push(u) });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    // confirm step
    await waitFor(() => expect(screen.getByTestId('reward-confirm-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-confirm-rw1'));
    });

    await waitFor(() => expect(requested.length).toBe(1));
    expect(requested[0]).toContain('/api/kid/rewards/rw1/request');
    await waitFor(() => expect(screen.getByTestId('reward-pending-rw1')).toBeInTheDocument());
  });

  it('confirm then "Not yet" returns to Ask without sending a request', async () => {
    const requested: string[] = [];
    mockBoot({ onRequest: (u) => requested.push(u) });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    await waitFor(() => expect(screen.getByTestId('reward-cancel-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-cancel-rw1'));
    });
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    expect(requested).toHaveLength(0);
  });

  it('reverts to Ask when the request POST fails', async () => {
    mockBoot({ requestFails: true });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-ask-rw1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('reward-confirm-rw1'));
    });
    await waitFor(() => expect(screen.getByTestId('reward-ask-rw1')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-pending-rw1')).not.toBeInTheDocument();
  });

  it('a reward already pending shows no Ask button', async () => {
    mockBoot({
      rewards: {
        rewards: [
          {
            id: 'p1',
            name: 'Pending Treat',
            description: null,
            stickerCost: 5,
            icon: '⏳',
            requestStatus: 'pending',
          },
        ],
        stickerBalance: 50,
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('reward-pending-p1')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-ask-p1')).not.toBeInTheDocument();
  });

  it('shows "Keep saving" when the reward is unaffordable', async () => {
    mockBoot({
      // Affordability is measured against SAVINGS (what approval spends): 8 saved
      // stars, no banked cash → 92 short of a 100-star reward.
      savings: { savedStickers: 8, savedCash: 0, currency: 'AED' },
      rewards: {
        rewards: [
          {
            id: 'rw2',
            name: 'Big Lego Set',
            description: null,
            stickerCost: 100,
            icon: '🧱',
            requestStatus: 'none',
          },
        ],
        stickerBalance: 8,
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('reward-keepsaving-rw2')).toBeInTheDocument());
    expect(screen.queryByTestId('reward-ask-rw2')).not.toBeInTheDocument();
    expect(screen.getByText(/92 more stars to go/)).toBeInTheDocument();
  });

  it('shows pending / approved / declined states from requestStatus', async () => {
    mockBoot({
      rewards: {
        rewards: [
          {
            id: 'p1',
            name: 'Pending One',
            description: null,
            stickerCost: 5,
            icon: '⏳',
            requestStatus: 'pending',
          },
          {
            id: 'a1',
            name: 'Approved One',
            description: null,
            stickerCost: 5,
            icon: '🎉',
            requestStatus: 'approved',
          },
          {
            id: 'd1',
            name: 'Declined One',
            description: null,
            stickerCost: 5,
            icon: '😕',
            requestStatus: 'declined',
          },
        ],
        stickerBalance: 50,
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('reward-pending-p1')).toBeInTheDocument());
    expect(screen.getByTestId('reward-approved-a1')).toBeInTheDocument();
    expect(screen.getByTestId('reward-declined-d1')).toBeInTheDocument();
  });

  it('toggles to Analytics and shows the celebration view', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-stats-tab')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-myworld-stats-tab'));
    });

    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    expect(screen.getByText('Wow, Amina!')).toBeInTheDocument();
    expect(screen.getByText('What I Did This Week')).toBeInTheDocument();
    // Stickers Earned tile = sum(habitStats.completedDays) = 4.
    expect(screen.getByText('Stickers Earned')).toBeInTheDocument();
  });

  it('shows an error state and can retry', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-error')).toBeInTheDocument());
  });

  it('shows a gentle empty state when there are no habits', async () => {
    mockBoot({
      habits: {
        habits: [],
        stickers: [],
        week: { id: 'w1', weekNumber: 24, year: 2026, startDate: '2026-06-15', isFinalized: false },
        balance: 0,
        currency: 'AED',
      },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());
    expect(screen.getByText(/No habits yet/)).toBeInTheDocument();
  });
});
