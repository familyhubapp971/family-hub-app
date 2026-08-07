/**
 * CashOutFlow: FHS-623
 *
 * Turns savings into real money. Draws only from savings (the server route
 * is /savings/cashout, not the weekly spendable pool), so the sticker
 * picker's ceiling is `snapshot.saved`, matching what the page itself calls
 * "In savings".
 */
import { useState } from 'react';
import { Button, ResultBanner, StickerAmountPicker } from '@familyhub/ui';
import { formatMoney } from '@familyhub/shared';
import { cashOut, MoneyActionError } from './moneyActionsApi';
import { friendlyFailureMessage, type MoneyFlowProps } from './types';

export function CashOutFlow({ child, snapshot, headers, onSuccess, onCancel }: MoneyFlowProps) {
  const max = snapshot.saved;
  const [amount, setAmount] = useState(max);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cash = amount * snapshot.stickerRate;

  const handleConfirm = async () => {
    if (amount <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await cashOut(child.id, cash, headers);
      onSuccess(
        `Cashed out ${amount} stickers for ${formatMoney(cash, snapshot.currency)}. ${
          max - amount
        } stickers left in savings.`,
      );
    } catch (err) {
      setError(friendlyFailureMessage(err instanceof MoneyActionError ? err.detail : undefined));
      setSubmitting(false);
    }
  };

  if (max === 0) {
    return (
      <div className="space-y-4">
        <ResultBanner testId="money-cash-empty">
          {child.name} has nothing in savings yet, so there is nothing to cash out.
        </ResultBanner>
        <Button variant="secondary" fullWidth onClick={onCancel} testId="money-cash-cancel">
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
        label={`How many stickers to cash out (up to ${max})`}
        preview={`= ${formatMoney(cash, snapshot.currency)}`}
        testId="money-cash-amount"
      />

      <ResultBanner testId="money-cash-preview">
        {amount > 0
          ? `${child.name} hands over ${amount} stickers and gets ${formatMoney(cash, snapshot.currency)}. ${max - amount} stickers stay in savings.`
          : 'Pick how many stickers to cash out.'}
      </ResultBanner>

      {error && (
        <ResultBanner tone="warning" testId="money-cash-error">
          {error}
        </ResultBanner>
      )}

      <div className="flex gap-3">
        <Button
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={submitting}
          testId="money-cash-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleConfirm}
          disabled={amount <= 0 || submitting}
          testId="money-cash-confirm"
        >
          {submitting ? 'Cashing out…' : 'Cash out'}
        </Button>
      </div>
    </div>
  );
}
