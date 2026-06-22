import { useCallback, useEffect, useState } from 'react';
import { Coins, Gift, Sprout, Star } from 'lucide-react';
import { API_BASE } from '../../../lib/api';

// FHS-364 — the kid's My World money cards: Reward Goals (claim with stars),
// My Savings, and Growing Stars (investments). Reads GET /api/kid/rewards +
// /api/kid/financial; claims via POST /api/kid/rewards/:id/redeem (self-scoped,
// the same money logic the parent uses). Save/Invest actions are a follow-up.

const STICKER_TO_CASH = 0.5;

interface Reward {
  id: string;
  name: string;
  description: string | null;
  stickerCost: number;
  icon: string | null;
}
interface RewardsResponse {
  rewards: Reward[];
  stickerBalance: number;
}
interface Investment {
  id: string;
  habitName: string | null;
  habitIcon: string | null;
  investedStickers: number;
  currentValueStickers: number;
  currentValue: number;
  daysCompleted: number;
  daysMissed: number;
}
interface Financial {
  savedStickers: number;
  savedCash: number;
  currency: string;
  investments: Investment[];
}

export function KidRewardsPanel({ kidToken }: { kidToken: string | null }) {
  const [rewards, setRewards] = useState<RewardsResponse | null>(null);
  const [financial, setFinancial] = useState<Financial | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!kidToken) return;
      try {
        const headers = { Authorization: `Bearer ${kidToken}` };
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/api/kid/rewards`, { headers, signal: signal ?? null }),
          fetch(`${API_BASE}/api/kid/financial`, { headers, signal: signal ?? null }),
        ]);
        if (!r1.ok || !r2.ok) {
          setState('error');
          return;
        }
        const rewardsBody = (await r1.json()) as RewardsResponse;
        const financialBody = (await r2.json()) as Financial;
        if (!Array.isArray(rewardsBody.rewards) || !Array.isArray(financialBody.investments)) {
          setState('error');
          return;
        }
        setRewards(rewardsBody);
        setFinancial(financialBody);
        setState('loaded');
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError')) setState('error');
      }
    },
    [kidToken],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const claim = useCallback(
    async (reward: Reward) => {
      if (!kidToken || redeemingId) return;
      setRedeemingId(reward.id);
      setMsg(null);
      try {
        const r = await fetch(`${API_BASE}/api/kid/rewards/${reward.id}/redeem`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kidToken}`, 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (r.status === 409) {
          setMsg({ kind: 'err', text: `Not enough stars for ${reward.name} yet — keep going!` });
          return;
        }
        if (!r.ok) {
          setMsg({ kind: 'err', text: 'That didn’t work — try again.' });
          return;
        }
        setMsg({ kind: 'ok', text: `You claimed ${reward.name}! 🎉` });
        await load();
      } catch {
        setMsg({ kind: 'err', text: 'That didn’t work — check your connection.' });
      } finally {
        setRedeemingId(null);
      }
    },
    [kidToken, redeemingId, load],
  );

  if (state === 'loading') {
    return (
      <p
        data-testid="kid-rewards-loading"
        aria-busy="true"
        className="text-sm font-bold text-gray-600"
      >
        Loading your rewards…
      </p>
    );
  }
  if (state === 'error' || !rewards || !financial) {
    return (
      <p data-testid="kid-rewards-error" role="alert" className="text-sm font-bold text-red-600">
        Couldn&rsquo;t load your rewards — try again.
      </p>
    );
  }

  const balance = rewards.stickerBalance;
  const savedStars = financial.savedStickers + Math.floor(financial.savedCash / STICKER_TO_CASH);
  const savedValue = financial.savedStickers * STICKER_TO_CASH + financial.savedCash;

  return (
    <div className="space-y-4" data-testid="kid-rewards">
      {msg && (
        <p
          role={msg.kind === 'err' ? 'alert' : 'status'}
          data-testid="kid-rewards-msg"
          className={`rounded-lg border-2 px-3 py-2 text-center text-sm font-bold ${
            msg.kind === 'err'
              ? 'border-red-400 bg-red-50 text-red-700'
              : 'border-emerald-400 bg-emerald-50 text-emerald-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Reward Goals */}
      <section
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-sm"
        data-testid="kid-reward-goals"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-heading text-lg text-black">
            <Gift size={18} aria-hidden="true" /> Reward Goals
          </h3>
          <span
            className="flex items-center gap-1 rounded-md border-2 border-black bg-yellow-300 px-2 py-0.5 text-sm font-bold text-black"
            data-testid="kid-reward-balance"
          >
            <Star size={13} strokeWidth={3} aria-hidden="true" />
            {balance}
            <span className="sr-only"> stars to spend</span>
          </span>
        </div>
        {rewards.rewards.length === 0 ? (
          <p data-testid="kid-rewards-empty" className="text-sm font-bold text-gray-600">
            No rewards yet — a grown-up can add some!
          </p>
        ) : (
          <ul className="space-y-3">
            {rewards.rewards.map((r) => {
              const affordable = balance >= r.stickerCost;
              const pct = Math.min(100, Math.round((balance / Math.max(1, r.stickerCost)) * 100));
              const toGo = Math.max(0, r.stickerCost - balance);
              return (
                <li
                  key={r.id}
                  data-testid="kid-reward"
                  className="rounded-lg border-2 border-black p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-black">
                      {r.icon ? <span aria-hidden="true">{r.icon} </span> : null}
                      {r.name}
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gray-600">
                      <Star size={12} strokeWidth={3} aria-hidden="true" />
                      {r.stickerCost}
                    </span>
                  </div>
                  <div
                    className="mb-2 h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${r.name} progress`}
                  >
                    <div
                      className={`h-full ${affordable ? 'bg-emerald-400' : 'bg-yellow-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {affordable ? (
                    <button
                      type="button"
                      onClick={() => void claim(r)}
                      disabled={redeemingId !== null}
                      data-testid={`kid-reward-claim-${r.id}`}
                      className="min-h-[44px] w-full rounded-md border-2 border-black bg-emerald-300 py-2 font-bold text-black shadow-neo-xs motion-safe:hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {redeemingId === r.id ? 'Claiming…' : 'Claim Now! 🎉'}
                    </button>
                  ) : (
                    <p className="text-center text-sm font-bold text-gray-500">
                      {toGo} more star{toGo === 1 ? '' : 's'} to go!
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Money Skills: savings + growing stars */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section
          className="rounded-xl border-2 border-black bg-purple-50 p-4 shadow-neo-sm"
          data-testid="kid-savings"
        >
          <h3 className="mb-2 flex items-center gap-2 font-heading text-base text-black">
            <Coins size={16} aria-hidden="true" /> My Savings
          </h3>
          <p className="text-2xl font-bold text-black" data-testid="kid-savings-stars">
            {savedStars} <span className="text-base font-bold text-gray-500">stars</span>
          </p>
          <p className="text-sm font-bold text-gray-600">
            Worth {financial.currency} {savedValue.toFixed(2)}
          </p>
        </section>

        <section
          className="rounded-xl border-2 border-black bg-emerald-50 p-4 shadow-neo-sm"
          data-testid="kid-investments"
        >
          <h3 className="mb-2 flex items-center gap-2 font-heading text-base text-black">
            <Sprout size={16} aria-hidden="true" /> Growing Stars
          </h3>
          {financial.investments.length === 0 ? (
            <p data-testid="kid-investments-empty" className="text-sm font-bold text-gray-600">
              No growing stars yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {financial.investments.map((inv) => (
                <li
                  key={inv.id}
                  data-testid="kid-investment"
                  className="text-sm font-bold text-black"
                >
                  <span aria-hidden="true">{inv.habitIcon ?? '🌱'} </span>
                  {inv.habitName ?? 'A habit'} — {inv.currentValueStickers}★
                  <span className="ml-1 text-xs font-bold text-emerald-700">
                    (from {inv.investedStickers}★)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
