import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

// FHS-369 — kid My World stats view. Reads GET /api/kid/analytics and renders
// treasure tiles, weekly trend, My Strengths (habits done >=5 days), leaderboard.

import { KidStatsPanel } from '../../../../../apps/web/src/pages/tenant/kid/KidStatsPanel';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('<KidStatsPanel />', () => {
  it('renders tiles, strengths and leaderboard from the analytics endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stickersPerWeek: [
          {
            weekNumber: 24,
            year: 2026,
            startDate: '2026-06-08',
            totalStickers: 6,
            daysCompleted: 6,
            completionRate: 60,
          },
          {
            weekNumber: 25,
            year: 2026,
            startDate: '2026-06-15',
            totalStickers: 4,
            daysCompleted: 4,
            completionRate: 40,
          },
        ],
        habitStats: [
          {
            habitId: 'h1',
            name: 'Read a book',
            habitIcon: '📚',
            totalDays: 14,
            completedDays: 7,
            rate: 50,
          },
          {
            habitId: 'h2',
            name: 'Tidy room',
            habitIcon: '🧹',
            totalDays: 14,
            completedDays: 3,
            rate: 21,
          },
        ],
      }),
    });
    render(<KidStatsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    // stars earned = 7 + 3 = 10
    expect(screen.getByTestId('kid-stats-stars')).toHaveTextContent('10');
    // Only "Read a book" (7 days >= 5) is a strength
    expect(screen.getByTestId('kid-stats-strengths')).toHaveTextContent('Read a book');
    expect(screen.getByTestId('kid-stats-strengths')).not.toHaveTextContent('Tidy room');
    // Leaderboard lists both habits
    expect(screen.getByTestId('kid-stats-leaderboard')).toHaveTextContent('Tidy room');
  });

  it('shows an empty state for a brand-new kid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ stickersPerWeek: [], habitStats: [] }),
    });
    render(<KidStatsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-stats-empty')).toBeInTheDocument());
  });

  it('shows an error state when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<KidStatsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-stats-error')).toBeInTheDocument());
  });

  it('errors without fetching when there is no kid token', async () => {
    render(<KidStatsPanel kidToken={null} />);
    await waitFor(() => expect(screen.getByTestId('kid-stats-error')).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error state on a network drop', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<KidStatsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-stats-error')).toBeInTheDocument());
  });

  it('shows zero tiles (not the empty state) for a kid with habits but no stickers yet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        stickersPerWeek: [],
        habitStats: [
          {
            habitId: 'h1',
            name: 'Brush teeth',
            habitIcon: '🪥',
            totalDays: 7,
            completedDays: 0,
            rate: 0,
          },
        ],
      }),
    });
    render(<KidStatsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-stats')).toBeInTheDocument());
    expect(screen.getByTestId('kid-stats-stars')).toHaveTextContent('0');
    expect(screen.queryByTestId('kid-stats-strengths')).not.toBeInTheDocument();
    expect(screen.getByTestId('kid-stats-leaderboard')).toHaveTextContent('Brush teeth');
  });

  it('caps the weekly trend at the last 8 weeks', async () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({
      weekNumber: i + 1,
      year: 2026,
      startDate: '2026-01-01',
      totalStickers: 1,
      daysCompleted: 1,
      completionRate: 10,
    }));
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ stickersPerWeek: weeks, habitStats: [] }),
    });
    render(<KidStatsPanel kidToken="kid.jwt" />);
    await waitFor(() => expect(screen.getByTestId('kid-stats-weekly')).toBeInTheDocument());
    const bars = within(screen.getByTestId('kid-stats-weekly')).getAllByLabelText(/^Week /);
    expect(bars).toHaveLength(8);
  });
});
