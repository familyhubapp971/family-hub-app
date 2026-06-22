import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// FHS-363 — the kid's interactive weekly habit grid. Past days lock, only
// today is tappable, and tapping opens the sticker picker → POST.

import { KidHabitsPanel } from '../../../../../apps/web/src/pages/tenant/kid/KidHabitsPanel';

const TOKEN = 'kid.jwt.token';
const fetchMock = vi.fn();

// Week starts Monday 2026-06-15; we pin "now" to Wednesday 2026-06-17 (noon
// UTC so the local calendar day is stable across runner timezones). So:
// Mon+Tue = past (locked), Wed = today (tappable), Thu–Sun = future.
const WEEK = { id: 'w1', weekNumber: 25, year: 2026, startDate: '2026-06-15', isFinalized: false };
const HABIT = {
  id: 'h1',
  name: 'Read a book',
  description: null,
  color: '#facc15',
  icon: '📚',
  isBonus: false,
};

function mockHabits(
  stickers: Array<{ habitId: string; day: number; sticker: string; stickerValue: number }> = [],
) {
  fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/kid/weeks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ weeks: [WEEK] }) });
    }
    if (/\/api\/kid\/habits\/[^/]+\/stickers/.test(u)) {
      return Promise.resolve({
        ok: true,
        status: opts?.method === 'DELETE' ? 204 : 200,
        json: async () => ({}),
      });
    }
    if (u.includes('/api/kid/habits')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ habits: [HABIT], stickers, week: WEEK, balance: 0, currency: 'AED' }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-17T12:00:00Z'));
  fetchMock.mockReset();
  mockHabits();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<KidHabitsPanel />', () => {
  it('renders the week grid: past days are locked, only today is tappable', async () => {
    render(<KidHabitsPanel kidToken={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('kid-habits')).toBeInTheDocument());
    expect(screen.getByText('Read a book')).toBeInTheDocument();
    // Mon + Tue are in the past → locked; Wed is today → exactly one tappable cell.
    expect(screen.getAllByTestId('kid-cell-past')).toHaveLength(2);
    expect(screen.getAllByTestId('kid-cell-today')).toHaveLength(1);
  });

  it('tapping today opens the picker and placing a sticker POSTs to the kid endpoint', async () => {
    render(<KidHabitsPanel kidToken={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('kid-habits')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-cell-today'));
    });
    expect(screen.getByTestId('kid-sticker-picker')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-sticker-heart'));
    });
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, o]) =>
          String(u).includes('/api/kid/habits/h1/stickers') &&
          (o as RequestInit)?.method === 'POST',
      );
      expect(post).toBeTruthy();
      expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
        weekId: 'w1',
        day: 2,
        sticker: 'heart',
      });
    });
  });

  it('shows an already-placed sticker and lets the kid remove today’s', async () => {
    mockHabits([{ habitId: 'h1', day: 2, sticker: 'heart', stickerValue: 1 }]);
    render(<KidHabitsPanel kidToken={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('kid-habits')).toBeInTheDocument());
    // Today's filled cell is tappable (to remove); tapping it DELETEs.
    await act(async () => {
      fireEvent.click(screen.getByTestId('kid-cell-today'));
    });
    await waitFor(() => {
      const del = fetchMock.mock.calls.find(
        ([u, o]) =>
          String(u).includes('/api/kid/habits/h1/stickers') &&
          (o as RequestInit)?.method === 'DELETE',
      );
      expect(del).toBeTruthy();
    });
  });
});
