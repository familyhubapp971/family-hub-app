/**
 * AdminPanelPage — FHS-308
 *
 * Per-child admin panel reached from /t/:slug/admin.
 * Faithfully ports the legacy AdminPanel look (orange→pink gradient header,
 * pill tab bar, neo-brutalist cards, Quick-Actions grid, Admin Override Active
 * amber banner) and adapts it to the per-child economy: a child selector at
 * the top controls which member's data is shown in Balance / Savings /
 * History. Users and App Info are family-level and not child-scoped.
 *
 * Users tab divergence: this app already ships a full member-management
 * experience on the Manage Members page. The Users tab here is therefore
 * a read-only roster — no permission toggles, no add-user form, no contact
 * editing. A "Manage in Members →" link sends the admin there for mutations.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Info,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmDialog } from '@familyhub/ui';
import { useAuth } from '../../lib/auth-context';
import { useTenantSlug } from '../../lib/tenant-context';
import { API_BASE } from '../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = 'balance' | 'savings' | 'history' | 'users' | 'app-info';

interface MemberItem {
  id: string;
  displayName: string;
  role: string;
  avatarEmoji: string | null;
  isChild: boolean;
}

interface WeekStats {
  availableStickers: number;
  availableCash: number;
  totalEarned: number;
  weekId: string;
}

interface CurrentWeek {
  id: string;
  weekNumber: number;
  year: number;
  isFinalized: boolean;
}

interface SavingsData {
  savedStickers: number;
  savedCash: number;
  cashEquivalent: number;
}

interface WeekRow {
  id: string;
  weekNumber: number;
  year: number;
  status: 'Active' | 'Finalized';
  isFinalized?: boolean;
  carriedOverStickers: number;
  carriedOverCash: number;
  retrievedStickers: number;
  retrievedCash: number;
}

interface WeekAction {
  id: number;
  actionType: string;
  stickersUsed: number | null;
  cashAmount: number | null;
  rewardName: string | null;
}

interface AppSettings {
  appName: string;
  appSubtitle: string;
}

// Sub-dialog types for Balance Quick Actions
type QuickAction = 'claim' | 'cashout' | 'save' | 'invest' | 'withdraw' | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { disc: string; badge: string; label: string }> = {
  admin: { disc: 'bg-pink-300', badge: 'bg-pink-200', label: 'Admin' },
  adult: { disc: 'bg-cyan-300', badge: 'bg-cyan-200', label: 'Parent' },
  teen: { disc: 'bg-yellow-300', badge: 'bg-yellow-200', label: 'Teen' },
  child: { disc: 'bg-purple-300', badge: 'bg-purple-200', label: 'Child' },
  guest: { disc: 'bg-gray-300', badge: 'bg-gray-200', label: 'Guest' },
};

function roleStyle(role: string) {
  return ROLE_STYLE[role] ?? ROLE_STYLE['guest']!;
}

function initial(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

// ── Child selector ────────────────────────────────────────────────────────────

function ChildSelector({
  kids,
  selectedId,
  onSelect,
}: {
  kids: MemberItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (kids.length === 0) return null;
  return (
    <div
      data-testid="admin-child-selector"
      className="bg-white rounded-2xl border-2 border-black shadow-neo-md p-4"
    >
      <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">
        Select child to manage
      </p>
      <div className="flex flex-wrap gap-2">
        {kids.map((c) => {
          const rs = roleStyle(c.role);
          const selected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              data-testid={`admin-child-selector-${c.id}`}
              onClick={() => onSelect(c.id)}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
                'min-h-[44px]',
                selected
                  ? 'border-black bg-yellow-400 shadow-neo-xs -translate-y-0.5'
                  : 'border-gray-200 bg-white hover:border-black hover:shadow-neo-xs',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={`w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-xs font-heading ${rs.disc}`}
              >
                {c.avatarEmoji ?? initial(c.displayName)}
              </span>
              <span>{c.displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Action modal shells (reuse CloseWeekDialog sub-dialogs via inline forms) ──

/**
 * Inline Claim-reward quick action.
 * Fetches the reward list for the selected child and redeems via
 * POST /api/rewards/:id/redeem { memberId }.
 */
