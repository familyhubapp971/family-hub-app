import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import { Dialog } from '@familyhub/ui';
import { API_BASE } from '../../../lib/api';

// FHS-363 — the kid's interactive weekly habits (My World). A 7-day grid per
// habit: the kid taps TODAY to add a sticker (picker), past days are locked,
// future days are empty. Prev/next navigate finished weeks (read-only). Reads
// GET /api/kid/habits (+ /api/kid/weeks for nav); writes POST/DELETE
// /api/kid/habits/:id/stickers — the server only ever lets a kid change today.

const STICKER_EMOJI: Record<string, string> = {
  'gold-star': '⭐',
  heart: '💖',
  magic: '✨',
  trophy: '🏆',
};
const STICKER_OPTIONS = [
  { id: 'gold-star', label: 'Gold Star', emoji: '⭐' },
  { id: 'heart', label: 'Heart', emoji: '💖' },
  { id: 'magic', label: 'Magic', emoji: '✨' },
  { id: 'trophy', label: 'Trophy', emoji: '🏆' },
] as const;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Habit {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  isBonus: boolean;
}
interface Sticker {
  habitId: string;
  day: number;
  sticker: string;
  stickerValue: number;
}
interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  isFinalized: boolean;
}
interface HabitsResponse {
  habits: Habit[];
  stickers: Sticker[];
  week: Week;
  balance: number;
  currency: string;
}
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; data: HabitsResponse };

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
function dayDate(startDate: string, i: number): Date {
  const d = new Date(`${startDate}T00:00:00`);
  d.setDate(d.getDate() + i);
  return d;
}
function dayRelation(startDate: string, i: number): 'past' | 'today' | 'future' {
  const s = fmtLocal(dayDate(startDate, i));
  const today = fmtLocal(new Date());
  return s < today ? 'past' : s > today ? 'future' : 'today';
}

