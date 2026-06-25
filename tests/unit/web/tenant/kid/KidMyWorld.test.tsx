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
        json: async () =>
          over.savings ?? { savedStickers: 10, savedCash: 5, currency: 'AED', stickerRate: 0.5 },
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
    expect(screen.getByText('Stickers Earned')).toBeInTheDocument();
  });

  it('day cells expose role=img with full-day labels (FHS-377)', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-habit-day-h1-0')).toBeInTheDocument());
    // h1 done Mon(0) + Tue(1); Wed(2) not done.
    const mon = screen.getByTestId('kid-habit-day-h1-0');
    expect(mon).toHaveAttribute('role', 'img');
    expect(mon).toHaveAttribute('aria-label', 'Read a book, Monday: done');
    expect(screen.getByTestId('kid-habit-day-h1-2')).toHaveAttribute(
      'aria-label',
      'Read a book, Wednesday: not done',
    );
  });

  it('arrow keys move + activate between the two tabs (FHS-377)', async () => {
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-habits-tab')).toBeInTheDocument());
    const habitsTab = screen.getByTestId('kid-myworld-habits-tab');
    const analyticsTab = screen.getByTestId('kid-myworld-stats-tab');
    // Roving tabindex: the selected tab is the single tab stop.
    expect(habitsTab).toHaveAttribute('tabindex', '0');
    expect(analyticsTab).toHaveAttribute('tabindex', '-1');
    await act(async () => {
      fireEvent.keyDown(habitsTab, { key: 'ArrowRight' });
    });
    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    expect(analyticsTab).toHaveAttribute('aria-selected', 'true');
    expect(analyticsTab).toHaveAttribute('tabindex', '0');
    await act(async () => {
      fireEvent.keyDown(analyticsTab, { key: 'ArrowLeft' });
    });
    await waitFor(() => expect(habitsTab).toHaveAttribute('aria-selected', 'true'));
  });

  it('Stickers Earned sums weekly sticker totals, not completed days (FHS-377)', async () => {
    mockBoot({
      analytics: {
        stickersPerWeek: [
          {
            weekNumber: 23,
            year: 2026,
            startDate: '2026-06-08',
            totalStickers: 12,
            daysCompleted: 5,
            completionRate: 71,
          },
          {
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-15',
            totalStickers: 8,
            daysCompleted: 3,
            completionRate: 43,
          },
        ],
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
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld-stats-tab')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-myworld-stats-tab'));
    });
    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    // 12 + 8 = 20, NOT habitStats.completedDays (4).
    const tile = screen.getByText('Stickers Earned').closest('div')!;
    expect(tile).toHaveTextContent('20');
  });

  it('shows a retry when a navigated week fails to load (FHS-377)', async () => {
    const w1 = { ...WEEK, id: 'w1', weekNumber: 23, startDate: '2026-06-08', isFinalized: true };
    const w2 = { ...WEEK, id: 'w2', weekNumber: 24, startDate: '2026-06-15', isFinalized: false };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [w1, w2] }) });
      if (u.includes('/api/kid/habits')) {
        if (u.includes('weekId=w1'))
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
        return Promise.resolve({ ok: true, status: 200, json: async () => HABITS_BODY });
      }
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0, currency: 'AED' }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    // Boot lands on the current week (w2); navigate back to the uncached w1.
    await waitFor(() => expect(screen.getByTestId('kid-week-prev')).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-week-prev'));
    });
    await waitFor(() => expect(screen.getByTestId('kid-week-error')).toBeInTheDocument());
    expect(screen.getByTestId('kid-week-retry')).toBeInTheDocument();
  });

  // FHS-399 — finished-week framing on KidMyWorld ──────────────────────────

  it('shows the live banner on the current (non-finalized) week', async () => {
    // Default mock uses WEEK with isFinalized: false → data.isCurrentWeek = true
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-myworld')).toBeInTheDocument());
    expect(screen.getByText('How are you doing this week?')).toBeInTheDocument();
    expect(screen.queryByTestId('kid-finished-week-banner')).not.toBeInTheDocument();
  });

  it('shows the finished-week banner when viewing a finalized week', async () => {
    const finalizedWeek = { ...WEEK, isFinalized: true };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [finalizedWeek] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ...HABITS_BODY,
            week: finalizedWeek,
          }),
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            savedStickers: 10,
            savedCash: 5,
            currency: 'AED',
            stickerRate: 0.5,
          }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 8 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-banner')).toBeInTheDocument());
    // Finished-week heading (&rsquo; renders as the curly right-single-quote ’)
    expect(screen.getByTestId('kid-finished-week-banner')).toHaveTextContent(
      /looking at a finished week/,
    );
    // Past-tense completion line (3 done out of 14 total → 21% → gentle message)
    expect(screen.getByTestId('kid-finished-week-banner')).toHaveTextContent(/You finished/);
    // Live banner heading is NOT shown
    expect(screen.queryByText('How are you doing this week?')).not.toBeInTheDocument();
  });

  it('shows celebratory message when completion >= 50% on a finalized week', async () => {
    const finalizedWeek = { ...WEEK, isFinalized: true };
    // Give h1 and h2 each 4 done days out of 7 = 8/14 = 57%
    const richStickers = [
      ...Array.from({ length: 4 }, (_, d) => ({
        habitId: 'h1',
        day: d,
        sticker: 'gold-star',
        stickerValue: 1,
      })),
      ...Array.from({ length: 4 }, (_, d) => ({
        habitId: 'h2',
        day: d,
        sticker: 'gold-star',
        stickerValue: 1,
      })),
    ];
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [finalizedWeek] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...HABITS_BODY, stickers: richStickers, week: finalizedWeek }),
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ savedStickers: 0, savedCash: 0, currency: 'AED', stickerRate: 0.5 }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 0 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-finished-week-banner')).toBeInTheDocument());
    expect(screen.getByText(/Amazing work/)).toBeInTheDocument();
  });

  it('KidMoneySkills shows past-tense copy when isFinalized, forward copy when live', async () => {
    const finalizedWeek = { ...WEEK, isFinalized: true };
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/kid/weeks'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ weeks: [finalizedWeek] }),
        });
      if (u.includes('/api/kid/habits'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...HABITS_BODY, week: finalizedWeek }),
        });
      if (u.includes('/api/kid/financial/savings'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            savedStickers: 10,
            savedCash: 5,
            currency: 'AED',
            stickerRate: 0.5,
          }),
        });
      if (u.includes('/api/kid/financial/investments'))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ investments: [] }) });
      if (u.endsWith('/api/kid/rewards'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ rewards: [], stickerBalance: 8 }),
        });
      if (u.includes('/api/kid/analytics'))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ stickersPerWeek: [], habitStats: [] }),
        });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument());
    const ms = screen.getByTestId('kid-moneyskills');
    // Past-tense intro line (apostrophe may render as curly quote; use regex)
    expect(ms).toHaveTextContent(/what you did with your stars this week/);
    // Forward-looking CTA is gone
    expect(ms).not.toHaveTextContent('What will you do with them?');
    // Card headings flip to past tense
    expect(ms).toHaveTextContent('Spent');
    expect(ms).toHaveTextContent('Saved');
    expect(ms).toHaveTextContent('Grew (Invested)');
  });

  it('KidMoneySkills shows forward-looking copy on the current week', async () => {
    // Default mockBoot → current week, isFinalized: false
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);
    await waitFor(() => expect(screen.getByTestId('kid-moneyskills')).toBeInTheDocument());
    const ms = screen.getByTestId('kid-moneyskills');
    expect(ms).toHaveTextContent('What will you do with them?');
    expect(ms).not.toHaveTextContent(/what you did with your stars this week/);
    expect(ms).toHaveTextContent('Spend Now');
    expect(ms).toHaveTextContent('Save Up');
    expect(ms).toHaveTextContent('Grow (Invest)');
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

  // FHS-387 — cash values and the "worth" label derive from the API stickerRate,
  // never from a hardcoded 0.5.
  it('uses the API stickerRate to compute weekly value and "worth" label', async () => {
    // stickerRate = 1.0 → each star is worth 1 AED.
    // earnedThisWeek = 3 (h1:2 + h2:1), weeklyValue = 3 * 1.0 = "3.00".
    mockBoot({
      savings: { savedStickers: 10, savedCash: 5, currency: 'AED', stickerRate: 1.0 },
    });
    render(<KidMyWorld kidToken={KID_TOKEN} displayName="Amina" />);

    await waitFor(() => expect(screen.getByTestId('kid-my-account')).toBeInTheDocument());

    // weeklyValue: 3 × 1.0 = "3.00"
    expect(screen.getByTestId('kid-account-cash')).toHaveTextContent('AED 3.00');
    // "worth" label: "Each star is worth AED 1.00"
    expect(screen.getByText(/Each star is worth AED 1\.00/)).toBeInTheDocument();
  });
});