function ClaimQuickAction({
  memberId,
  headers,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [rewards, setRewards] = useState<
    { id: string; name: string; stickerCost: number; icon: string | null }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/rewards?memberId=${memberId}`, { headers })
      .then((r) => (r.ok ? r.json() : { rewards: [] }))
      .then((b: { rewards: typeof rewards }) => setRewards(b.rewards ?? []))
      .catch(() => setRewards([]))
      .finally(() => setLoading(false));
  }, [memberId, headers]);

  const handleClaim = async () => {
    if (!selected || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rewards/${selected}/redeem`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error(`Redeem failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to redeem reward');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-claim" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
        🎁 Claim Reward
      </h4>
      {loading && <p className="text-sm text-gray-500">Loading rewards…</p>}
      {!loading && rewards.length === 0 && (
        <p className="text-sm text-gray-500">No rewards available for this child.</p>
      )}
      {!loading && rewards.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {rewards.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all text-left',
                selected === r.id
                  ? 'bg-pink-100 border-black shadow-neo-xs'
                  : 'bg-white border-gray-200 hover:border-black',
              ].join(' ')}
            >
              <span className="font-bold text-sm text-gray-900">
                {r.icon ?? '🎁'} {r.name}
              </span>
              <span className="text-xs font-black bg-yellow-400 border-2 border-black px-2 py-0.5 rounded-lg">
                {r.stickerCost}⭐
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!selected || busy}
          onClick={() => void handleClaim()}
          testId="admin-quick-action-claim-submit"
        >
          {busy ? 'Claiming…' : 'Claim'}
        </Button>
      </div>
    </div>
  );
}

function CashOutQuickAction({
  memberId,
  headers,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCashOut = async () => {
    const num = Number(amount);
    if (!num || num <= 0 || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings/cashout`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, amount: num }),
      });
      if (!res.ok) throw new Error(`Cashout failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cash out');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-cashout" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
        💰 Cash Out
      </h4>
      <div>
        <label
          htmlFor="qa-cashout-amount"
          className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
        >
          Amount (AED)
        </label>
        <input
          id="qa-cashout-amount"
          type="number"
          min={0}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="admin-quick-action-cashout-amount"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="success"
          size="sm"
          disabled={!amount || Number(amount) <= 0 || busy}
          onClick={() => void handleCashOut()}
          testId="admin-quick-action-cashout-submit"
        >
          {busy ? 'Processing…' : 'Confirm'}
        </Button>
      </div>
    </div>
  );
}

function SaveQuickAction({
  memberId,
  headers,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [type, setType] = useState<'stickers' | 'cash'>('stickers');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const num = Number(amount);
    if (!num || num <= 0 || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, type, amount: num }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-save" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
        🐷 Save for Later
      </h4>
      <div className="flex gap-2">
        <button
          onClick={() => setType('stickers')}
          className={[
            'flex-1 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
            type === 'stickers'
              ? 'bg-yellow-400 border-black shadow-neo-xs'
              : 'bg-white border-gray-200 hover:border-black',
          ].join(' ')}
        >
          ⭐ Stickers
        </button>
        <button
          onClick={() => setType('cash')}
          className={[
            'flex-1 px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
            type === 'cash'
              ? 'bg-emerald-400 border-black shadow-neo-xs'
              : 'bg-white border-gray-200 hover:border-black',
          ].join(' ')}
        >
          💵 Cash (AED)
        </button>
      </div>
      <div>
        <label
          htmlFor="qa-save-amount"
          className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
        >
          Amount
        </label>
        <input
          id="qa-save-amount"
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="admin-quick-action-save-amount"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!amount || Number(amount) <= 0 || busy}
          onClick={() => void handleSave()}
          testId="admin-quick-action-save-submit"
        >
          {busy ? 'Saving…' : 'Save It!'}
        </Button>
      </div>
    </div>
  );
}

function InvestQuickAction({
  memberId,
  currentWeekId,
  headers,
  onClose,
}: {
  memberId: string;
  currentWeekId: string | null;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [habits, setHabits] = useState<{ id: string; name: string }[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers || !currentWeekId) return;
    fetch(`${API_BASE}/api/habits?memberId=${memberId}&weekId=${currentWeekId}`, { headers })
      .then((r) => (r.ok ? r.json() : { habits: [] }))
      .then((b: { habits: typeof habits }) => setHabits(b.habits ?? []))
      .catch(() => {});
  }, [memberId, currentWeekId, headers]);

  const handleInvest = async () => {
    const num = Number(amount);
    if (!num || num < 10 || !selectedHabitId || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/investments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, habitId: selectedHabitId, stickerCount: num }),
      });
      if (!res.ok) throw new Error(`Invest failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invest');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-invest" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
        📈 Invest &amp; Grow
      </h4>
      <div>
        <label
          htmlFor="qa-invest-amount"
          className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
        >
          Sticker Amount (min 10)
        </label>
        <input
          id="qa-invest-amount"
          type="number"
          min={10}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="admin-quick-action-invest-amount"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
        />
      </div>
      {habits.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            Choose Habit
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHabitId(h.id)}
                className={[
                  'w-full text-left px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all',
                  selectedHabitId === h.id
                    ? 'bg-yellow-400 border-black shadow-neo-xs'
                    : 'bg-white border-gray-200 hover:border-black',
                ].join(' ')}
              >
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!amount || Number(amount) < 10 || !selectedHabitId || busy}
          onClick={() => void handleInvest()}
          testId="admin-quick-action-invest-submit"
        >
          {busy ? 'Investing…' : 'Invest'}
        </Button>
      </div>
    </div>
  );
}

