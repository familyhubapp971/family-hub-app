import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Star, X } from 'lucide-react';
import { Button } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-292 — My World habit grid (typed stickers) + rewards shop.
//
// Each habit day holds a sticker TYPE worth 5 (bonus habit) or 1 sticker.
// Pick a sticker type, tap a day to place it (tap again to remove). The
// shop spends the resulting balance. Habits can be added / edited /
// deleted. Week navigation + savings/investments/close-week land in the
// sibling FHS-293..298 stories.

interface Habit {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  isBonus: boolean;
}
interface StickerRow {
  habitId: string;
  day: number; // 0 = Mon … 6 = Sun
  sticker: string;
  stickerValue: number;
}
interface WeekInfo {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  isFinalized: boolean;
}
interface Reward {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STICKERS: Array<{ id: string; label: string; emoji: string; bg: string }> = [
  { id: 'gold-star', label: 'Gold Star', emoji: '⭐', bg: 'bg-yellow-300' },
  { id: 'heart', label: 'Love Heart', emoji: '❤️', bg: 'bg-pink-300' },
  { id: 'magic', label: 'Magic', emoji: '✨', bg: 'bg-fuchsia-300' },
  { id: 'trophy', label: 'Trophy', emoji: '🏆', bg: 'bg-lime-300' },
];
const STICKER_EMOJI: Record<string, string> = Object.fromEntries(
  STICKERS.map((s) => [s.id, s.emoji]),
);

function cellKey(habitId: string, day: number): string {
  return `${habitId}|${day}`;
}

// Re-exported for tests that build the week.
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function mondayOfWeek(d: Date): Date {
  const day = d.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift));
}

type Status = 'loading' | 'ready' | 'error';

