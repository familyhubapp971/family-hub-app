import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Star, Target, Trophy } from 'lucide-react';
import { API_BASE } from '../../../lib/api';

// FHS-369 — kid My World "stats" view (KidStats): a celebration screen with
// treasure tiles, a weekly trend, "My Strengths", and a habit leaderboard.
// Reads GET /api/kid/analytics (self-scoped from the kid token).

interface WeekStat {
  weekNumber: number;
  year: number;
  startDate: string;
  totalStickers: number;
  daysCompleted: number;
  completionRate: number;
}
interface HabitStat {
  habitId: string;
  name: string;
  habitIcon: string | null;
  totalDays: number;
  completedDays: number;
  rate: number;
}
type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; stickersPerWeek: WeekStat[]; habitStats: HabitStat[] };

// A habit becomes a "strength" once it's been done on at least this many days.
const STRENGTH_MIN_DAYS = 5;

function rateColour(rate: number): string {
  if (rate >= 50) return 'bg-emerald-400';
  if (rate >= 35) return 'bg-yellow-300';
  return 'bg-pink-300';
}

export function KidStatsPanel({ kidToken }: { kidToken: string | null }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!kidToken) {
        setState({ kind: 'error' });
        return;
      }
      try {
        const r = await fetch(`${API_BASE}/api/kid/analytics`, {
          headers: { Authorization: `Bearer ${kidToken}` },
          signal: signal ?? null,
        });
        if (!r.ok) {
          setState({ kind: 'error' });
          return;
        }
        const b = (await r.json()) as { stickersPerWeek?: WeekStat[]; habitStats?: HabitStat[] };
        if (!Array.isArray(b.stickersPerWeek) || !Array.isArray(b.habitStats)) {
          setState({ kind: 'error' });
          return;
        }
        setState({ kind: 'loaded', stickersPerWeek: b.stickersPerWeek, habitStats: b.habitStats });
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError')) setState({ kind: 'error' });
      }
    },
    [kidToken],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const derived = useMemo(() => {
    if (state.kind !== 'loaded') return null;
    const starsEarned = state.habitStats.reduce((s, h) => s + h.completedDays, 0);
    const bestWeek = state.stickersPerWeek.reduce((m, w) => Math.max(m, w.daysCompleted), 0);
    const strengths = state.habitStats.filter((h) => h.completedDays >= STRENGTH_MIN_DAYS);
    const leaderboard = [...state.habitStats].sort((a, b) => b.rate - a.rate);
    return {
      starsEarned,
      bestWeek,
      activeHabits: state.habitStats.length,
      strengths,
      leaderboard,
      weeks: state.stickersPerWeek,
    };
  }, [state]);

  if (state.kind === 'loading') {
    return (
      <p data-testid="kid-stats-loading" aria-busy="true" className="text-sm font-bold text-white">
        Loading your stats…
      </p>
    );
  }
  if (state.kind === 'error' || !derived) {
    return (
      <p data-testid="kid-stats-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your stats — try again.
      </p>
    );
  }

  if (derived.activeHabits === 0 && derived.weeks.length === 0) {
    return (
      <div
        data-testid="kid-stats-empty"
        className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-sm"
      >
        <p aria-hidden="true" className="text-5xl">
          📊
        </p>
        <p className="mt-3 text-sm font-bold text-gray-600">
          Start ticking habits and your stats will appear here!
        </p>
      </div>
    );
  }

  const maxWeek = Math.max(1, ...derived.weeks.map((w) => w.daysCompleted));

  return (
    <div className="space-y-5" data-testid="kid-stats">
      <h2 className="flex items-center gap-2 font-heading text-2xl uppercase tracking-wide text-white drop-shadow-md">
        <Sparkles size={24} aria-hidden="true" /> Wow, look how you&rsquo;re doing!
      </h2>

      {/* Treasure tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="kid-stats-tiles">
        <div className="rounded-xl border-2 border-black bg-yellow-300 p-4 text-center shadow-neo-sm">
          <Star size={22} strokeWidth={3} className="mx-auto" aria-hidden="true" />
          <p className="mt-1 text-3xl font-black text-black" data-testid="kid-stats-stars">
            {derived.starsEarned}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-black/70">stars earned</p>
        </div>
        <div className="rounded-xl border-2 border-black bg-cyan-300 p-4 text-center shadow-neo-sm">
          <Trophy size={22} strokeWidth={3} className="mx-auto" aria-hidden="true" />
          <p className="mt-1 text-3xl font-black text-black">{derived.bestWeek}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-black/70">best week</p>
        </div>
        <div className="rounded-xl border-2 border-black bg-pink-300 p-4 text-center shadow-neo-sm">
          <Target size={22} strokeWidth={3} className="mx-auto" aria-hidden="true" />
          <p className="mt-1 text-3xl font-black text-black">{derived.activeHabits}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-black/70">habits</p>
        </div>
      </div>

      {/* Weekly trend */}
      {derived.weeks.length > 0 && (
        <section
          className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm"
          data-testid="kid-stats-weekly"
        >
          <h3 className="mb-3 font-heading text-lg text-black">Each week</h3>
          <div
            className="flex items-end gap-2"
            style={{ height: '96px' }}
            role="img"
            aria-label="Weekly sticker trend"
          >
            {derived.weeks.slice(-8).map((w) => (
              <div
                key={`${w.year}-${w.weekNumber}`}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t border-2 border-black bg-purple-400"
                  style={{
                    height: `${Math.max(6, Math.round((w.daysCompleted / maxWeek) * 80))}px`,
                  }}
                  aria-label={`Week ${w.weekNumber}: ${w.daysCompleted} stickers`}
                />
                <span className="text-[10px] font-bold text-gray-500">W{w.weekNumber}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Strengths */}
      {derived.strengths.length > 0 && (
        <section
          className="rounded-xl border-2 border-black bg-emerald-50 p-4 shadow-neo-sm"
          data-testid="kid-stats-strengths"
        >
          <h3 className="mb-2 font-heading text-lg text-black">My Strengths 💪</h3>
          <ul className="flex flex-wrap gap-2">
            {derived.strengths.map((h) => (
              <li
                key={h.habitId}
                data-testid="kid-strength"
                className="flex items-center gap-1 rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-bold text-black"
              >
                <span aria-hidden="true">{h.habitIcon ?? '⭐'}</span>
                {h.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Habit leaderboard */}
      {derived.leaderboard.length > 0 && (
        <section
          className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm"
          data-testid="kid-stats-leaderboard"
        >
          <h3 className="mb-3 font-heading text-lg text-black">How each habit is going</h3>
          <ul className="space-y-3">
            {derived.leaderboard.map((h) => (
              <li key={h.habitId}>
                <div className="mb-1 flex items-center justify-between text-sm font-bold text-black">
                  <span>
                    <span aria-hidden="true">{h.habitIcon ?? '⭐'}</span> {h.name}
                  </span>
                  <span className="text-gray-600">{h.rate}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100">
                  <div className={`h-full ${rateColour(h.rate)}`} style={{ width: `${h.rate}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-bold text-gray-500">
            Green = great (50%+) · Yellow = good · Pink = keep going
          </p>
        </section>
      )}
    </div>
  );
}
