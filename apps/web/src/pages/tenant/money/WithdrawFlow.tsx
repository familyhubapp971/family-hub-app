/**
 * WithdrawFlow: FHS-623
 *
 * Picks a running investment, then how many stickers to take out, not the
 * whole thing. Always sends an explicit `stickers` amount (the API's
 * "omit to take the lot" shortcut is never used from this UI), so a
 * deliberate partial withdrawal is always possible.
 */
import { useEffect, useState } from 'react';
import { Button, ChoiceRow, ResultBanner, Spinner, StickerAmountPicker } from '@familyhub/ui';
import { formatMoney } from '@familyhub/shared';
import {
  fetchInvestments,
  withdrawInvestment,
  MoneyActionError,
  type ActiveInvestment,
} from './moneyActionsApi';
import { friendlyFailureMessage, type MoneyFlowProps } from './types';

export function WithdrawFlow({ child, snapshot, headers, onSuccess, onCancel }: MoneyFlowProps) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvestments(child.id, headers)
      .then((body) => {
        if (cancelled) return;
        setInvestments(body.investments);
        const first = body.investments[0];
        if (first) {
          setSelectedId(first.id);
          setAmount(first.currentValueStickers);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id]);

  const selected = investments.find((i) => i.id === selectedId) ?? null;
  const max = selected?.currentValueStickers ?? 0;
  const cash = amount * snapshot.stickerRate;

  const handlePick = (inv: ActiveInvestment) => {
    setSelectedId(inv.id);
    setAmount(inv.currentValueStickers);
  };

  const handleConfirm = async () => {
    if (!selected || amount <= 0 || amount > max) return;
    setSubmitting(true);
    setError(null);
    try {
      await withdrawInvestment(selected.id, child.id, amount, headers);
      const remaining = max - amount;
      onSuccess(
        remaining > 0
          ? `Took ${amount} stickers out of ${selected.habitName ?? 'that investment'} (${formatMoney(cash, snapshot.currency)}) into savings. ${remaining} stickers keep growing.`
          : `Took the whole ${amount} stickers out of ${selected.habitName ?? 'that investment'} (${formatMoney(cash, snapshot.currency)}) into savings. Nothing left invested there.`,
      );
    } catch (err) {
      setError(friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" data-testid="money-withdraw-loading">
        <Spinner size="md" label="Loading investments" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <ResultBanner tone="warning" testId="money-withdraw-load-error">
          Could not load {child.name}&apos;s investments. Nothing has changed.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-withdraw-cancel">
          Close
        </Button>
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="space-y-4">
        <ResultBanner testId="money-withdraw-empty">
          {child.name} has nothing invested right now.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-withdraw-cancel">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Which investment?
        </p>
        <div
          className="max-h-40 space-y-2 overflow-y-auto pr-1"
          role="radiogroup"
          aria-label="Investment"
        >
          {investments.map((inv) => (
            <ChoiceRow
              key={inv.id}
              selected={selectedId === inv.id}
              onClick={() => handlePick(inv)}
              icon={inv.habitIcon ?? '📈'}
              title={inv.habitName ?? 'Investment'}
              description={`${inv.currentValueStickers} stickers now · ${inv.coefficient ?? 5}x · ${
                inv.deductible ? 'a missed day takes value off' : 'no penalty for a missed day'
              }`}
              testId={`money-withdraw-investment-${inv.id}`}
            />
          ))}
        </div>
      </div>

      {selected && (
        <StickerAmountPicker
          value={amount}
          min={0}
          max={max}
          onChange={setAmount}
          label={`How many stickers to take out (up to ${max})`}
          preview={`= ${formatMoney(cash, snapshot.currency)}`}
          testId="money-withdraw-amount"
        />
      )}

      <ResultBanner testId="money-withdraw-preview">
        {selected && amount > 0
          ? `${amount} stickers move to savings (${formatMoney(cash, snapshot.currency)}). ${
              max - amount
            } stay invested and keep growing.`
          : 'Pick how many stickers to take out.'}
      </ResultBanner>

      {error && (
        <ResultBanner tone="warning" testId="money-withdraw-error">
          {error}
        </ResultBanner>
      )}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={submitting}
          testId="money-withdraw-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleConfirm}
          disabled={!selected || amount <= 0 || submitting}
          testId="money-withdraw-confirm"
        >
          {submitting ? 'Withdrawing…' : 'Take it out'}
        </Button>
      </div>
    </div>
  );
}
