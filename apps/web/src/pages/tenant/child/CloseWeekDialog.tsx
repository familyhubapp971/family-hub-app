/**
 * CloseWeekDialog — port of legacy CloseWeekDialog to the new multi-tenant per-child API.
 * FHS-297
 *
 * Divergences from legacy:
 * - IDs are UUID strings (not numbers).
 * - Currency is passed in (not hardcoded "AED").
 * - ClaimDialog uses real family rewards from GET /api/rewards (not hardcoded categories).
 * - No api.weeks.recordAction call — mw endpoints write week_actions server-side.
 * - Uses fetch + headers instead of a generated API client.
 */
import { useEffect, useState } from 'react';
import { useBodyScrollLock } from '@familyhub/ui';
import {
  X,
  ShieldCheck,
  Star,
  Gift,
  TrendingUp,
  PiggyBank,
  Banknote,
  Info,
  Check,
  Loader2,
} from 'lucide-react';
import { API_BASE } from '../../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type SubDialog = null | 'claim' | 'cashout' | 'save' | 'invest' | 'withdraw';

interface ActionRecord {
  type: 'claim' | 'cashout' | 'save' | 'invest' | 'withdraw';
  rewardName?: string;
  stickersUsed?: number;
  cashAmount?: number;
  habitName?: string;
}

interface FinalizeSummary {
  stickersAutoSaved: number;
  investmentReturns: number;
  continuedInvestments: number;
  nextWeekId: string;
  nextWeekNumber: number;
  nextWeekYear: number;
}

interface Reward {
  id: string;
  name: string;
  stickerCost: number;
  icon?: string | null;
  description?: string | null;
}

interface ApiHabit {
  id: string;
  name: string;
  icon?: string | null;
  color?: string;
  isBonus?: boolean;
}

interface Investment {
  id: string;
  habitId: string;
  habitName: string | null;
  habitIcon: string | null;
  investedStickers: number;
  originalInvestedStickers: number;
  currentValue: number;
  currentValueStickers: number;
  daysCompleted: number;
  daysMissed: number;
}

type Headers = Record<string, string>;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CloseWeekDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  weeklyStickers?: number;
  weekId: string;
  memberId: string;
  currency: string;
  headers: Headers | null;
  initialSubDialog?: SubDialog;
  onWeekFinalized?: (nextWeekId: string) => void;
}

