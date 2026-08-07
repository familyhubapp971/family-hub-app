/**
 * SaveFlow: FHS-623
 *
 * Moves stickers from this week's spendable pool into savings. Server route
 * only draws from what's still unallocated this week, so the picker's
 * ceiling is `snapshot.available` ("Ready to spend" on the page).
 */
import { useState } from 'react';
import { Button, ResultBanner, StickerAmountPicker } from '@familyhub/ui';
import { formatMoney } from '@familyhub/shared';
import { moveToSavings, MoneyActionError } from './moneyActionsApi';
import { friendlyFailureMessage, type MoneyFlowProps } from './types';

export function SaveFlow({ child, snapshot, headers, onSuccess, onCancel }: MoneyFlowProps) {
  const max = snapshot.available;
  const [amount, setAmount] = useState(max);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await moveToSavings(child.id, amount, headers);
      onSuccess(`Moved ${amount} stickers into savings. ${max - amount} still ready to spend.`);
    } catch (err) {
      setError(friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined));
      setSubmitting(false);
    }
  };

  if (max === 0) {
    return (
      <div className="space-y-4">
        <ResultBanner testId="money-save-empty">
          {child.name} has nothing spendable yet, so there is nothing to move.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-save-cancel">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StickerAmountPicker
        value={amount}
        min={0}
        max={max}
        onChange={setAmount}
        label={`How many stickers to move into savings (up to ${max})`}
        preview={`= ${formatMoney(amount * snapshot.stickerRate, snapshot.currency)}`}
        testId="money-save-amount"
      />

      <ResultBanner testId="money-save-preview">
        {amount > 0
          ? `${amount} stickers move into savings. ${max - amount} stay ready to spend.`
          : 'Pick how many stickers to move into savings.'}
      </ResultBanner>

      {error && (
        <ResultBanner tone="warning" testId="money-save-error">
          {error}
        </ResultBanner>
      )}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={submitting}
          testId="money-save-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleConfirm}
          disabled={amount <= 0 || submitting}
          testId="money-save-confirm"
        >
          {submitting ? 'Saving…' : 'Move to savings'}
        </Button>
      </div>
    </div>
  );
}