function WithdrawQuickAction({
  memberId,
  headers,
  onClose,
}: {
  memberId: string;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const [investments, setInvestments] = useState<
    { id: string; habitName: string | null; currentValueStickers: number }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/mw/financial/investments?memberId=${memberId}`, { headers })
      .then((r) => (r.ok ? r.json() : { investments: [] }))
      .then((b: { investments: typeof investments }) => setInvestments(b.investments ?? []))
      .catch(() => setInvestments([]))
      .finally(() => setLoading(false));
  }, [memberId, headers]);

  const handleWithdraw = async () => {
    if (!selectedId || !headers) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/investments/${selectedId}/withdraw`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error(`Withdraw failed: ${res.status}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw');
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-quick-action-withdraw" className="space-y-4">
      <h4 className="font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
        🏦 Withdraw Investment
      </h4>
      {loading && <p className="text-sm text-gray-500">Loading investments…</p>}
      {!loading && investments.length === 0 && (
        <p className="text-sm text-gray-500">No active investments to withdraw.</p>
      )}
      {!loading && investments.length > 0 && (
        <div className="space-y-2">
          {investments.map((inv) => (
            <button
              key={inv.id}
              onClick={() => setSelectedId(inv.id)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 rounded-xl border-2 transition-all text-left',
                selectedId === inv.id
                  ? 'bg-orange-100 border-black shadow-neo-xs'
                  : 'bg-white border-gray-200 hover:border-black',
              ].join(' ')}
            >
              <span className="font-bold text-sm">{inv.habitName ?? 'Investment'}</span>
              <span className="text-xs font-black bg-orange-200 border border-orange-400 px-2 py-0.5 rounded">
                {inv.currentValueStickers}⭐
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={!selectedId || busy || loading}
          onClick={() => void handleWithdraw()}
          testId="admin-quick-action-withdraw-submit"
        >
          {busy ? 'Withdrawing…' : 'Withdraw'}
        </Button>
      </div>
    </div>
  );
}

// ── Quick Action modal container ──────────────────────────────────────────────

function QuickActionModal({
  action,
  memberId,
  currentWeekId,
  headers,
  onClose,
}: {
  action: QuickAction;
  memberId: string;
  currentWeekId: string | null;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  if (!action) return null;
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- backdrop dismiss
    <div
      role="dialog"
      aria-modal="true"
      data-testid={`admin-quick-action-modal-${action}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl bg-black" />
        <div className="relative rounded-2xl border-2 border-black bg-white p-5 shadow-neo sm:border-3 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 text-gray-500 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {action === 'claim' && (
            <ClaimQuickAction memberId={memberId} headers={headers} onClose={onClose} />
          )}
          {action === 'cashout' && (
            <CashOutQuickAction memberId={memberId} headers={headers} onClose={onClose} />
          )}
          {action === 'save' && (
            <SaveQuickAction memberId={memberId} headers={headers} onClose={onClose} />
          )}
          {action === 'invest' && (
            <InvestQuickAction
              memberId={memberId}
              currentWeekId={currentWeekId}
              headers={headers}
              onClose={onClose}
            />
          )}
          {action === 'withdraw' && (
            <WithdrawQuickAction memberId={memberId} headers={headers} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Balance tab ───────────────────────────────────────────────────────────────

function BalanceTab({
  memberId,
  currentWeekId,
  headers,
}: {
  memberId: string;
  currentWeekId: string | null;
  headers: Record<string, string> | null;
}) {
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<QuickAction>(null);

  const fetchStats = useCallback(async () => {
    if (!headers || !currentWeekId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/mw/weeks/${currentWeekId}/stats?memberId=${memberId}`,
        { headers },
      );
      if (!res.ok) throw new Error(`Stats failed: ${res.status}`);
      const data = (await res.json()) as WeekStats;
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [headers, currentWeekId, memberId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleActionClose = () => {
    setActiveAction(null);
    void fetchStats();
  };

  if (loading)
    return (
      <p data-testid="admin-balance-loading" className="text-sm text-purple-200">
        Loading balance…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-balance-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  const stickers = stats?.availableStickers ?? 0;
  const cashValue = (stickers * 0.5).toFixed(2);

  return (
    <div
      data-testid="admin-balance-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-yellow-50" data-testid="admin-balance-stickers-card">
          <p className="text-xs font-black text-yellow-600 uppercase tracking-wide mb-1">
            Available Stickers
          </p>
          <div className="flex items-baseline gap-2">
            <span
              data-testid="admin-balance-stickers-display"
              className="text-3xl font-black text-yellow-700"
            >
              {stickers}
            </span>
            <Star className="w-6 h-6 text-yellow-500 fill-current" />
          </div>
        </Card>
        <Card className="p-5 bg-green-50" data-testid="admin-balance-cash-card">
          <p className="text-xs font-black text-green-600 uppercase tracking-wide mb-1">
            Cash Value
          </p>
          <span
            data-testid="admin-balance-cash-display"
            className="text-3xl font-black text-green-700"
          >
            AED {cashValue}
          </span>
        </Card>
      </div>

      {/* Quick Actions grid */}
      <Card className="p-5">
        <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" /> Quick Actions
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              action: 'claim' as const,
              emoji: '🎁',
              label: 'Claim Reward',
              sub: 'Spend',
              bg: 'bg-pink-400',
            },
            {
              action: 'cashout' as const,
              emoji: '💰',
              label: 'Cash Out',
              sub: 'Withdraw',
              bg: 'bg-lime-400',
            },
            {
              action: 'save' as const,
              emoji: '🐷',
              label: 'Save for Later',
              sub: 'Keep',
              bg: 'bg-cyan-400',
            },
            {
              action: 'invest' as const,
              emoji: '📈',
              label: 'Invest & Grow',
              sub: 'Grow',
              bg: 'bg-yellow-400',
            },
          ].map(({ action, emoji, label, sub, bg }) => (
            <button
              key={action}
              data-testid={`admin-balance-action-${action}`}
              onClick={() => setActiveAction(action)}
              className={[
                `group relative h-28 sm:h-32 ${bg} border-2 sm:border-3 border-black rounded-2xl shadow-neo`,
                'motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none',
                'transition-all overflow-hidden',
              ].join(' ')}
            >
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              <div className="absolute top-2 right-2 text-2xl sm:text-3xl motion-safe:group-hover:scale-125 transition-transform duration-300">
                {emoji}
              </div>
              <div className="absolute bottom-3 left-3 text-left">
                <p className="text-[10px] font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                  {sub}
                </p>
                <p className="text-sm sm:text-lg font-black text-black leading-none">{label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Withdraw investment spans full width on desktop, half on mobile */}
        <div className="mt-3">
          <button
            data-testid="admin-balance-action-withdraw"
            onClick={() => setActiveAction('withdraw')}
            className={[
              'group relative w-full h-24 sm:h-28 bg-orange-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo',
              'motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none',
              'transition-all overflow-hidden',
            ].join(' ')}
          >
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            <div className="absolute top-2 right-2 text-2xl sm:text-3xl motion-safe:group-hover:scale-125 transition-transform duration-300">
              🏦
            </div>
            <div className="absolute bottom-3 left-3 text-left">
              <p className="text-[10px] font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                Exit Early
              </p>
              <p className="text-sm sm:text-lg font-black text-black leading-none">
                Withdraw Investment
              </p>
            </div>
          </button>
        </div>

        {/* Admin Override Active banner */}
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Admin Override Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              All financial actions are available to you at all times, regardless of the day.
            </p>
          </div>
        </div>
      </Card>

      {/* Quick Action Modal */}
      {activeAction && (
        <QuickActionModal
          action={activeAction}
          memberId={memberId}
          currentWeekId={currentWeekId}
          headers={headers}
          onClose={handleActionClose}
        />
      )}
    </div>
  );
}

// ── Savings tab ───────────────────────────────────────────────────────────────

function SavingsTab({
  memberId,
  headers,
}: {
  memberId: string;
  headers: Record<string, string> | null;
}) {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tempCash, setTempCash] = useState(0);
  const [tempStickers, setTempStickers] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchSavings = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings?memberId=${memberId}`, {
        headers,
      });
      if (!res.ok) throw new Error(`Savings fetch failed: ${res.status}`);
      const body = (await res.json()) as SavingsData;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load savings');
    } finally {
      setLoading(false);
    }
  }, [headers, memberId]);

  useEffect(() => {
    void fetchSavings();
  }, [fetchSavings]);

  const startEdit = () => {
    setTempCash(data?.savedCash ?? 0);
    setTempStickers(data?.savedStickers ?? 0);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!headers) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings/admin-set`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, savedStickers: tempStickers, savedCash: tempCash }),
      });
      if (!res.ok) throw new Error(`Admin-set failed: ${res.status}`);
      await fetchSavings();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update savings');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-savings-loading" className="text-sm text-purple-200">
        Loading savings…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-savings-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  const savedCash = data?.savedCash ?? 0;
  const savedStickers = data?.savedStickers ?? 0;
  const cashEquiv = (savedStickers * 0.5 + savedCash).toFixed(2);

  return (
    <div
      data-testid="admin-savings-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-sm">
            <Pencil className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Savings Balance</h3>
            <p className="text-sm text-emerald-400 font-medium">Long-term savings</p>
          </div>
        </div>
        <button
          data-testid="admin-savings-edit-btn"
          onClick={editing ? () => setEditing(false) : startEdit}
          className={[
            'text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border min-h-[44px]',
            editing
              ? 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          ].join(' ')}
        >
          {editing ? (
            <>
              <X className="w-3 h-3" /> Cancel
            </>
          ) : (
            <>
              <Pencil className="w-3 h-3" /> Edit
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-green-50">
          <p className="text-xs font-black text-green-600 uppercase tracking-wide mb-1">
            Cash Savings
          </p>
          <span
            data-testid="admin-savings-cash-display"
            className="text-3xl font-black text-green-700"
          >
            AED {savedCash.toFixed(2)}
          </span>
          <p className="text-xs text-gray-400 font-medium mt-2">Liquid cash for withdrawal</p>
        </Card>
        <Card className="p-5 bg-purple-50">
          <p className="text-xs font-black text-purple-600 uppercase tracking-wide mb-1">
            Sticker Savings
          </p>
          <div className="flex items-baseline gap-2">
            <span
              data-testid="admin-savings-sticker-display"
              className="text-3xl font-black text-purple-700"
            >
              {savedStickers}
            </span>
            <Star className="w-5 h-5 text-purple-500 fill-current" />
          </div>
          <p className="text-xs text-gray-400 font-medium mt-2">Saved for future rewards</p>
        </Card>
      </div>

      <Card className="p-5 bg-orange-50 text-center">
        <p className="text-xs font-black text-orange-600 uppercase tracking-wide mb-1">
          Cash Equivalent
        </p>
        <span className="text-3xl font-black text-orange-700">AED {cashEquiv}</span>
      </Card>

      {editing && (
        <Card className="p-5 animate-in zoom-in-95 duration-200">
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3 items-start mb-5">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-yellow-800">Manual Adjustment Warning</p>
              <p className="text-xs text-yellow-700 mt-1">
                This directly updates the database. Use only to correct errors or restore lost data.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="savings-cash-input"
                className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
              >
                Cash Savings (AED)
              </label>
              <input
                id="savings-cash-input"
                type="number"
                min={0}
                step={0.01}
                value={tempCash}
                onChange={(e) => setTempCash(Number(e.target.value))}
                data-testid="admin-savings-cash-input"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="savings-sticker-input"
                className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
              >
                Sticker Savings
              </label>
              <input
                id="savings-sticker-input"
                type="number"
                min={0}
                step={1}
                value={tempStickers}
                onChange={(e) => setTempStickers(Number(e.target.value))}
                data-testid="admin-savings-sticker-input"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={saving}
                onClick={() => void handleSave()}
                testId="admin-savings-save-btn"
              >
                {saving ? 'Updating…' : 'Update Savings'}
              </Button>
              <Button variant="secondary" size="md" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({
  memberId,
  headers,
}: {
  memberId: string;
  headers: Record<string, string> | null;
}) {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempCash, setTempCash] = useState({ carriedOverCash: 0, retrievedCash: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actions, setActions] = useState<WeekAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  // Confirm dialogs
  const [reopenTarget, setReopenTarget] = useState<string | null>(null);
  const [repairTarget, setRepairTarget] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchWeeks = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks?memberId=${memberId}`, { headers });
      if (!res.ok) throw new Error(`Weeks fetch failed: ${res.status}`);
      const body = (await res.json()) as { weeks?: WeekRow[] } | WeekRow[];
      const raw = Array.isArray(body) ? body : (body.weeks ?? []);
      const mapped: WeekRow[] = raw.map(
        (w) =>
          ({
            ...w,
            status:
              w.status === 'Active' || !w.status
                ? (w.isFinalized ?? false)
                  ? 'Finalized'
                  : 'Active'
                : w.status,
          }) as WeekRow,
      );
      mapped.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      });
      setWeeks(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weeks');
    } finally {
      setLoading(false);
    }
  }, [headers, memberId]);

  useEffect(() => {
    void fetchWeeks();
  }, [fetchWeeks]);

  const toggleActions = async (weekId: string) => {
    if (expandedId === weekId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(weekId);
    setActionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/actions?memberId=${memberId}`, {
        headers: headers ?? {},
      });
      if (!res.ok) {
        setActions([]);
        return;
      }
      const body = (await res.json()) as { actions?: WeekAction[] } | WeekAction[];
      const list = Array.isArray(body) ? body : (body.actions ?? []);
      setActions(list);
    } catch {
      setActions([]);
    } finally {
      setActionsLoading(false);
    }
  };

  const saveWeekCash = async (weekId: string) => {
    if (!headers) return;
    setActionError(null);
    const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/cash`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, ...tempCash }),
    });
    if (!res.ok) {
      setActionError(`Cash update failed: ${res.status}`);
      return;
    }
    setWeeks((prev) => prev.map((w) => (w.id === weekId ? { ...w, ...tempCash } : w)));
    setEditingId(null);
  };

  const doReopen = async (weekId: string) => {
    if (!headers) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/reopen`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        setActionError(`Reopen failed: ${res.status}`);
        return;
      }
      setWeeks((prev) =>
        prev.map((w) => (w.id === weekId ? { ...w, status: 'Active' as const } : w)),
      );
    } finally {
      setActionBusy(false);
      setReopenTarget(null);
    }
  };

  const doRepair = async (weekId: string) => {
    if (!headers) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/repair`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        setActionError(`Repair failed: ${res.status}`);
        return;
      }
      await fetchWeeks();
    } finally {
      setActionBusy(false);
      setRepairTarget(null);
    }
  };

  const doClose = async (weekId: string) => {
    if (!headers) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/finalize`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, continueInvestmentIds: [] }),
      });
      if (!res.ok) {
        setActionError(`Close week failed: ${res.status}`);
        return;
      }
      await fetchWeeks();
    } finally {
      setActionBusy(false);
      setCloseTarget(null);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-history-loading" className="text-sm text-purple-200">
        Loading history…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-history-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  return (
    <div
      data-testid="admin-history-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center gap-3">
        <div className="bg-blue-500 p-2.5 rounded-xl text-white shadow-sm">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">Week History</h3>
          <p className="text-sm text-blue-400 font-medium">Review and edit past week data</p>
        </div>
      </div>

      <div className="space-y-4">
        {weeks.length === 0 && (
          <p className="text-sm text-purple-200">No weeks found for this child.</p>
        )}
        {weeks.map((week) => (
          <div
            key={week.id}
            data-testid={`admin-history-week-${week.id}`}
            className="bg-white rounded-2xl border-2 border-black shadow-neo-md overflow-hidden"
          >
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg text-gray-500">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">
                    Week {week.weekNumber}, {week.year}
                  </h4>
                  <span
                    className={[
                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
                      week.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600',
                    ].join(' ')}
                  >
                    {week.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {week.status === 'Finalized' && (
                  <button
                    data-testid={`admin-history-week-reopen-btn-${week.id}`}
                    onClick={() => setReopenTarget(week.id)}
                    className="min-h-[44px] bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-amber-100 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reopen
                  </button>
                )}
                {week.status === 'Active' && (
                  <>
                    <button
                      data-testid={`admin-history-week-repair-btn-${week.id}`}
                      onClick={() => setRepairTarget(week.id)}
                      className="min-h-[44px] bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-purple-100 transition-colors"
                    >
                      <Wrench className="w-3 h-3" /> Repair
                    </button>
                    <button
                      data-testid={`admin-history-week-close-btn-${week.id}`}
                      onClick={() => setCloseTarget(week.id)}
                      className="min-h-[44px] bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Close Week
                    </button>
                  </>
                )}
                {editingId !== week.id ? (
                  <button
                    data-testid={`admin-history-week-edit-btn-${week.id}`}
                    onClick={() => {
                      setEditingId(week.id);
                      setTempCash({
                        carriedOverCash: week.carriedOverCash,
                        retrievedCash: week.retrievedCash,
                      });
                    }}
                    className="min-h-[44px] bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingId(null)}
                    className="min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-gray-50/50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Carried Forward</p>
                  <p className="font-medium text-gray-700">
                    {week.carriedOverStickers} stickers
                    <span className="text-gray-400 mx-1">•</span>
                    AED {(week.carriedOverCash ?? 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Retrieved</p>
                  <p className="font-medium text-gray-700">
                    {week.retrievedStickers} stickers
                    <span className="text-gray-400 mx-1">•</span>
                    AED {(week.retrievedCash ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Actions viewer */}
              <div className="mt-3">
                <button
                  data-testid={`admin-history-week-actions-btn-${week.id}`}
                  onClick={() => void toggleActions(week.id)}
                  className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  {expandedId === week.id ? 'Hide Actions' : 'View Actions'}
                </button>
                {expandedId === week.id && (
                  <div className="mt-2 space-y-1.5">
                    {actionsLoading ? (
                      <p className="text-xs text-gray-400">Loading…</p>
                    ) : actions.length === 0 ? (
                      <p className="text-xs text-gray-400">No actions recorded</p>
                    ) : (
                      actions.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-xs bg-white border border-gray-100 rounded-lg px-3 py-2"
                        >
                          <span className="font-bold text-gray-700 capitalize">
                            {a.actionType.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500">
                            {a.stickersUsed ? `${a.stickersUsed} stickers` : ''}
                            {a.cashAmount ? ` • AED ${a.cashAmount.toFixed(2)}` : ''}
                            {a.rewardName ? ` • ${a.rewardName}` : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Edit form */}
              {editingId === week.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label
                        htmlFor={`hist-carried-cash-${week.id}`}
                        className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
                      >
                        Carried Cash (AED)
                      </label>
                      <input
                        id={`hist-carried-cash-${week.id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={tempCash.carriedOverCash}
                        onChange={(e) =>
                          setTempCash((p) => ({ ...p, carriedOverCash: Number(e.target.value) }))
                        }
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:border-orange-400 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`hist-retrieved-cash-${week.id}`}
                        className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
                      >
                        Retrieved Cash (AED)
                      </label>
                      <input
                        id={`hist-retrieved-cash-${week.id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={tempCash.retrievedCash}
                        onChange={(e) =>
                          setTempCash((p) => ({ ...p, retrievedCash: Number(e.target.value) }))
                        }
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-medium text-gray-900 focus:border-orange-400 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <button
                    data-testid={`admin-history-week-save-btn-${week.id}`}
                    onClick={() => void saveWeekCash(week.id)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Update Week Data
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 font-medium">
          Week summary data shows what was carried forward and retrieved. Edit cash fields to fix
          week-to-week balances.
        </p>
      </div>

      {/* Action error */}
      {actionError && (
        <p data-testid="admin-history-action-error" className="text-sm text-red-600 font-bold">
          {actionError}
        </p>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={reopenTarget !== null}
        title="Reopen this week?"
        message="The week will become active again. Any finalized calculations will be reversed."
        confirmLabel="Reopen"
        busy={actionBusy}
        onConfirm={() => {
          if (reopenTarget) void doReopen(reopenTarget);
        }}
        onCancel={() => setReopenTarget(null)}
        testId="admin-history-reopen-confirm"
      />
      <ConfirmDialog
        isOpen={repairTarget !== null}
        title="Repair this week?"
        message="This re-runs the week calculation to fix any inconsistencies."
        confirmLabel="Repair"
        busy={actionBusy}
        onConfirm={() => {
          if (repairTarget) void doRepair(repairTarget);
        }}
        onCancel={() => setRepairTarget(null)}
        testId="admin-history-repair-confirm"
      />
      <ConfirmDialog
        isOpen={closeTarget !== null}
        title="Close this week?"
        message="The week will be finalized. Make sure all actions are done first."
        confirmLabel="Close Week"
        busy={actionBusy}
        onConfirm={() => {
          if (closeTarget) void doClose(closeTarget);
        }}
        onCancel={() => setCloseTarget(null)}
        testId="admin-history-close-confirm"
      />
    </div>
  );
}

// ── Users tab (read-only roster) ──────────────────────────────────────────────

/**
 * Users tab divergence from legacy:
 * The legacy AdminPanel had full add-user / permissions / contact-edit flows.
 * This app already provides that on Manage Members (/t/:slug/members).
 * This tab is therefore a read-only roster — avatars, names, role badges —
 * with a "Manage in Members →" link for any mutations.
 */
function UsersTab({ headers, slug }: { headers: Record<string, string> | null; slug: string }) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/members`, { headers })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((b: { members: MemberItem[] }) => setMembers(b.members ?? []))
      .catch(() => setError('Failed to load members'))
      .finally(() => setLoading(false));
  }, [headers]);

  if (loading)
    return (
      <p data-testid="admin-users-loading" className="text-sm text-purple-200">
        Loading members…
      </p>
    );
  if (error)
    return (
      <p data-testid="admin-users-error" className="text-sm text-red-300">
        {error}
      </p>
    );

  return (
    <div
      data-testid="admin-users-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Family Members</h3>
            <p className="text-sm text-indigo-400 font-medium">Read-only roster</p>
          </div>
        </div>
        <Link
          to={`/t/${slug}/members`}
          data-testid="admin-users-manage-link"
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-gray-300 min-h-[44px] flex items-center transition-colors"
        >
          Manage in Members →
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 font-medium">
          Member management (inviting parents, setting PINs, removing members) is done on the{' '}
          <Link to={`/t/${slug}/members`} className="underline font-bold">
            Manage Members
          </Link>{' '}
          page. This view is a read-only snapshot.
        </p>
      </div>

      <ul
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="admin-users-list"
      >
        {members.map((m, idx) => {
          const rs = roleStyle(m.role);
          return (
            <li key={m.id} data-testid={`admin-users-row-${idx}`} className="list-none">
              <Card className="flex items-center gap-3 p-4 bg-white">
                <span
                  aria-hidden="true"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-black font-heading text-xl ${rs.disc}`}
                >
                  {m.avatarEmoji ?? initial(m.displayName)}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{m.displayName}</p>
                  <span
                    data-testid={`admin-users-row-${idx}-role`}
                    className={`inline-block mt-0.5 rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-bold ${rs.badge}`}
                  >
                    {rs.label}
                  </span>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── App Info tab ──────────────────────────────────────────────────────────────

function AppInfoTab({ headers }: { headers: Record<string, string> | null }) {
  const [settings, setSettings] = useState<AppSettings>({ appName: '', appSubtitle: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempSubtitle, setTempSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!headers) return;
    setLoading(true);
    fetch(`${API_BASE}/api/admin/settings`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((b: Partial<AppSettings>) =>
        setSettings({ appName: b.appName ?? '', appSubtitle: b.appSubtitle ?? '' }),
      )
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [headers]);

  const startEdit = () => {
    setTempName(settings.appName);
    setTempSubtitle(settings.appSubtitle);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!headers) return;
    setSaving(true);
    setError(null);
    try {
      const updates: [string, string][] = [];
      if (tempName !== settings.appName) updates.push(['appName', tempName]);
      if (tempSubtitle !== settings.appSubtitle) updates.push(['appSubtitle', tempSubtitle]);
      for (const [key, value] of updates) {
        const res = await fetch(`${API_BASE}/api/admin/settings/${key}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        });
        if (!res.ok) throw new Error(`Settings update failed: ${res.status}`);
      }
      setSettings({ appName: tempName, appSubtitle: tempSubtitle });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <p data-testid="admin-app-info-loading" className="text-sm text-purple-200">
        Loading settings…
      </p>
    );

  return (
    <div
      data-testid="admin-app-info-ready"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500 p-2.5 rounded-xl text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">App Info</h3>
            <p className="text-sm text-purple-400 font-medium">Family app settings</p>
          </div>
        </div>
        <button
          data-testid="admin-app-info-edit-btn"
          onClick={editing ? () => setEditing(false) : startEdit}
          className={[
            'text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border min-h-[44px]',
            editing
              ? 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          ].join(' ')}
        >
          {editing ? (
            <>
              <X className="w-3 h-3" /> Cancel
            </>
          ) : (
            <>
              <Pencil className="w-3 h-3" /> Edit
            </>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Card className="p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">App Name</p>
          <p
            data-testid="admin-app-info-name-display"
            className="text-2xl font-black text-gray-900"
          >
            {settings.appName || <span className="text-gray-400 italic">Not set</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Subtitle</p>
          <p
            data-testid="admin-app-info-subtitle-display"
            className="text-base font-medium text-gray-700"
          >
            {settings.appSubtitle || <span className="text-gray-400 italic">Not set</span>}
          </p>
        </div>
      </Card>

      {editing && (
        <Card className="p-5 animate-in zoom-in-95 duration-200">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="app-info-name-input"
                className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
              >
                App Name
              </label>
              <input
                id="app-info-name-input"
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                data-testid="admin-app-info-name-input"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="app-info-subtitle-input"
                className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 block"
              >
                Subtitle
              </label>
              <input
                id="app-info-subtitle-input"
                type="text"
                value={tempSubtitle}
                onChange={(e) => setTempSubtitle(e.target.value)}
                data-testid="admin-app-info-subtitle-input"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-gray-900 focus:border-orange-400 outline-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={saving}
                onClick={() => void handleSave()}
                testId="admin-app-info-save-btn"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button variant="secondary" size="md" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminPanelPage() {
  const slug = useTenantSlug();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('balance');
  const [children, setChildren] = useState<MemberItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<CurrentWeek | null>(null);
  // null = still loading; string = loaded (may be 'admin', 'adult', 'child', 'teen', etc.)
  const [callerRole, setCallerRole] = useState<string | null>(null);

  // Key the headers memo on the access_token string — refocus-safe.
  const token = session?.access_token ?? '';
  const headers = useMemo<Record<string, string> | null>(
    () => (token ? { Authorization: `Bearer ${token}`, 'x-tenant-slug': slug } : null),
    [token, slug],
  );

  // Fetch family members — filter to kids only for the child selector.
  // Also captures callerRole for the route guard below.
  useEffect(() => {
    if (!headers) return;
    fetch(`${API_BASE}/api/members`, { headers })
      .then((r) => {
        if (!r.ok) {
          setCallerRole('__denied__');
          return { members: [], callerRole: '__denied__' } as {
            members: MemberItem[];
            callerRole: string;
          };
        }
        return r.json() as Promise<{ members: MemberItem[]; callerRole: string }>;
      })
      .then((b) => {
        setCallerRole(b.callerRole ?? '__denied__');
        const kids = (b.members ?? []).filter((m) => m.role === 'child' || m.role === 'teen');
        setChildren(kids);
        if (kids.length > 0 && !selectedChildId) {
          setSelectedChildId(kids[0]!.id);
        }
      })
      .catch(() => setCallerRole('__denied__'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  // Redirect non-admin/non-adult callers after the role is known.
  useEffect(() => {
    if (callerRole === null) return;
    if (callerRole !== 'admin' && callerRole !== 'adult') {
      navigate(`/t/${slug}/dashboard`, { replace: true });
    }
  }, [callerRole, slug, navigate]);

  // Fetch current week for the selected child (needed for Invest quick action).
  useEffect(() => {
    if (!headers || !selectedChildId) return;
    fetch(`${API_BASE}/api/mw/weeks/current?memberId=${selectedChildId}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { week: CurrentWeek } | null) => setCurrentWeek(b?.week ?? null))
      .catch(() => {});
  }, [headers, selectedChildId]);

  const handleChildSelect = (id: string) => {
    setSelectedChildId(id);
    setCurrentWeek(null);
  };

  const TABS: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'balance', icon: <Star className="w-4 h-4" />, label: 'Balance' },
    { key: 'savings', icon: <Pencil className="w-4 h-4" />, label: 'Savings' },
    { key: 'history', icon: <Calendar className="w-4 h-4" />, label: 'History' },
    { key: 'users', icon: <Users className="w-4 h-4" />, label: 'Users' },
    { key: 'app-info', icon: <Sparkles className="w-4 h-4" />, label: 'App Info' },
  ];

  const childScopedTab =
    activeTab === 'balance' || activeTab === 'savings' || activeTab === 'history';

  // Still waiting for role from the API — show a minimal loading state.
  if (callerRole === null) {
    return (
      <div
        data-testid="admin-panel-loading"
        className="flex min-h-screen items-center justify-center bg-kingdom-bg"
      >
        <p className="text-sm text-purple-200 font-medium">Loading…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="admin-panel"
      className="flex min-h-screen flex-col bg-kingdom-bg p-4 sm:p-6 font-body text-gray-900"
    >
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => navigate(`/t/${slug}/members`)}
            className="font-bold text-purple-200 hover:text-yellow-300 transition-colors"
          >
            ← Back to Manage Members
          </button>
        </div>

        {/* Header — orange→pink gradient */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/20 p-2 sm:p-3 rounded-xl backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">Admin Panel</h1>
              <p className="text-white/80 font-medium text-sm">
                Manage settings, balances, and members
              </p>
            </div>
          </div>
        </div>

        {/* Child selector — visible on Balance / Savings / History tabs */}
        {childScopedTab && (
          <ChildSelector
            kids={children}
            selectedId={selectedChildId}
            onSelect={handleChildSelect}
          />
        )}

        {/* Tab bar — scrollable on mobile */}
        <div className="bg-gray-100 p-1.5 rounded-2xl flex gap-1 shadow-inner overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-label={t.label}
              data-testid={`admin-panel-tab-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px]',
                activeTab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50',
              ].join(' ')}
            >
              {t.icon}
              <span className="hidden xs:inline sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[400px]">
          {childScopedTab && !selectedChildId && children.length === 0 && (
            <p className="text-sm text-purple-200">
              No children in this family. Add one from{' '}
              <Link to={`/t/${slug}/members`} className="underline font-bold text-yellow-300">
                Manage Members
              </Link>
              .
            </p>
          )}

          {activeTab === 'balance' && selectedChildId && (
            <BalanceTab
              memberId={selectedChildId}
              currentWeekId={currentWeek?.id ?? null}
              headers={headers}
            />
          )}

          {activeTab === 'savings' && selectedChildId && (
            <SavingsTab memberId={selectedChildId} headers={headers} />
          )}

          {activeTab === 'history' && selectedChildId && (
            <HistoryTab memberId={selectedChildId} headers={headers} />
          )}

          {activeTab === 'users' && <UsersTab headers={headers} slug={slug} />}

          {activeTab === 'app-info' && <AppInfoTab headers={headers} />}
        </div>
      </div>
    </div>
  );
}