// ─── Sub-dialog: Claim Weekly Reward ─────────────────────────────────────────
function ClaimDialog({
  savingsStickers,
  savedCash,
  weeklyStickers,
  memberId,
  headers,
  onBack,
  onDone,
}: {
  savingsStickers: number;
  savedCash: number;
  weeklyStickers: number;
  memberId: string;
  headers: Headers | null;
  onBack: () => void;
  onDone: (action: ActionRecord) => void;
}) {
  const combinedSavings = savingsStickers + Math.floor(savedCash / 0.5);
  const totalStickers = combinedSavings + weeklyStickers;
  const [selected, setSelected] = useState<Reward | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!headers) return;
    setLoadingRewards(true);
    fetch(`${API_BASE}/api/rewards?memberId=${memberId}`, { headers })
      .then((r) => (r.ok ? (r.json() as Promise<{ rewards: Reward[] }>) : { rewards: [] }))
      .then((b) => setRewards(b.rewards ?? []))
      .catch(() => setRewards([]))
      .finally(() => setLoadingRewards(false));
  }, [memberId, headers]);

  const handleClaim = async () => {
    if (!selected || !headers) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/rewards/${selected.id}/redeem`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error(`redeem failed: ${res.status}`);
      onDone({ type: 'claim', rewardName: selected.name, stickersUsed: selected.stickerCost });
    } catch {
      setSubmitting(false);
    }
  };

  const affordable = rewards.filter((r) => r.stickerCost <= totalStickers);

  return (
    <div className="relative w-full max-w-lg" data-testid="close-week-claim-dialog">
      <div className="absolute inset-0 bg-black rounded-3xl translate-x-1.5 translate-y-1.5"></div>
      <div className="relative bg-white border-2 sm:border-3 border-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-6 pb-4 border-b-2 sm:border-b-3 border-black bg-pink-50 relative">
          <button
            onClick={onBack}
            data-testid="close-week-claim-close-btn"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-full hover:bg-pink-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-pink-400 p-2 rounded-xl border-2 border-black shadow-neo-xs">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-wide">Claim Reward</h2>
          </div>
          <div className="inline-flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-xs font-bold border-2 border-transparent">
            <Star className="w-3 h-3 text-yellow-400 fill-current" />
            {totalStickers} stickers available
            {combinedSavings > 0 && weeklyStickers > 0 && (
              <span className="text-purple-300 ml-1">
                ({combinedSavings} saved + {weeklyStickers} weekly)
              </span>
            )}
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-white">
          {loadingRewards ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
            </div>
          ) : totalStickers === 0 || affordable.length === 0 ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">
                  {totalStickers === 0 ? 'No stickers available' : 'No affordable rewards'}
                </p>
                <p className="text-xs text-amber-700">
                  {totalStickers === 0
                    ? 'You need stickers to claim a reward. Earn stickers by completing your habits!'
                    : 'Save up more stickers to unlock the available rewards.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-black text-xs font-black uppercase tracking-wider mb-3 bg-pink-100 text-pink-700 border-pink-300">
                <span>🎁</span> Family Rewards
              </div>
              {affordable.map((reward) => (
                <button
                  key={reward.id}
                  onClick={() => setSelected(reward)}
                  data-testid={`close-week-claim-item-${reward.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all relative ${
                    selected?.id === reward.id
                      ? 'bg-pink-100 border-black shadow-neo -translate-y-1'
                      : 'bg-white border-gray-200 hover:border-black hover:shadow-neo-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{reward.icon ?? '🎁'}</span>
                    <span className="font-black text-gray-900 text-sm uppercase">
                      {reward.name}
                    </span>
                  </div>
                  <span className="text-xs font-black bg-yellow-400 border-2 border-black text-black px-2 py-1 rounded-lg shadow-neo-xs">
                    {reward.stickerCost}⭐
                  </span>
                  {selected?.id === reward.id && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 border-2 border-black">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t-2 sm:border-t-3 border-black bg-gray-50">
          <button
            onClick={handleClaim}
            disabled={!selected || submitting || totalStickers === 0}
            data-testid="close-week-claim-submit-btn"
            className="w-full bg-pink-500 text-white border-2 border-black font-black py-4 rounded-xl shadow-neo motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-neo-xs active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-lg"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : totalStickers === 0 ? (
              'No stickers available'
            ) : selected ? (
              `Claim: ${selected.name} ✨`
            ) : (
              'Select a reward'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-dialog: Cash Out ─────────────────────────────────────────────────────
function CashOutDialog({
  savedStickers,
  savedCash,
  memberId,
  currency,
  headers,
  onBack,
  onDone,
}: {
  savedStickers: number;
  savedCash: number;
  memberId: string;
  currency: string;
  headers: Headers | null;
  onBack: () => void;
  onDone: (action: ActionRecord) => void;
}) {
  const totalStickers = savedStickers + Math.floor(savedCash / 0.5);
  const totalCash = savedCash + savedStickers * 0.5;

  const [mode, setMode] = useState<'stickers' | 'cash'>('stickers');
  const [amount, setAmount] = useState(totalStickers);
  const [submitting, setSubmitting] = useState(false);

  const cashAmount = mode === 'stickers' ? amount * 0.5 : amount;
  const stickersUsed = mode === 'stickers' ? amount : Math.round(amount / 0.5);
  const cashValue = cashAmount.toFixed(2);
  const remaining = totalStickers - stickersUsed;

  const handleModeSwitch = (newMode: 'stickers' | 'cash') => {
    if (newMode === mode) return;
    if (newMode === 'cash') {
      setAmount(Math.min(amount * 0.5, totalCash));
    } else {
      setAmount(Math.min(Math.round(amount / 0.5), totalStickers));
    }
    setMode(newMode);
  };

  const handleAmountChange = (val: number) => {
    if (mode === 'stickers') {
      setAmount(Math.min(totalStickers, Math.max(0, val)));
    } else {
      setAmount(Math.min(totalCash, Math.max(0, val)));
    }
  };

  const handleCashOut = async () => {
    if (cashAmount <= 0 || !headers) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings/cashout`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, amount: cashAmount }),
      });
      if (!res.ok) throw new Error(`cashout failed: ${res.status}`);
      onDone({ type: 'cashout', stickersUsed, cashAmount });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-lg" data-testid="close-week-cashout-dialog">
      <div className="absolute inset-0 bg-black rounded-3xl translate-x-1.5 translate-y-1.5"></div>
      <div className="relative bg-yellow-50 border-2 sm:border-3 border-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-6 pb-4 text-center relative border-b-2 sm:border-b-3 border-black bg-yellow-400">
          <button
            onClick={onBack}
            data-testid="close-week-cashout-close-btn"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-full hover:bg-yellow-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 bg-white border-2 border-black rounded-xl flex items-center justify-center mx-auto mb-2 shadow-neo-sm">
            <span className="text-2xl">💰</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wide">Cash Out</h2>
        </div>

        <div className="p-6 space-y-6">
          {totalStickers === 0 ? (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">No savings available</p>
                <p className="text-xs text-amber-700">
                  Cash out only works from savings. Save your weekly stickers first, then come back
                  to cash out!
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-6 shadow-neo">
                {/* Toggle */}
                <div className="flex justify-center gap-2 mb-6 bg-gray-100 p-1 rounded-xl border-2 border-black">
                  <button
                    onClick={() => handleModeSwitch('stickers')}
                    data-testid="close-week-cashout-mode-stickers"
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                      mode === 'stickers'
                        ? 'bg-yellow-400 text-black border-2 border-black shadow-neo-xs'
                        : 'text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Stickers
                  </button>
                  <button
                    onClick={() => handleModeSwitch('cash')}
                    data-testid="close-week-cashout-mode-aed"
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
                      mode === 'cash'
                        ? 'bg-yellow-400 text-black border-2 border-black shadow-neo-xs'
                        : 'text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {currency}
                  </button>
                </div>

                <p className="text-center text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                  Amount to Cash Out (from savings)
                </p>
                <div className="relative mb-4">
                  <input
                    type="number"
                    min={0}
                    max={mode === 'stickers' ? totalStickers : totalCash}
                    step={mode === 'cash' ? 0.5 : 1}
                    value={amount}
                    onChange={(e) => handleAmountChange(Number(e.target.value))}
                    data-testid="close-week-cashout-amount-input"
                    className="w-full text-center text-3xl sm:text-5xl font-black border-b-2 sm:border-b-3 border-black py-4 outline-none focus:border-yellow-500 bg-transparent"
                  />
                  <span className="absolute right-0 bottom-4 text-sm font-black text-gray-400">
                    {mode === 'stickers' ? '⭐' : currency}
                  </span>
                </div>

                <div className="bg-green-100 border-2 border-black rounded-xl py-3 text-center">
                  <span className="text-green-800 text-xs font-bold uppercase mr-2">
                    You Receive:
                  </span>
                  <span className="text-2xl font-black text-green-600">
                    {cashValue} {currency}
                  </span>
                </div>
              </div>

              <p className="text-center text-xs font-bold text-gray-500 bg-white border-2 border-black rounded-lg py-2 px-4 inline-block mx-auto">
                Remaining in savings: {remaining} stickers
              </p>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onBack}
              data-testid="close-week-cashout-cancel-btn"
              className="bg-white border-2 border-black text-black font-black py-3 rounded-xl hover:bg-gray-100 transition-all uppercase text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCashOut}
              disabled={cashAmount <= 0 || submitting || totalStickers === 0}
              data-testid="close-week-cashout-confirm-btn"
              className="bg-green-500 border-2 border-black text-white font-black py-3 rounded-xl shadow-neo motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-neo-xs active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase text-sm"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : totalStickers === 0 ? (
                'Save stickers first'
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-dialog: Save for Later ───────────────────────────────────────────────
function SaveDialog({
  stickers,
  memberId,
  currency,
  headers,
  onBack,
  onDone,
}: {
  stickers: number;
  memberId: string;
  currency: string;
  headers: Headers | null;
  onBack: () => void;
  onDone: (action: ActionRecord) => void;
}) {
  const [saveType, setSaveType] = useState<'stickers' | 'cash'>('stickers');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const num = Number(amount);
    if (!num || num <= 0 || !headers) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/savings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          type: saveType,
          amount: saveType === 'cash' ? num * 0.5 : num,
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      if (saveType === 'stickers') {
        onDone({ type: 'save', stickersUsed: num });
      } else {
        onDone({ type: 'save', cashAmount: num * 0.5 });
      }
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-xl" data-testid="close-week-save-dialog">
      <div className="absolute inset-0 bg-black rounded-3xl translate-x-1.5 translate-y-1.5"></div>
      <div className="relative bg-white border-2 sm:border-3 border-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-6 pb-4 border-b-2 sm:border-b-3 border-black bg-blue-50 relative">
          <button
            onClick={onBack}
            data-testid="close-week-save-close-btn"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-full hover:bg-blue-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-blue-400 p-2 rounded-xl border-2 border-black shadow-neo-xs">
              <PiggyBank className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wide">Save for Later</h2>
              <p className="text-blue-600/80 text-xs font-bold">Stack up for bigger rewards!</p>
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
          <div>
            <p className="font-black text-gray-900 uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">
                1
              </span>
              What to save?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSaveType('stickers')}
                data-testid="close-week-save-type-stickers"
                className={`p-4 rounded-2xl border-2 sm:border-3 text-left transition-all relative overflow-hidden ${
                  saveType === 'stickers'
                    ? 'border-black bg-yellow-50 shadow-neo -translate-y-1'
                    : 'border-gray-200 hover:border-black hover:bg-gray-50'
                }`}
              >
                <div className="bg-yellow-400 w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center mb-3 shadow-neo-xs">
                  <Star className="w-5 h-5 text-black fill-current" />
                </div>
                <p className="font-black text-gray-900 text-sm uppercase">Stickers</p>
                <p className="text-xs text-gray-500 font-bold mt-1">For rewards</p>
                {saveType === 'stickers' && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-0.5 border-2 border-black">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
              <button
                onClick={() => setSaveType('cash')}
                data-testid="close-week-save-type-cash"
                className={`p-4 rounded-2xl border-2 sm:border-3 text-left transition-all relative overflow-hidden ${
                  saveType === 'cash'
                    ? 'border-black bg-emerald-50 shadow-neo -translate-y-1'
                    : 'border-gray-200 hover:border-black hover:bg-gray-50'
                }`}
              >
                <div className="bg-emerald-400 w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center mb-3 shadow-neo-xs">
                  <Banknote className="w-5 h-5 text-white" />
                </div>
                <p className="font-black text-gray-900 text-sm uppercase">Cash ({currency})</p>
                <p className="text-xs text-gray-500 font-bold mt-1">For money</p>
                {saveType === 'cash' && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-0.5 border-2 border-black">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            </div>
          </div>

          <div>
            <p className="font-black text-gray-900 uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">
                2
              </span>
              How much?
            </p>
            <div className="relative">
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="close-week-save-amount-input"
                className="w-full border-2 sm:border-3 border-black rounded-xl px-4 py-4 text-xl font-black outline-none focus:bg-blue-50"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black bg-gray-200 px-2 py-1 rounded border-2 border-black">
                MAX: {stickers}
              </div>
            </div>
          </div>

          <div className="bg-purple-100 border-2 sm:border-3 border-black rounded-2xl p-5 relative">
            <div className="absolute -top-3 left-4 bg-purple-500 text-white text-xs font-black px-3 py-1 rounded-full border-2 border-black uppercase">
              Savings Goals
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              {[
                { icon: '🎁', label: 'Small', cost: '50 ⭐' },
                { icon: '🎮', label: 'Medium', cost: '100 ⭐' },
                { icon: '🚲', label: 'Big', cost: '200 ⭐' },
              ].map((goal) => (
                <div
                  key={goal.label}
                  className="bg-white rounded-xl p-2 border-2 border-black shadow-neo-xs"
                >
                  <div className="text-xl mb-1">{goal.icon}</div>
                  <p className="text-[10px] font-black uppercase text-gray-500">{goal.label}</p>
                  <p className="text-xs font-black text-purple-600">{goal.cost}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 sm:border-t-3 border-black bg-gray-50 grid grid-cols-2 gap-3">
          <button
            onClick={onBack}
            data-testid="close-week-save-cancel-btn"
            className="bg-white border-2 border-black text-black font-black py-3 rounded-xl hover:bg-gray-100 transition-all uppercase text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!amount || Number(amount) <= 0 || submitting}
            data-testid="close-week-save-submit-btn"
            className="bg-blue-500 border-2 border-black text-white font-black py-3 rounded-xl shadow-neo motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-neo-xs active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase text-sm"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save It!'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-dialog: Invest & Grow ────────────────────────────────────────────────
function InvestDialog({
  stickers,
  weekId,
  memberId,
  currency,
  headers,
  onBack,
  onDone,
}: {
  stickers: number;
  weekId: string;
  memberId: string;
  currency: string;
  headers: Headers | null;
  onBack: () => void;
  onDone: (action: ActionRecord) => void;
}) {
  const [amount, setAmount] = useState('');
  const [selectedHabit, setSelectedHabit] = useState<ApiHabit | null>(null);
  const [habits, setHabits] = useState<ApiHabit[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // FHS-378 — Deductible (default): missed days subtract value. Non-deductible:
  // missed days never reduce the value.
  const [deductible, setDeductible] = useState(true);
  const [error, setError] = useState('');
  const num = Number(amount) || 0;
  const isOverMax = num > stickers;
  const isBelowMin = num > 0 && num < 10;
  const notEnoughToInvest = stickers < 10;
  const cashVal = amount ? (num * 0.5).toFixed(2) : '0.00';

  const investmentByHabitId = new Map(activeInvestments.map((inv) => [inv.habitId, inv]));
  const selectedInvestment = selectedHabit ? investmentByHabitId.get(selectedHabit.id) : undefined;
  const selectedIsInvested = Boolean(selectedInvestment);

  const refreshInvestments = () => {
    if (!headers) return;
    fetch(`${API_BASE}/api/mw/financial/investments?memberId=${memberId}`, { headers })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ investments: Investment[] }>) : { investments: [] },
      )
      .then((b) => setActiveInvestments(b.investments ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!headers) return;
    fetch(`${API_BASE}/api/habits?memberId=${memberId}&weekId=${weekId}`, { headers })
      .then((r) => (r.ok ? (r.json() as Promise<{ habits: ApiHabit[] }>) : { habits: [] }))
      .then((b) => setHabits(b.habits ?? []))
      .catch(() => {});
    refreshInvestments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvest = async () => {
    const stickerCount = Number(amount);
    if (!stickerCount || stickerCount < 10 || !selectedHabit || !headers) return;
    if (stickerCount > stickers) {
      setError(`You only have ${stickers} stickers available`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/mw/financial/investments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, habitId: selectedHabit.id, stickerCount, deductible }),
      });
      if (!res.ok) throw new Error(`invest failed: ${res.status}`);
      onDone({
        type: 'invest',
        habitName: selectedHabit.name,
        stickersUsed: stickerCount,
        cashAmount: stickerCount * 0.5,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create investment');
      setSubmitting(false);
    }
  };

  const handleRemoveInvestment = async () => {
    if (!selectedInvestment || !selectedHabit || !headers) return;
    const habitName = selectedHabit.name;
    setError('');
    setWithdrawingId(selectedInvestment.id);
    try {
      const res = await fetch(
        `${API_BASE}/api/mw/financial/investments/${selectedInvestment.id}/withdraw`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId }),
        },
      );
      if (!res.ok) throw new Error(`withdraw failed: ${res.status}`);
      const result = (await res.json()) as {
        finalReturn?: number;
        finalReturnStickers?: number;
      };
      onDone({
        type: 'withdraw',
        habitName,
        stickersUsed: result.finalReturnStickers ?? 0,
        cashAmount: result.finalReturn ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove investment');
      setWithdrawingId(null);
      setConfirmRemove(false);
    }
  };

  useEffect(() => {
    setConfirmRemove(false);
  }, [selectedHabit?.id]);

  return (
    <div className="relative w-full max-w-xl" data-testid="close-week-invest-dialog">
      <div className="absolute inset-0 bg-black rounded-3xl translate-x-1.5 translate-y-1.5"></div>
      <div className="relative bg-purple-900 border-2 sm:border-3 border-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-6 pb-4 border-b-2 sm:border-b-3 border-black bg-purple-900 relative">
          <button
            onClick={onBack}
            data-testid="close-week-invest-close-btn"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-purple-800 border-2 border-black rounded-full text-white hover:bg-purple-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-xl border-2 border-black shadow-neo-xs">
              <TrendingUp className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                Invest &amp; Grow
              </h2>
              <p className="text-purple-200 text-xs font-bold mt-0.5">
                Risk it to get the biscuit! 🍪
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6 bg-purple-50">
          {/* How it works */}
          <div className="bg-white border-2 sm:border-3 border-black rounded-2xl p-4 space-y-3 shadow-neo">
            <p className="font-black text-black text-sm flex items-center gap-2 uppercase tracking-wide border-b-2 border-gray-100 pb-2">
              <Info className="w-4 h-4" /> How It Works
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 bg-green-50 p-2 rounded-lg border border-green-200">
                <span className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded border border-black uppercase">
                  +5/day
                </span>
                <p className="text-xs font-bold text-green-800">
                  Each completed day adds 5 stickers to your investment
                </p>
              </div>
              <div className="flex items-center gap-3 bg-red-50 p-2 rounded-lg border border-red-200">
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded border border-black uppercase">
                  -2
                </span>
                <p className="text-xs font-bold text-red-800">
                  Miss a day = lose 2 stickers from your total
                </p>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 p-2 rounded-lg border border-blue-200">
                <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded border border-black uppercase">
                  Auto
                </span>
                <p className="text-xs font-bold text-blue-800">
                  Returns go to savings automatically
                </p>
              </div>
            </div>
          </div>

          {/* Already-invested info banner OR confirmation panel */}
          {selectedIsInvested && selectedInvestment && !confirmRemove && (
            <div
              className="bg-amber-100 border-2 border-amber-500 rounded-xl p-3 flex items-start gap-2"
              data-testid="close-week-invest-already-invested"
            >
              <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-amber-900">
                <p className="mb-1">
                  You already have an investment in{' '}
                  <span className="font-black">{selectedHabit?.name}</span>.
                </p>
                <p className="font-normal text-amber-800">
                  {selectedInvestment.investedStickers} stickers invested ·{' '}
                  {selectedInvestment.daysCompleted}/7 days done
                  {selectedInvestment.daysMissed > 0 &&
                    ` · ${selectedInvestment.daysMissed} missed`}
                  . Tap &ldquo;Remove Investment&rdquo; below to free those stickers and invest
                  again.
                </p>
              </div>
            </div>
          )}
          {selectedIsInvested && selectedInvestment && confirmRemove && (
            <div
              className="bg-red-50 border-2 border-red-500 rounded-xl p-4 space-y-3"
              data-testid="close-week-invest-confirm-remove"
            >
              <div className="flex items-start gap-2">
                <div className="bg-red-500 text-white rounded-full p-1 flex-shrink-0">
                  <X className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-black text-red-900 text-sm uppercase tracking-wide">
                    Remove this investment?
                  </p>
                  <p className="text-xs font-bold text-red-800 mt-1">
                    Your{' '}
                    <span className="font-black">
                      {selectedInvestment.investedStickers} stickers
                    </span>{' '}
                    staked on <span className="font-black">{selectedHabit?.name}</span> will return
                    to your weekly pool.
                  </p>
                  <p className="text-xs font-bold text-red-700 mt-2 bg-red-100 border border-red-300 rounded p-2">
                    ⚠ Any gains so far are forfeited. This cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <p className="font-black text-gray-900 uppercase tracking-wider text-sm mb-2">
              Investment Amount (stickers)
            </p>
            <div className="relative">
              <input
                type="number"
                placeholder="10"
                min={10}
                max={stickers}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                disabled={notEnoughToInvest || selectedIsInvested}
                data-testid="close-week-invest-amount-input"
                className={`w-full border-2 sm:border-3 rounded-xl px-4 py-3 sm:py-4 text-xl sm:text-2xl font-black outline-none transition-colors ${
                  notEnoughToInvest || selectedIsInvested
                    ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isOverMax || isBelowMin
                      ? 'border-red-500 bg-red-50 focus:border-red-500'
                      : 'border-black focus:bg-yellow-50 focus:border-yellow-400'
                }`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black bg-lime-400 px-2 py-1 rounded border-2 border-black text-black">
                MAX: {stickers}
              </div>
            </div>
            {notEnoughToInvest ? (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 mt-2 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-800">
                  You need at least 10 stickers to invest. You currently have {stickers}. Earn more
                  stickers or save up first!
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 font-bold mt-1">
                  = {currency} {cashVal} invested, worth {currency}{' '}
                  {(num * 0.5 + num * 5 * 0.5).toFixed(2)} at +5/day (7 days)
                </p>
                {isBelowMin && (
                  <p className="text-xs text-red-500 font-bold mt-1">
                    Minimum investment is 10 stickers
                  </p>
                )}
                {isOverMax && (
                  <p className="text-xs text-red-500 font-bold mt-1">
                    Exceeds available stickers (max {stickers})
                  </p>
                )}
              </>
            )}
            {error && (
              <p
                className="text-xs text-red-500 font-bold mt-1"
                data-testid="close-week-invest-error"
              >
                {error}
              </p>
            )}
          </div>

          {/* FHS-378 — Missed-days mode for the new investment. */}
          {!notEnoughToInvest && !selectedIsInvested && (
            <div className="mb-2" data-testid="close-week-invest-deductible">
              <p
                id="invest-deductible-label"
                className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900"
              >
                <span className="text-xl">📉</span> Missed days
              </p>
              <div
                role="group"
                aria-labelledby="invest-deductible-label"
                className="grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  aria-pressed={deductible}
                  data-testid="invest-deductible-on"
                  onClick={() => setDeductible(true)}
                  className={`rounded-lg border-2 border-black px-3 py-2 text-left text-sm font-bold ${
                    deductible ? 'bg-red-300 text-black shadow-neo-xs' : 'bg-white text-gray-500'
                  }`}
                >
                  Deductible
                  <span className="block text-[10px] font-bold opacity-80">miss = −penalty</span>
                </button>
                <button
                  type="button"
                  aria-pressed={!deductible}
                  data-testid="invest-deductible-off"
                  onClick={() => setDeductible(false)}
                  className={`rounded-lg border-2 border-black px-3 py-2 text-left text-sm font-bold ${
                    !deductible ? 'bg-green-300 text-black shadow-neo-xs' : 'bg-white text-gray-500'
                  }`}
                >
                  No-penalty
                  <span className="block text-[10px] font-bold opacity-80">miss = no change</span>
                </button>
              </div>
            </div>
          )}

          {/* Habit selection */}
          <div>
            <p className="font-black text-gray-900 uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
              <span className="text-xl">🎯</span> Choose Habit
            </p>
            <div className="space-y-3">
              {habits.map((habit) => {
                const inv = investmentByHabitId.get(habit.id);
                const isInvested = Boolean(inv);
                const isSelected = selectedHabit?.id === habit.id;
                return (
                  <button
                    key={habit.id}
                    onClick={() => setSelectedHabit(habit)}
                    data-testid={`close-week-invest-habit-${habit.id}`}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all relative ${
                      isSelected
                        ? isInvested
                          ? 'bg-red-100 border-red-600 ring-2 ring-red-300 shadow-neo -translate-y-1 z-10'
                          : 'bg-yellow-400 border-black shadow-neo -translate-y-1 z-10'
                        : isInvested
                          ? 'bg-amber-50 border-amber-400 hover:border-amber-600 hover:shadow-neo-xs'
                          : 'bg-white border-gray-200 hover:border-black hover:shadow-neo-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-900">{habit.name}</p>
                      {isInvested && !isSelected && (
                        <span
                          data-testid={`close-week-invest-habit-${habit.id}-invested-badge`}
                          className="text-[10px] font-black text-white bg-amber-600 px-1.5 py-0.5 rounded-md border border-black uppercase"
                        >
                          Invested · 5x
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[10px] font-bold mt-1 uppercase tracking-wide ${
                        isSelected && isInvested ? 'text-red-700' : 'text-gray-500'
                      }`}
                    >
                      {isInvested && inv
                        ? `${inv.investedStickers} stickers invested · ${inv.daysCompleted}/7 done${isSelected ? ' — about to remove' : ' — tap to remove'}`
                        : 'Each completed day = +5 stickers · each missed day = −2'}
                    </p>
                    {isSelected && (
                      <div
                        className={`absolute -top-2 -right-2 ${isInvested ? 'bg-red-600' : 'bg-black'} text-white rounded-full p-1 border-2 border-white`}
                      >
                        {isInvested ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 sm:border-t-3 border-black bg-purple-900 grid grid-cols-2 gap-3">
          {selectedIsInvested && confirmRemove ? (
            <>
              <button
                onClick={() => setConfirmRemove(false)}
                disabled={withdrawingId !== null}
                data-testid="close-week-invest-confirm-cancel-btn"
                className="bg-purple-800 border-2 border-black text-white font-black py-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all uppercase text-sm"
              >
                Keep Investment
              </button>
              <button
                onClick={handleRemoveInvestment}
                disabled={withdrawingId !== null}
                data-testid="close-week-invest-confirm-remove-btn"
                className="bg-red-600 border-2 border-black text-white font-black py-3 rounded-xl shadow-neo motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-neo-xs active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase text-sm"
              >
                {withdrawingId !== null ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Yes, withdraw stickers'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onBack}
                data-testid="close-week-invest-cancel-btn"
                className="bg-purple-800 border-2 border-black text-white font-black py-3 rounded-xl hover:bg-purple-700 transition-all uppercase text-sm"
              >
                Cancel
              </button>
              {selectedIsInvested ? (
                <button
                  onClick={() => setConfirmRemove(true)}
                  data-testid="close-week-invest-remove-btn"
                  className="bg-red-500 border-2 border-black text-white font-black py-3 px-2 rounded-xl shadow-neo motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-neo-xs active:translate-y-1 active:shadow-none transition-all uppercase text-xs sm:text-sm leading-tight"
                  title={`Remove investment from ${selectedHabit?.name}`}
                >
                  <span className="block truncate">
                    Remove from &ldquo;{selectedHabit?.name}&rdquo;
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleInvest}
                  disabled={
                    !amount ||
                    num < 10 ||
                    num > stickers ||
                    !selectedHabit ||
                    submitting ||
                    notEnoughToInvest
                  }
                  data-testid="close-week-invest-submit-btn"
                  className="bg-yellow-400 border-2 border-black text-black font-black py-3 rounded-xl shadow-neo motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-neo-xs active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase text-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    `Invest ${currency} ${cashVal}`
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Withdraw Investment Dialog ───────────────────────────────────────────────
function WithdrawDialog({
  memberId,
  currency,
  headers,
  onBack,
  onDone,
}: {
  memberId: string;
  currency: string;
  headers: Headers | null;
  onBack: () => void;
  onDone: (action: ActionRecord) => void;
}) {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!headers) return;
    fetch(`${API_BASE}/api/mw/financial/investments?memberId=${memberId}`, { headers })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ investments: Investment[] }>) : { investments: [] },
      )
      .then((b) => {
        const active = b.investments ?? [];
        setInvestments(active);
        const defaults: Record<string, number> = {};
        for (const inv of active) {
          defaults[inv.id] = inv.currentValueStickers;
        }
        setWithdrawAmounts(defaults);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memberId, headers]);

  const handleWithdraw = async (id: string) => {
    if (!headers) return;
    const inv = investments.find((i) => i.id === id);
    if (!inv) return;
    const totalStickers = inv.currentValueStickers;
    const stickersToWithdraw = withdrawAmounts[id] ?? totalStickers;
    const isFullWithdrawal = stickersToWithdraw >= totalStickers;

    setWithdrawingId(id);
    try {
      const body: Record<string, unknown> = { memberId };
      if (!isFullWithdrawal) body.stickers = stickersToWithdraw;
      const res = await fetch(`${API_BASE}/api/mw/financial/investments/${id}/withdraw`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`withdraw failed: ${res.status}`);
      const result = (await res.json()) as {
        remainingStickers?: number;
        remainingValue?: number;
        finalReturn?: number;
      };

      if ((result.remainingStickers ?? 0) > 0) {
        setInvestments((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  currentValue: result.remainingValue ?? 0,
                  currentValueStickers: result.remainingStickers ?? 0,
                  investedStickers: result.remainingStickers ?? 0,
                }
              : i,
          ),
        );
        setWithdrawAmounts((prev) => ({
          ...prev,
          [id]: result.remainingStickers ?? 0,
        }));
        setWithdrawingId(null);
      } else {
        setInvestments((prev) => prev.filter((i) => i.id !== id));
        if (investments.length <= 1) {
          onDone({
            type: 'withdraw',
            ...(inv.habitName ? { habitName: inv.habitName } : {}),
            cashAmount: result.finalReturn ?? 0,
          });
        } else {
          setWithdrawingId(null);
        }
      }
    } catch {
      setWithdrawingId(null);
    }
  };

  return (
    <div className="relative w-full max-w-xl" data-testid="close-week-withdraw-dialog">
      <div className="absolute inset-0 bg-black rounded-3xl translate-x-1.5 translate-y-1.5"></div>
      <div className="relative bg-purple-900 border-2 sm:border-3 border-black rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-6 pb-4 border-b-2 sm:border-b-3 border-black bg-purple-900 relative">
          <button
            onClick={onBack}
            data-testid="close-week-withdraw-close-btn"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-purple-800 border-2 border-black rounded-full text-white hover:bg-purple-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-orange-400 p-2 rounded-xl border-2 border-black shadow-neo-xs">
              <Banknote className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                Withdraw Investment
              </h2>
              <p className="text-purple-200 text-xs font-bold mt-0.5">
                Choose how much to withdraw
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4 bg-purple-50">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : investments.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-bold text-gray-500 text-sm">No active investments to withdraw</p>
            </div>
          ) : (
            <div className="space-y-4">
              {investments.map((inv) => {
                const totalStickers = inv.currentValueStickers;
                const selectedStickers = withdrawAmounts[inv.id] ?? totalStickers;
                const selectedCash = (selectedStickers * 0.5).toFixed(2);
                const isFullWithdrawal = selectedStickers >= totalStickers;

                return (
                  <div
                    key={inv.id}
                    className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{inv.habitIcon ?? '📊'}</span>
                        <div>
                          <p className="font-black text-gray-900 text-sm truncate">
                            {inv.habitName ?? `Habit #${inv.habitId.slice(0, 8)}`}
                          </p>
                          <p className="text-xs font-bold text-gray-500 mt-0.5">
                            {totalStickers} stickers ({currency} {inv.currentValue.toFixed(2)})
                            available
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          {inv.daysCompleted}d done
                        </span>
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {inv.daysMissed}d missed
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`close-week-withdraw-slider-${inv.id}`}
                          className="text-xs font-black text-gray-700 uppercase tracking-wide"
                        >
                          Withdraw Amount
                        </label>
                        <button
                          onClick={() =>
                            setWithdrawAmounts((prev) => ({ ...prev, [inv.id]: totalStickers }))
                          }
                          data-testid={`close-week-withdraw-all-${inv.id}`}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-all uppercase ${
                            isFullWithdrawal
                              ? 'bg-orange-400 text-black border-orange-500'
                              : 'bg-gray-100 text-gray-500 border-gray-300 hover:border-orange-400'
                          }`}
                        >
                          Withdraw All
                        </button>
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={totalStickers}
                        value={selectedStickers}
                        onChange={(e) =>
                          setWithdrawAmounts((prev) => ({
                            ...prev,
                            [inv.id]: parseInt(e.target.value),
                          }))
                        }
                        data-testid={`close-week-withdraw-slider-${inv.id}`}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-400"
                      />

                      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-orange-600">
                            {selectedStickers}
                          </span>
                          <span className="text-xs font-bold text-orange-400">stickers</span>
                        </div>
                        <span className="text-sm font-black text-orange-600">
                          {currency} {selectedCash}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleWithdraw(inv.id)}
                      disabled={withdrawingId === inv.id}
                      data-testid={`close-week-withdraw-btn-${inv.id}`}
                      className="w-full bg-orange-400 border-2 border-black text-black font-black text-sm px-4 py-3 rounded-xl shadow-neo-xs hover:brightness-105 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase"
                    >
                      {withdrawingId === inv.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        `Withdraw ${selectedStickers} sticker${selectedStickers !== 1 ? 's' : ''} (${currency} ${selectedCash})`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t-2 sm:border-t-3 border-black bg-purple-900">
          <button
            onClick={onBack}
            data-testid="close-week-withdraw-back-btn"
            className="w-full bg-purple-800 border-2 border-black text-white font-black py-3 rounded-xl hover:bg-purple-700 transition-all uppercase text-sm"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CloseWeekDialog ─────────────────────────────────────────────────────
export function CloseWeekDialog({
  isOpen,
  onClose,
  isAdmin = false,
  weeklyStickers = 0,
  weekId,
  memberId,
  currency,
  headers,
  initialSubDialog,
  onWeekFinalized,
}: CloseWeekDialogProps) {
  // Lock body scroll while the dialog is open (FHS-412).
  useBodyScrollLock(isOpen);

  const [subDialog, setSubDialog] = useState<SubDialog>(initialSubDialog ?? null);
  const [done, setDone] = useState<SubDialog>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeSummary, setFinalizeSummary] = useState<FinalizeSummary | null>(null);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [availableStickers, setAvailableStickers] = useState(weeklyStickers);
  const [savingsBalance, setSavingsBalance] = useState({ savedStickers: 0, savedCash: 0 });
  const [initialized, setInitialized] = useState(false);

  const refreshBalances = async () => {
    if (!weekId || !headers) return;
    try {
      const [statsRes, savingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/mw/weeks/${weekId}/stats?memberId=${memberId}`, { headers }),
        fetch(`${API_BASE}/api/mw/financial/savings?memberId=${memberId}`, { headers }),
      ]);
      if (statsRes.ok) {
        const stats = (await statsRes.json()) as { unallocatedStickers?: number };
        setAvailableStickers(stats.unallocatedStickers ?? 0);
      }
      if (savingsRes.ok) {
        const savings = (await savingsRes.json()) as {
          savedStickers: number;
          savedCash: number;
        };
        setSavingsBalance({
          savedStickers: savings.savedStickers ?? 0,
          savedCash: savings.savedCash ?? 0,
        });
      }
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    if (isOpen && !initialized) {
      setSubDialog(initialSubDialog ?? null);
      setDone(null);
      setFinalizeSummary(null);
      setFinalizing(false);
      setFinalizeError(null);
      setActions([]);
      setAvailableStickers(weeklyStickers);
      setInitialized(true);

      if (headers) {
        // Load investments + savings balance on open
        fetch(`${API_BASE}/api/mw/financial/investments?memberId=${memberId}`, { headers })
          .then((r) =>
            r.ok ? (r.json() as Promise<{ investments: Investment[] }>) : { investments: [] },
          )
          .then((b) => setActiveInvestments(b.investments ?? []))
          .catch(() => {});

        fetch(`${API_BASE}/api/mw/financial/savings?memberId=${memberId}`, { headers })
          .then((r) =>
            r.ok
              ? (r.json() as Promise<{ savedStickers: number; savedCash: number }>)
              : { savedStickers: 0, savedCash: 0 },
          )
          .then((b) =>
            setSavingsBalance({
              savedStickers: b.savedStickers ?? 0,
              savedCash: b.savedCash ?? 0,
            }),
          )
          .catch(() => {});
      }
    }
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen, initialSubDialog, weeklyStickers, initialized, memberId, headers]);

  const handleFinalizeWeek = async () => {
    if (!weekId || finalizing || !headers) return;
    setFinalizing(true);
    setFinalizeError(null);
    try {
      const freshRes = await fetch(
        `${API_BASE}/api/mw/financial/investments?memberId=${memberId}`,
        { headers },
      );
      const freshInvestments: Investment[] = freshRes.ok
        ? (((await freshRes.json()) as { investments: Investment[] }).investments ?? [])
        : activeInvestments;

      const res = await fetch(`${API_BASE}/api/mw/weeks/${weekId}/finalize`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          continueInvestmentIds: freshInvestments.map((inv) => inv.id),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(err.detail ?? err.error ?? `finalize failed: ${res.status}`);
      }
      const result = (await res.json()) as {
        stickersAutoSaved?: number;
        investmentReturns?: number;
        continuedInvestments?: number;
        nextWeekId?: string;
        nextWeekNumber?: number;
        nextWeekYear?: number;
      };
      setFinalizeSummary({
        stickersAutoSaved: result.stickersAutoSaved ?? 0,
        investmentReturns: result.investmentReturns ?? 0,
        continuedInvestments: result.continuedInvestments ?? 0,
        nextWeekId: result.nextWeekId ?? '',
        nextWeekNumber: result.nextWeekNumber ?? 0,
        nextWeekYear: result.nextWeekYear ?? 0,
      });
      onWeekFinalized?.(result.nextWeekId ?? '');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to close week. Please try again.';
      setFinalizeError(message);
      setFinalizing(false);
    }
  };

  if (!isOpen) return null;

  const handleActionDone = async (action: ActionRecord) => {
    setActions((prev) => [...prev, action]);
    setDone(action.type);
    setSubDialog(null);
    await refreshBalances();
  };

  // ── Week finalized summary screen ─────────────────────────────────────────
  if (finalizeSummary) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        data-testid="close-week-finalized"
      >
        <div className="relative w-full max-w-lg">
          <div className="absolute inset-0 bg-green-500 rounded-3xl translate-x-1.5 translate-y-1.5"></div>
          <div className="relative bg-purple-900 border-2 sm:border-3 border-black rounded-3xl shadow-2xl p-5 sm:p-8 animate-in zoom-in-95 overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

            <div className="text-center mb-6">
              <div className="text-5xl sm:text-7xl mb-4 motion-safe:animate-bounce">🎊</div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 uppercase tracking-wide">
                Week Closed!
              </h2>
              <p className="text-purple-200 font-bold">Here&apos;s what happened this week</p>
            </div>

            <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto">
              {/* Actions taken this session */}
              {actions.map((action, idx) => (
                <div
                  key={idx}
                  className={`border-2 rounded-xl p-4 flex items-center gap-4 ${
                    action.type === 'claim'
                      ? 'bg-pink-500/20 border-pink-400'
                      : action.type === 'cashout'
                        ? 'bg-lime-500/20 border-lime-400'
                        : action.type === 'save'
                          ? 'bg-cyan-500/20 border-cyan-400'
                          : action.type === 'invest'
                            ? 'bg-yellow-500/20 border-yellow-400'
                            : 'bg-orange-500/20 border-orange-400'
                  }`}
                >
                  <div className="text-3xl">
                    {action.type === 'claim' && '🎁'}
                    {action.type === 'cashout' && '💰'}
                    {action.type === 'save' && '🐷'}
                    {action.type === 'invest' && '📈'}
                    {action.type === 'withdraw' && '🏦'}
                  </div>
                  <div>
                    <p
                      className={`text-xs font-bold uppercase tracking-wide ${
                        action.type === 'claim'
                          ? 'text-pink-300'
                          : action.type === 'cashout'
                            ? 'text-lime-300'
                            : action.type === 'save'
                              ? 'text-cyan-300'
                              : action.type === 'invest'
                                ? 'text-yellow-300'
                                : 'text-orange-300'
                      }`}
                    >
                      {action.type === 'claim' && 'Reward Claimed'}
                      {action.type === 'cashout' && 'Cashed Out'}
                      {action.type === 'save' && 'Saved'}
                      {action.type === 'invest' && 'Invested'}
                      {action.type === 'withdraw' && 'Withdrawn'}
                    </p>
                    <p className="text-white font-black text-lg">
                      {action.type === 'claim' && `${action.rewardName} (${action.stickersUsed}⭐)`}
                      {action.type === 'cashout' &&
                        `${action.cashAmount?.toFixed(2)} ${currency} (${action.stickersUsed}⭐)`}
                      {action.type === 'save' &&
                        (action.stickersUsed
                          ? `${action.stickersUsed} stickers`
                          : `${action.cashAmount?.toFixed(2)} ${currency}`)}
                      {action.type === 'invest' &&
                        `${action.cashAmount?.toFixed(2)} ${currency} → ${action.habitName}`}
                      {action.type === 'withdraw' &&
                        `${action.cashAmount?.toFixed(2)} ${currency} from ${action.habitName ?? 'investment'}`}
                    </p>
                  </div>
                </div>
              ))}

              {finalizeSummary.stickersAutoSaved > 0 && (
                <div className="bg-cyan-500/20 border-2 border-cyan-400 rounded-xl p-4 flex items-center gap-4">
                  <div className="text-3xl">🐷</div>
                  <div>
                    <p className="text-cyan-300 text-xs font-bold uppercase tracking-wide">
                      Auto-Saved
                    </p>
                    <p className="text-white font-black text-lg">
                      {finalizeSummary.stickersAutoSaved} stickers → savings
                    </p>
                  </div>
                </div>
              )}

              {finalizeSummary.investmentReturns > 0 && (
                <div className="bg-yellow-500/20 border-2 border-yellow-400 rounded-xl p-4 flex items-center gap-4">
                  <div className="text-3xl">📈</div>
                  <div>
                    <p className="text-yellow-300 text-xs font-bold uppercase tracking-wide">
                      Investment Returns
                    </p>
                    <p className="text-white font-black text-lg">
                      {finalizeSummary.investmentReturns.toFixed(2)} {currency} earned!
                    </p>
                  </div>
                </div>
              )}

              {finalizeSummary.continuedInvestments > 0 && (
                <div className="bg-green-500/20 border-2 border-green-400 rounded-xl p-4 flex items-center gap-4">
                  <div className="text-3xl">🔄</div>
                  <div>
                    <p className="text-green-300 text-xs font-bold uppercase tracking-wide">
                      Investments Continued
                    </p>
                    <p className="text-white font-black text-lg">
                      {finalizeSummary.continuedInvestments} investment
                      {finalizeSummary.continuedInvestments > 1 ? 's' : ''} rolled over
                    </p>
                  </div>
                </div>
              )}

              {actions.length === 0 &&
                finalizeSummary.stickersAutoSaved === 0 &&
                finalizeSummary.investmentReturns === 0 && (
                  <div className="bg-purple-500/20 border-2 border-purple-400 rounded-xl p-4 flex items-center gap-4">
                    <div className="text-3xl">✨</div>
                    <div>
                      <p className="text-purple-300 text-xs font-bold uppercase tracking-wide">
                        All Done
                      </p>
                      <p className="text-white font-black text-lg">
                        All stickers were already allocated
                      </p>
                    </div>
                  </div>
                )}

              <div className="bg-green-500/20 border-2 border-green-400 rounded-xl p-4 flex items-center gap-4">
                <div className="text-3xl">🚀</div>
                <div>
                  <p className="text-green-300 text-xs font-bold uppercase tracking-wide">
                    New Week
                  </p>
                  <p className="text-white font-black text-lg">
                    {finalizeSummary.nextWeekNumber > 0
                      ? `Week ${finalizeSummary.nextWeekNumber}, ${finalizeSummary.nextWeekYear} is ready!`
                      : 'Your next week is ready!'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setFinalizeSummary(null);
                onClose();
              }}
              data-testid="close-week-finalized-close-btn"
              className="w-full bg-yellow-400 text-black border-2 sm:border-3 border-black font-black text-xl px-8 py-4 rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all uppercase"
            >
              Start New Week! 🌟
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    const lastAction = actions[actions.length - 1];
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        data-testid="close-week-success"
      >
        <div className="relative w-full max-w-lg">
          <div className="absolute inset-0 bg-pink-500 rounded-3xl translate-x-1.5 translate-y-1.5"></div>
          <div className="relative bg-purple-900 border-2 sm:border-3 border-black rounded-3xl shadow-2xl p-5 sm:p-8 text-center animate-in zoom-in-95 overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

            <div className="text-5xl sm:text-7xl md:text-8xl mb-4 sm:mb-6 motion-safe:animate-bounce">
              🎉
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 uppercase tracking-wide">
              Done!
            </h2>
            <p className="text-purple-200 font-bold text-lg mb-8 leading-relaxed">
              {done === 'claim' &&
                `${lastAction?.rewardName ?? 'Reward'} claimed! Enjoy your treat! 🍬`}
              {done === 'cashout' &&
                `${currency} ${lastAction?.cashAmount?.toFixed(2) ?? '0.00'} cashed out! Ka-ching! 💸`}
              {done === 'save' && 'Stickers saved! Smart move! 🧠'}
              {done === 'invest' && 'Invested! Good luck next week! 🚀'}
              {done === 'withdraw' && 'Investment withdrawn! Cash returned to savings! 💰'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setDone(null)}
                data-testid="close-week-success-continue-btn"
                className="w-full bg-yellow-400 text-black border-2 sm:border-3 border-black font-black text-xl px-8 py-4 rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all uppercase"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  setDone(null);
                  void handleFinalizeWeek();
                }}
                disabled={finalizing}
                data-testid="close-week-success-finalize-btn"
                className="w-full bg-green-500 text-white border-2 sm:border-3 border-black font-black text-sm px-8 py-3 rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close Week Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Sub-dialogs ───────────────────────────────────────────────────────────
  if (subDialog) {
    const handleBack = initialSubDialog ? onClose : () => setSubDialog(null);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        {subDialog === 'claim' && (
          <ClaimDialog
            savingsStickers={savingsBalance.savedStickers}
            savedCash={savingsBalance.savedCash}
            weeklyStickers={availableStickers}
            memberId={memberId}
            headers={headers}
            onBack={handleBack}
            onDone={handleActionDone}
          />
        )}
        {subDialog === 'cashout' && (
          <CashOutDialog
            savedStickers={savingsBalance.savedStickers}
            savedCash={savingsBalance.savedCash}
            memberId={memberId}
            currency={currency}
            headers={headers}
            onBack={handleBack}
            onDone={handleActionDone}
          />
        )}
        {subDialog === 'save' && (
          <SaveDialog
            stickers={availableStickers}
            memberId={memberId}
            currency={currency}
            headers={headers}
            onBack={handleBack}
            onDone={handleActionDone}
          />
        )}
        {subDialog === 'invest' && (
          <InvestDialog
            stickers={
              availableStickers +
              savingsBalance.savedStickers +
              Math.floor(savingsBalance.savedCash / 0.5)
            }
            weekId={weekId}
            memberId={memberId}
            currency={currency}
            headers={headers}
            onBack={handleBack}
            onDone={handleActionDone}
          />
        )}
        {subDialog === 'withdraw' && (
          <WithdrawDialog
            memberId={memberId}
            currency={currency}
            headers={headers}
            onBack={handleBack}
            onDone={handleActionDone}
          />
        )}
      </div>
    );
  }

  // ── Main dialog ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      data-testid="close-week-dialog"
    >
      <div className="relative w-full max-w-xl">
        <div className="absolute inset-0 bg-pink-500 rounded-3xl translate-x-1.5 translate-y-1.5 sm:translate-x-2 sm:translate-y-2"></div>
        <div className="relative bg-purple-900 border-2 sm:border-3 border-pink-400 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-purple-950 p-4 sm:p-5 border-b-2 sm:border-b-3 border-pink-400/30 relative flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-pink-400 p-3 rounded-xl border-2 border-black shadow-neo-xs">
                <span className="text-2xl">🗓️</span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">
                  Close Week
                </h2>
                <p className="text-pink-300 text-xs font-bold uppercase tracking-wide">
                  Choose your action
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              data-testid="close-week-dialog-close-btn"
              className="bg-purple-800 hover:bg-purple-700 text-white p-2 rounded-xl border-2 border-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
            {isAdmin && (
              <div className="bg-amber-400 border-2 sm:border-3 border-black rounded-xl p-3 flex items-center gap-3 shadow-neo">
                <ShieldCheck className="w-6 h-6 text-black flex-shrink-0" />
                <p className="text-xs font-black text-black uppercase tracking-wide">
                  Admin Mode Active
                </p>
              </div>
            )}

            {/* Actions Taken This Session */}
            {actions.length > 0 && (
              <div
                className="bg-purple-800 border-2 sm:border-3 border-black rounded-2xl p-4"
                data-testid="close-week-actions-list"
              >
                <p className="text-xs font-black text-pink-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Check className="w-3 h-3" /> Actions Taken ({actions.length})
                </p>
                <div className="space-y-2">
                  {actions.map((action, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl px-3 py-2 flex items-center gap-3 ${
                        action.type === 'claim'
                          ? 'bg-pink-500/20'
                          : action.type === 'cashout'
                            ? 'bg-lime-500/20'
                            : action.type === 'save'
                              ? 'bg-cyan-500/20'
                              : action.type === 'invest'
                                ? 'bg-yellow-500/20'
                                : 'bg-orange-500/20'
                      }`}
                    >
                      <span className="text-xl">
                        {action.type === 'claim' && '🎁'}
                        {action.type === 'cashout' && '💰'}
                        {action.type === 'save' && '🐷'}
                        {action.type === 'invest' && '📈'}
                        {action.type === 'withdraw' && '🏦'}
                      </span>
                      <p className="text-white font-bold text-sm flex-1 min-w-0 truncate">
                        {action.type === 'claim' &&
                          `Claimed: ${action.rewardName} (${action.stickersUsed}⭐)`}
                        {action.type === 'cashout' &&
                          `Cashed Out: ${action.cashAmount?.toFixed(2)} ${currency} (${action.stickersUsed}⭐)`}
                        {action.type === 'save' &&
                          (action.stickersUsed
                            ? `Saved: ${action.stickersUsed} stickers`
                            : `Saved: ${action.cashAmount?.toFixed(2)} ${currency}`)}
                        {action.type === 'invest' &&
                          `Invested: ${action.cashAmount?.toFixed(2)} ${currency} → ${action.habitName}`}
                        {action.type === 'withdraw' &&
                          `Withdrawn: ${action.cashAmount?.toFixed(2)} ${currency} from ${action.habitName ?? 'investment'}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSubDialog('claim')}
                data-testid="close-week-action-claim"
                className="group relative h-24 sm:h-32 bg-pink-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                <div className="absolute top-2 right-2 text-3xl group-hover:scale-125 transition-transform duration-300">
                  🎁
                </div>
                <div className="absolute bottom-3 left-3 text-left">
                  <p className="text-xs font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                    Spend
                  </p>
                  <p className="text-lg font-black text-white leading-none drop-shadow-md">
                    Claim Reward
                  </p>
                </div>
              </button>

              <button
                onClick={() => setSubDialog('cashout')}
                data-testid="close-week-action-cashout"
                className="group relative h-24 sm:h-32 bg-lime-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                <div className="absolute top-2 right-2 text-3xl group-hover:scale-125 transition-transform duration-300">
                  💰
                </div>
                <div className="absolute bottom-3 left-3 text-left">
                  <p className="text-xs font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                    Withdraw
                  </p>
                  <p className="text-lg font-black text-black leading-none">Cash Out</p>
                </div>
              </button>

              <button
                onClick={() => setSubDialog('save')}
                data-testid="close-week-action-save"
                className="group relative h-24 sm:h-32 bg-cyan-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                <div className="absolute top-2 right-2 text-3xl group-hover:scale-125 transition-transform duration-300">
                  🐷
                </div>
                <div className="absolute bottom-3 left-3 text-left">
                  <p className="text-xs font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                    Keep
                  </p>
                  <p className="text-lg font-black text-black leading-none">Save Later</p>
                </div>
              </button>

              <button
                onClick={() => setSubDialog('invest')}
                data-testid="close-week-action-invest"
                className="group relative h-24 sm:h-32 bg-yellow-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                <div className="absolute top-2 right-2 text-3xl group-hover:scale-125 transition-transform duration-300">
                  📈
                </div>
                <div className="absolute bottom-3 left-3 text-left">
                  <p className="text-xs font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                    Grow
                  </p>
                  <p className="text-lg font-black text-black leading-none">Invest</p>
                </div>
              </button>

              <button
                onClick={() => setSubDialog('withdraw')}
                data-testid="close-week-action-withdraw"
                className="group relative h-24 sm:h-32 bg-orange-400 border-2 sm:border-3 border-black rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none transition-all col-span-2 overflow-hidden"
              >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                <div className="absolute top-2 right-2 text-3xl group-hover:scale-125 transition-transform duration-300">
                  🏦
                </div>
                <div className="absolute bottom-3 left-3 text-left">
                  <p className="text-xs font-black text-black uppercase tracking-wide bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                    Exit Early
                  </p>
                  <p className="text-lg font-black text-black leading-none">Withdraw Investment</p>
                </div>
              </button>
            </div>

            {/* Finalize Week Button */}
            <div className="pt-4 border-t-2 border-purple-700">
              {finalizeError && (
                <div
                  data-testid="close-week-error"
                  className="mb-3 bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-red-300 text-sm font-bold text-center"
                >
                  {finalizeError}
                </div>
              )}
              <button
                onClick={handleFinalizeWeek}
                disabled={finalizing}
                data-testid="close-week-finalize-btn"
                className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-700 text-white border-2 sm:border-3 border-black font-black text-lg px-6 py-4 rounded-2xl shadow-neo motion-safe:hover:translate-y-1 motion-safe:hover:shadow-neo-xs active:translate-y-2 active:shadow-none disabled:translate-y-0 disabled:shadow-neo transition-all uppercase flex items-center justify-center gap-3"
              >
                {finalizing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Closing Week...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Close Week &amp; Start New
                  </>
                )}
              </button>
              <p className="text-center text-purple-400 text-xs mt-2 font-medium">
                This will finalize all transactions and create a new week
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