export function KidHabitsPanel({ kidToken }: { kidToken: string | null }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [picker, setPicker] = useState<{ habitId: string; day: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchWeek = useCallback(
    async (weekId?: string, signal?: AbortSignal) => {
      if (!kidToken) return;
      setState({ kind: 'loading' });
      try {
        const url = weekId
          ? `${API_BASE}/api/kid/habits?weekId=${encodeURIComponent(weekId)}`
          : `${API_BASE}/api/kid/habits`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${kidToken}` },
          signal: signal ?? null,
        });
        if (!r.ok) {
          setState({ kind: 'error' });
          return;
        }
        const body = (await r.json()) as HabitsResponse;
        if (!Array.isArray(body.habits) || !Array.isArray(body.stickers) || !body.week) {
          setState({ kind: 'error' });
          return;
        }
        setState({ kind: 'loaded', data: body });
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError')) setState({ kind: 'error' });
      }
    },
    [kidToken],
  );

  useEffect(() => {
    if (!kidToken) return;
    const ac = new AbortController();
    fetch(`${API_BASE}/api/kid/weeks`, {
      headers: { Authorization: `Bearer ${kidToken}` },
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) return;
        const b = (await r.json()) as { weeks?: Week[] };
        setWeeks(Array.isArray(b.weeks) ? b.weeks : []);
      })
      .catch(() => {
        /* nav is a nicety — a failure just disables the chevrons */
      });
    void fetchWeek(undefined, ac.signal);
    return () => ac.abort();
  }, [kidToken, fetchWeek]);

  const data = state.kind === 'loaded' ? state.data : null;
  const { prevWeek, nextWeek } = useMemo(() => {
    if (!data) return { prevWeek: undefined, nextWeek: undefined };
    const idx = weeks.findIndex((w) => w.id === data.week.id);
    return {
      prevWeek: idx > 0 ? weeks[idx - 1] : undefined,
      nextWeek: idx >= 0 && idx < weeks.length - 1 ? weeks[idx + 1] : undefined,
    };
  }, [weeks, data]);

  const mutate = useCallback(
    async (method: 'POST' | 'DELETE', habitId: string, day: number, sticker?: string) => {
      if (!kidToken || !data) return;
      setBusy(true);
      setPicker(null);
      try {
        await fetch(`${API_BASE}/api/kid/habits/${habitId}/stickers`, {
          method,
          headers: { Authorization: `Bearer ${kidToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(
            method === 'POST'
              ? { weekId: data.week.id, day, sticker }
              : { weekId: data.week.id, day },
          ),
        });
        await fetchWeek(data.week.id);
      } finally {
        setBusy(false);
      }
    },
    [kidToken, data, fetchWeek],
  );

  if (state.kind === 'loading') {
    return (
      <p
        data-testid="kid-habits-loading"
        aria-busy="true"
        className="text-sm font-bold text-gray-600"
      >
        Loading your habits…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p data-testid="kid-habits-error" role="alert" className="text-sm font-bold text-red-600">
        Couldn&rsquo;t load your habits — try again.
      </p>
    );
  }

  const { habits, stickers, week } = state.data;
  const stickerFor = (habitId: string, day: number) =>
    stickers.find((s) => s.habitId === habitId && s.day === day);
  const start = dayDate(week.startDate, 0);
  const end = dayDate(week.startDate, 6);
  const range = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="space-y-5" data-testid="kid-habits">
      {/* Week banner */}
      <div
        className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white shadow-neo-sm"
        data-testid="kid-week-banner"
      >
        <button
          type="button"
          onClick={() => prevWeek && void fetchWeek(prevWeek.id)}
          disabled={!prevWeek}
          aria-label="Previous week"
          data-testid="kid-week-prev"
          className="grid h-9 w-9 place-items-center rounded-md border-2 border-black bg-white/90 text-black shadow-neo-xs disabled:opacity-40"
        >
          <ChevronLeft size={18} strokeWidth={3} aria-hidden="true" />
        </button>
        <div className="text-center">
          <p className="font-heading text-lg uppercase tracking-wide">Week {week.weekNumber}</p>
          <p className="text-xs font-bold opacity-90">{range}</p>
          <p className="mt-1 text-sm font-bold">
            {stickers.length} sticker{stickers.length === 1 ? '' : 's'} this week{' '}
            <span aria-hidden="true">✨</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => nextWeek && void fetchWeek(nextWeek.id)}
          disabled={!nextWeek}
          aria-label="Next week"
          data-testid="kid-week-next"
          className="grid h-9 w-9 place-items-center rounded-md border-2 border-black bg-white/90 text-black shadow-neo-xs disabled:opacity-40"
        >
          <ChevronRight size={18} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      {habits.length === 0 ? (
        <div data-testid="kid-habits-empty" className="text-center">
          <p aria-hidden="true" className="text-5xl">
            🌈
          </p>
          <h2 className="mt-3 font-heading text-2xl text-black">My Habits</h2>
          <p className="mt-1 text-sm font-bold text-gray-600">
            No habits yet — ask a grown-up to add some!
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {habits.map((h) => (
            <li
              key={h.id}
              data-testid="kid-habit"
              className="rounded-xl border-2 border-black bg-white p-4 text-left shadow-neo-sm"
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-lg border-2 border-black text-xl"
                  style={{ backgroundColor: `${h.color}33` }}
                >
                  {h.icon ?? '⭐'}
                </span>
                <span className="font-heading text-lg text-black">{h.name}</span>
                {h.isBonus && (
                  <span className="ml-auto rounded-md border-2 border-black bg-yellow-300 px-2 py-0.5 text-xs font-bold text-black">
                    BONUS ×5
                  </span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LABELS.map((label, day) => {
                  const rel = dayRelation(week.startDate, day);
                  const placed = stickerFor(h.id, day);
                  const editable = rel === 'today' && !week.isFinalized;
                  const base =
                    'flex aspect-square w-full flex-col items-center justify-center rounded-lg border-2 text-lg';
                  if (placed) {
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={!editable || busy}
                        onClick={() => editable && void mutate('DELETE', h.id, day)}
                        aria-label={`${label}, ${placed.sticker.replace('-', ' ')}${editable ? ', tap to remove' : ''}`}
                        data-testid={editable ? 'kid-cell-today' : 'kid-cell-done'}
                        className={`${base} border-black bg-pink-100 ${editable ? '' : 'cursor-default'}`}
                      >
                        <span className="text-[10px] font-bold text-gray-500">{label}</span>
                        <span aria-hidden="true">{STICKER_EMOJI[placed.sticker] ?? '⭐'}</span>
                      </button>
                    );
                  }
                  if (editable) {
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={busy}
                        onClick={() => setPicker({ habitId: h.id, day })}
                        aria-label={`${label}, add a sticker for today`}
                        data-testid="kid-cell-today"
                        className={`${base} border-dashed border-purple-400 bg-purple-50 text-purple-400 motion-safe:hover:-translate-y-0.5`}
                      >
                        <span className="text-[10px] font-bold text-gray-500">{label}</span>
                        <Plus size={16} strokeWidth={3} aria-hidden="true" />
                      </button>
                    );
                  }
                  return (
                    <div
                      key={day}
                      aria-label={rel === 'past' ? `${label}, missed` : `${label}, not yet`}
                      data-testid={rel === 'past' ? 'kid-cell-past' : 'kid-cell-future'}
                      className={`${base} border-gray-200 ${rel === 'past' ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-200'}`}
                    >
                      <span className="text-[10px] font-bold text-gray-400">{label}</span>
                      {rel === 'past' ? (
                        <Lock size={13} aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">·</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Sticker picker (design-system Dialog handles a11y + Escape/backdrop). */}
      <Dialog
        isOpen={!!picker}
        onClose={() => setPicker(null)}
        testId="kid-sticker-picker"
        ariaLabel="Choose a sticker"
      >
        <div className="w-full max-w-xs rounded-xl border-2 border-black bg-white p-5 shadow-neo-lg">
          <h3 className="mb-4 text-center font-heading text-xl text-black">Pick a sticker!</h3>
          <div className="grid grid-cols-2 gap-3">
            {STICKER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => picker && void mutate('POST', picker.habitId, picker.day, opt.id)}
                data-testid={`kid-sticker-${opt.id}`}
                className="flex flex-col items-center gap-1 rounded-lg border-2 border-black bg-yellow-50 p-3 font-bold text-black shadow-neo-xs motion-safe:hover:-translate-y-0.5"
              >
                <span aria-hidden="true" className="text-3xl">
                  {opt.emoji}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPicker(null)}
            data-testid="kid-sticker-cancel"
            className="mt-4 w-full rounded-md border-2 border-black bg-white py-2 font-bold text-gray-700 shadow-neo-xs"
          >
            Cancel
          </button>
        </div>
      </Dialog>
    </div>
  );
}
