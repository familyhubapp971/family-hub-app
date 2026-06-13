import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Star } from 'lucide-react';
import { Button } from '@familyhub/ui';
import { useAuth } from '../../../lib/auth-context';
import { useTenantSlug } from '../../../lib/tenant-context';
import { API_BASE } from '../../../lib/api';

// FHS-268 — My World tab: weekly habit tracker + rewards shop.
//
// The habit tracker is a grid (rows = habits, columns = Mon-Sun). Each
// tick writes a habit_log worth one sticker; the rewards shop spends that
// balance. Toggles are optimistic with a revert on failure, and the
// sticker balance moves locally (+1 / -1) so the shop reacts instantly.

interface Habit {
  id: string;
  name: string;
  description: string | null;
  cadence: string;
  targetCount: number;
  color: string;
}
interface HabitLog {
  habitId: string;
  logDate: string;
}
interface Reward {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing `d` (UTC, Monday-anchored to match the
// rest of the schema).
export function mondayOfWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const shift = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift));
}

function addDaysIso(base: Date, days: number): string {
  return isoDate(
    new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days)),
  );
}

function key(habitId: string, dayIso: string): string {
  return `${habitId}|${dayIso}`;
}

type Status = 'loading' | 'ready' | 'error';

export function MyWorldTab({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [announce, setAnnounce] = useState('');
  const togglingRef = useRef<Set<string>>(new Set());
  const redeemingRef = useRef<Set<string>>(new Set());

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  // The week is anchored to "today" — fixed for the component's lifetime
  // so a render at midnight doesn't reshuffle columns mid-interaction.
  const week = useMemo(() => {
    const monday = mondayOfWeek(new Date());
    const weekStart = isoDate(monday);
    const days = DAY_LABELS.map((label, i) => ({ label, iso: addDaysIso(monday, i) }));
    return { weekStart, days };
  }, []);

  const load = useCallback(async () => {
    if (!headers) return;
    setStatus('loading');
    try {
      const [hRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/api/habits?memberId=${memberId}&weekStart=${week.weekStart}`, {
          headers,
        }),
        fetch(`${API_BASE}/api/rewards?memberId=${memberId}`, { headers }),
      ]);
      if (!hRes.ok || !rRes.ok) {
        setStatus('error');
        return;
      }
      const hBody = (await hRes.json()) as { habits: Habit[]; logs: HabitLog[] };
      const rBody = (await rRes.json()) as { rewards: Reward[]; stickerBalance: number };
      setHabits(hBody.habits ?? []);
      setLogged(new Set((hBody.logs ?? []).map((l) => key(l.habitId, l.logDate))));
      setRewards(rBody.rewards ?? []);
      setBalance(rBody.stickerBalance ?? 0);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [headers, memberId, week.weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = useCallback(
    async (habitId: string, dayIso: string) => {
      if (!headers) return;
      const k = key(habitId, dayIso);
      if (togglingRef.current.has(k)) return;
      togglingRef.current.add(k);
      const wasLogged = logged.has(k);
      const nextDone = !wasLogged;
      // Optimistic: flip the tick + nudge the balance by one sticker.
      setLogged((s) => {
        const next = new Set(s);
        if (nextDone) next.add(k);
        else next.delete(k);
        return next;
      });
      setBalance((b) => b + (nextDone ? 1 : -1));
      try {
        const res = await fetch(`${API_BASE}/api/habits/${habitId}/log`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, date: dayIso, done: nextDone }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
      } catch {
        // Revert both the tick and the balance.
        setLogged((s) => {
          const next = new Set(s);
          if (nextDone) next.delete(k);
          else next.add(k);
          return next;
        });
        setBalance((b) => b + (nextDone ? -1 : 1));
        setAnnounce("Couldn't save that — try again.");
      } finally {
        togglingRef.current.delete(k);
      }
    },
    [headers, logged, memberId],
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

  return (
    <div className="space-y-6" data-testid="my-world">
      <p aria-live="polite" className="sr-only" data-testid="my-world-announce">
        {announce}
      </p>

      {/* Habit tracker */}
      <section
        aria-labelledby="habit-tracker-heading"
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-6"
        data-testid="habit-tracker"
      >
        <h2 id="habit-tracker-heading" className="mb-4 font-heading text-xl text-black">
          My Habits
        </h2>
        {habits.length === 0 ? (
          <p
            data-testid="habits-empty"
            className="py-3 text-center text-sm font-bold text-gray-500"
          >
            No habits yet — a grown-up can add some.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-1 text-left text-xs font-bold text-gray-500">Habit</th>
                  {week.days.map((d) => (
                    <th key={d.iso} className="p-1 text-center text-[10px] font-bold text-gray-500">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => (
                  <tr key={h.id} data-testid={`habit-row-${h.id}`}>
                    <td className="py-1.5 pr-2">
                      <span
                        data-testid={`habit-name-${h.id}`}
                        className="flex items-center gap-2 font-heading text-sm text-black"
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block h-3 w-3 rounded-full border border-black"
                          style={{ backgroundColor: h.color }}
                        />
                        {h.name}
                      </span>
                    </td>
                    {week.days.map((d) => {
                      const isOn = logged.has(key(h.id, d.iso));
                      return (
                        <td key={d.iso} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => onToggle(h.id, d.iso)}
                            aria-pressed={isOn}
                            aria-label={`${h.name} on ${d.label}: ${isOn ? 'done' : 'not done'}`}
                            data-testid={`habit-cell-${h.id}-${d.iso}`}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-black motion-safe:transition-colors ${
                              isOn ? 'bg-green-400' : 'bg-gray-50 hover:bg-yellow-100'
                            }`}
                          >
                            {isOn && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rewards shop */}
      <section
        aria-labelledby="rewards-shop-heading"
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm md:p-6"
        data-testid="rewards-shop"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="rewards-shop-heading" className="font-heading text-xl text-black">
            Rewards Shop
          </h2>
          <span
            data-testid="sticker-balance"
            className="flex items-center gap-1.5 rounded-full border-2 border-black bg-yellow-300 px-3 py-1 font-heading text-sm text-black shadow-neo-xs"
          >
            <Star size={16} className="fill-yellow-500" aria-hidden="true" />
            {balance} {balance === 1 ? 'sticker' : 'stickers'}
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
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="rewards-grid"
          >
            {rewards.map((r) => {
              const affordable = balance >= r.stickerCost;
              return (
                <li
                  key={r.id}
                  data-testid={`reward-card-${r.id}`}
                  className={`flex flex-col gap-2 rounded-xl border-2 border-black p-3 shadow-neo-xs ${
                    affordable ? 'bg-violet-50' : 'bg-gray-100 opacity-70'
                  }`}
                >
                  <span aria-hidden="true" className="text-3xl">
                    {r.icon ?? '🎁'}
                  </span>
                  <p className="font-heading text-sm text-black">{r.name}</p>
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