export function MyWorldTab({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stickers, setStickers] = useState<Map<string, StickerRow>>(new Map());
  const [week, setWeek] = useState<WeekInfo | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [picked, setPicked] = useState('gold-star');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', isBonus: false });
  const stickersRef = useRef<Map<string, StickerRow>>(new Map());
  const balanceRef = useRef(0);
  const busyRef = useRef<Set<string>>(new Set());
  const redeemingRef = useRef<Set<string>>(new Set());
  const savingRef = useRef(false);

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const load = useCallback(async () => {
    if (!headers) return;
    setStatus('loading');
    try {
      const [hRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/api/habits?memberId=${memberId}`, { headers }),
        fetch(`${API_BASE}/api/rewards?memberId=${memberId}`, { headers }),
      ]);
      if (!hRes.ok || !rRes.ok) {
        setStatus('error');
        return;
      }
      const hBody = (await hRes.json()) as {
        habits: Habit[];
        stickers: StickerRow[];
        week: WeekInfo;
        balance: number;
      };
      const rBody = (await rRes.json()) as { rewards: Reward[]; stickerBalance: number };
      const map = new Map<string, StickerRow>();
      for (const s of hBody.stickers ?? []) map.set(cellKey(s.habitId, s.day), s);
      stickersRef.current = map;
      balanceRef.current = hBody.balance ?? 0;
      setHabits(hBody.habits ?? []);
      setStickers(map);
      setWeek(hBody.week);
      setBalance(hBody.balance ?? 0);
      setRewards(rBody.rewards ?? []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [headers, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCell = useCallback(
    async (habit: Habit, day: number) => {
      if (!headers || !week) return;
      const k = cellKey(habit.id, day);
      if (busyRef.current.has(k)) return;
      busyRef.current.add(k);
      const existing = stickersRef.current.get(k);
      const value = habit.isBonus ? 5 : 1;
      const next = new Map(stickersRef.current);
      if (existing) next.delete(k);
      else next.set(k, { habitId: habit.id, day, sticker: picked, stickerValue: value });
      stickersRef.current = next;
      setStickers(next);
      const delta = existing ? -existing.stickerValue : value;
      balanceRef.current += delta;
      setBalance(balanceRef.current);
      try {
        const res = existing
          ? await fetch(`${API_BASE}/api/habits/${habit.id}/stickers`, {
              method: 'DELETE',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ memberId, weekId: week.id, day }),
            })
          : await fetch(`${API_BASE}/api/habits/${habit.id}/stickers`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ memberId, weekId: week.id, day, sticker: picked }),
            });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        // Revert.
        const reverted = new Map(stickersRef.current);
        if (existing) reverted.set(k, existing);
        else reverted.delete(k);
        stickersRef.current = reverted;
        setStickers(reverted);
        balanceRef.current -= delta;
        setBalance(balanceRef.current);
        setAnnounce("Couldn't save that — try again.");
      } finally {
        busyRef.current.delete(k);
      }
    },
    [headers, week, picked, memberId],
  );

  const onAddSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!headers || savingRef.current) return;
      const name = draft.name.trim();
      if (!name) return;
      savingRef.current = true;
      try {
        const url = editingId ? `${API_BASE}/api/habits/${editingId}` : `${API_BASE}/api/habits`;
        const res = await fetch(url, {
          method: editingId ? 'PUT' : 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, name, isBonus: draft.isBonus }),
        });
        if (res.ok) {
          setAdding(false);
          setEditingId(null);
          setDraft({ name: '', isBonus: false });
          await load();
        } else {
          setAnnounce("Couldn't save that habit — try again.");
        }
      } catch {
        setAnnounce('Network error — try again.');
      } finally {
        savingRef.current = false;
      }
    },
    [headers, draft, editingId, memberId, load],
  );

  const onDeleteHabit = useCallback(
    async (id: string, name: string) => {
      if (!headers) return;
      // Destructive (stickers cascade) — confirm before deleting.
      if (typeof window !== 'undefined' && !window.confirm(`Delete "${name}" and its stickers?`)) {
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/habits/${id}`, {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        });
        if (res.ok) await load();
        else setAnnounce("Couldn't delete that habit — try again.");
      } catch {
        setAnnounce('Network error — try again.');
      }
    },
    [headers, memberId, load],
  );

  const onRedeem = useCallback(
    async (reward: Reward) => {
      if (!headers || redeemingRef.current.has(reward.id)) return;
      if (balance < reward.stickerCost) return;
      redeemingRef.current.add(reward.id);
      try {
        const res = await fetch(`${API_BASE}/api/rewards/${reward.id}/redeem`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        });
        if (!res.ok) {
          setAnnounce(
            res.status === 409 ? 'Not enough stickers yet!' : "Couldn't redeem — try again.",
          );
          return;
        }
        const body = (await res.json()) as { stickerBalance: number };
        balanceRef.current = body.stickerBalance;
        setBalance(body.stickerBalance);
        setAnnounce(`You got ${reward.name}! 🎉`);
      } catch {
        setAnnounce("Couldn't redeem — try again.");
      } finally {
        redeemingRef.current.delete(reward.id);
      }
    },
    [headers, balance, memberId],
  );

  if (status === 'loading') {
    return (
      <p
        data-testid="my-world-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading your world…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="my-world-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load your world — try again.
      </p>
    );
  }

  const totalPossible = habits.length * 7;
  const doneThisWeek = stickers.size;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12" data-testid="my-world">
      <p aria-live="polite" className="sr-only" data-testid="my-world-announce">
        {announce}
      </p>

      {/* Habit tracker (left column) */}
      <section
        aria-labelledby="habit-tracker-heading"
        className="space-y-4 xl:col-span-8"
        data-testid="habit-tracker"
      >
        <h2
          id="habit-tracker-heading"
          className="font-heading text-xl uppercase tracking-wide text-white"
        >
          My Habits
        </h2>

        <div
          data-testid="habits-summary"
          className="flex items-center justify-between rounded-xl border-2 border-black bg-[#6b21a8] p-4 shadow-neo-sm"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-lg border-2 border-black bg-pink-400 text-xl"
            >
              ⭐
            </span>
            <span className="font-heading text-sm uppercase tracking-wide text-white">
              Weekly Habits
            </span>
          </div>
          <div className="text-right">
            <span className="font-heading text-3xl text-yellow-300">
              {doneThisWeek}/{totalPossible}
            </span>
            <p className="text-xs font-bold text-white">Habits Done ✨</p>
          </div>
        </div>

        {/* Sticker picker */}
        <div
          data-testid="sticker-picker"
          role="group"
          aria-label="Choose a sticker"
          className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-black bg-white p-3 shadow-neo-sm"
        >
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-gray-500">
            Sticker
          </span>
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              data-testid={`sticker-pick-${s.id}`}
              aria-pressed={picked === s.id}
              aria-label={s.label}
              onClick={() => setPicked(s.id)}
              className={`flex h-10 min-w-[44px] items-center justify-center gap-1 rounded-lg border-2 px-2 text-lg ${
                picked === s.id ? `border-black ${s.bg} shadow-neo-xs` : 'border-gray-300 bg-white'
              }`}
            >
              {s.emoji}
            </button>
          ))}
        </div>

        {habits.length === 0 ? (
          <p
            data-testid="habits-empty"
            className="rounded-xl border-2 border-black bg-white py-6 text-center text-sm font-bold text-gray-500 shadow-neo-sm"
          >
            No habits yet — add the first one.
          </p>
        ) : (
          <ul className="space-y-3">
            {habits.map((h) => {
              const habitDone = DAY_LABELS.filter((_, i) => stickers.has(cellKey(h.id, i))).length;
              const pct = Math.round((habitDone / 7) * 100);
              return (
                <li
                  key={h.id}
                  data-testid={`habit-row-${h.id}`}
                  className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border-2 border-black font-heading text-lg text-black"
                        style={{ backgroundColor: h.color }}
                      >
                        {h.icon ?? [...h.name.trim()][0]?.toUpperCase() ?? '★'}
                      </span>
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span
                            data-testid={`habit-name-${h.id}`}
                            className="truncate font-heading text-base text-black"
                          >
                            {h.name}
                          </span>
                          {h.isBonus && (
                            <span className="rounded-full border border-black bg-amber-200 px-1.5 text-[10px] font-bold">
                              5×
                            </span>
                          )}
                          <button
                            type="button"
                            data-testid={`habit-edit-${h.id}`}
                            aria-label={`Edit ${h.name}`}
                            onClick={() => {
                              setEditingId(h.id);
                              setAdding(true);
                              setDraft({ name: h.name, isBonus: h.isBonus });
                            }}
                            className="text-gray-400 hover:text-black"
                          >
                            <Pencil size={14} />
                          </button>
                        </span>
                        <div
                          data-testid={`habit-progress-${h.id}`}
                          className="mt-1 h-2.5 w-40 max-w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                        >
                          <div className="h-full bg-green-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:justify-end">
                        {DAY_LABELS.map((label, i) => {
                          const placed = stickers.get(cellKey(h.id, i));
                          return (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <span
                                aria-hidden="true"
                                className="text-[10px] font-bold text-gray-400"
                              >
                                {label}
                              </span>
                              <button
                                type="button"
                                onClick={() => onCell(h, i)}
                                aria-pressed={!!placed}
                                aria-label={`${h.name} day ${i + 1}: ${placed ? 'has a sticker' : 'empty'}`}
                                data-testid={`habit-cell-${h.id}-${i}`}
                                className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 border-black text-lg motion-safe:transition-colors ${
                                  placed ? 'bg-green-100' : 'bg-gray-50 hover:bg-yellow-100'
                                }`}
                              >
                                {placed ? (STICKER_EMOJI[placed.sticker] ?? '⭐') : ''}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        data-testid={`habit-delete-${h.id}`}
                        aria-label={`Delete ${h.name}`}
                        onClick={() => onDeleteHabit(h.id, h.name)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-600"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <form
            onSubmit={onAddSubmit}
            data-testid="habit-add-form"
            className="flex flex-col gap-3 rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm sm:flex-row sm:items-end"
          >
            <label className="flex flex-1 flex-col gap-1 text-sm font-bold text-black">
              {editingId ? 'Edit habit' : 'New habit'}
              <input
                type="text"
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                data-testid="habit-add-name"
                className="rounded border-2 border-black px-2 py-1 text-sm font-normal text-black focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-black">
              <input
                type="checkbox"
                checked={draft.isBonus}
                onChange={(e) => setDraft({ ...draft, isBonus: e.target.checked })}
                data-testid="habit-add-bonus"
                className="h-5 w-5 accent-yellow-400"
              />
              Bonus (5×)
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" testId="habit-add-submit">
                {editingId ? 'Save' : 'Add'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                testId="habit-add-cancel"
                onClick={() => {
                  setAdding(false);
                  setEditingId(null);
                  setDraft({ name: '', isBonus: false });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            data-testid="habit-add"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              setDraft({ name: '', isBonus: false });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/60 py-3 font-bold text-white hover:bg-white/10"
          >
            + Add New Habit
          </button>
        )}
      </section>

      {/* Rewards shop (right column) */}
      <section
        aria-labelledby="rewards-shop-heading"
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-6 xl:col-span-4"
        data-testid="rewards-shop"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="rewards-shop-heading" className="font-heading text-xl text-black">
            Rewards Shop
          </h2>
          <span
            data-testid="sticker-balance"
            className="flex items-center gap-1.5 rounded-full border-2 border-black bg-black px-3 py-1.5 font-heading text-sm text-white shadow-neo-xs"
          >
            <Star size={14} className="fill-yellow-300 text-yellow-300" aria-hidden="true" />
            {balance} Stars
          </span>
        </div>
        {rewards.length === 0 ? (
          <p
            data-testid="rewards-empty"
            className="py-3 text-center text-sm font-bold text-gray-500"
          >
            No rewards yet — a grown-up can add some.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3" data-testid="rewards-grid">
            {rewards.map((r) => {
              const affordable = balance >= r.stickerCost;
              return (
                <li
                  key={r.id}
                  data-testid={`reward-card-${r.id}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border-2 border-black p-2.5 ${
                    affordable ? 'bg-white' : 'bg-gray-100 opacity-70'
                  }`}
                >
                  <span className="min-w-0 truncate text-sm font-bold text-black">
                    {r.icon ? `${r.icon} ` : ''}
                    {r.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      data-testid={`reward-cost-${r.id}`}
                      className="flex items-center gap-1 text-xs font-bold text-purple-700"
                    >
                      <Star size={12} className="fill-yellow-500" aria-hidden="true" />{' '}
                      {r.stickerCost}
                    </span>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => onRedeem(r)}
                      disabled={!affordable}
                      testId={`reward-buy-${r.id}`}
                    >
                      {affordable ? 'Buy' : 'Locked'}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
