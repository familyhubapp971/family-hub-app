/**
 * MoneyActionsSheet: FHS-623
 *
 * Wires the FHS-622 seam (KidsMoneyPage's `onMoneyAction`) to the real
 * endpoints. A bottom sheet on a phone, a centred panel from tablet up
 * (Dialog's `align="bottom-sheet"`), one flow per action, each ending in a
 * "done" screen the family can read before it closes. Nothing here is
 * discarded on close: every confirm is a real POST, and a failure leaves
 * the sheet open with a plain-words error, never a silent no-op.
 *
 * Explicitly out of scope: the design's "close the week" chooser
 * (components/MoneyActions.tsx also has a path into that flow). Closing a
 * week already exists (CloseWeekDialog, apps/web/src/pages/tenant/child),
 * so this sheet only ever opens from the Kids money page's own five
 * buttons, never from a week-close flow.
 */
import { useEffect, useId, useState } from 'react';
import { Check, Gift, PiggyBank, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { Button, Dialog } from '@familyhub/ui';
import type { ChildMoneySnapshot, MoneyAction } from '../KidsMoneyPage';
import type { MoneyHeaders } from './moneyActionsApi';
import { ClaimRewardFlow } from './ClaimRewardFlow';
import { CashOutFlow } from './CashOutFlow';
import { SaveFlow } from './SaveFlow';
import { InvestFlow } from './InvestFlow';
import { WithdrawFlow } from './WithdrawFlow';

export interface MoneyActionsSheetProps {
  isOpen: boolean;
  action: MoneyAction | null;
  child: { id: string; name: string } | null;
  snapshot: ChildMoneySnapshot | null;
  weekId: string | null;
  headers: MoneyHeaders;
  onClose: () => void;
  /** Fired the instant a mutation saves, so the page can refresh its
   *  figures while the sheet is still showing the "done" screen. */
  onSaved: () => void;
}

const ACTION_META: Record<MoneyAction, { title: string; icon: React.ReactNode; tone: string }> = {
  claim: { title: 'Claim a reward', icon: <Gift size={20} strokeWidth={3} />, tone: 'bg-pink-300' },
  cash: { title: 'Cash out', icon: <Wallet size={20} strokeWidth={3} />, tone: 'bg-lime-300' },
  save: {
    title: 'Move to savings',
    icon: <PiggyBank size={20} strokeWidth={3} />,
    tone: 'bg-cyan-300',
  },
  invest: {
    title: 'Invest and grow',
    icon: <TrendingUp size={20} strokeWidth={3} />,
    tone: 'bg-yellow-300',
  },
  withdraw: {
    title: 'Take money out of an investment',
    icon: <TrendingDown size={20} strokeWidth={3} />,
    tone: 'bg-orange-300',
  },
};

export function MoneyActionsSheet({
  isOpen,
  action,
  child,
  snapshot,
  weekId,
  headers,
  onClose,
  onSaved,
}: MoneyActionsSheetProps) {
  const titleId = useId();
  const [phase, setPhase] = useState<'form' | 'done'>('form');
  const [doneMessage, setDoneMessage] = useState('');

  const ready = isOpen && action !== null && child !== null && snapshot !== null;

  // A fresh action (even re-opening the same one) always starts on the form.
  useEffect(() => {
    if (!ready) return;
    setPhase('form');
    setDoneMessage('');
  }, [ready, action, child?.id]);

  if (!ready) return null;

  const meta = ACTION_META[action];

  const handleSuccess = (message: string) => {
    setDoneMessage(message);
    setPhase('done');
    onSaved();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      align="bottom-sheet"
      ariaLabelledBy={titleId}
      testId="money-actions-sheet"
    >
      <div className="relative w-full max-w-lg">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-t-3xl bg-black sm:rounded-3xl" />
        <div className="relative max-h-[85vh] overflow-y-auto rounded-t-3xl border-2 border-black bg-white shadow-neo sm:rounded-3xl sm:border-3">
          <div
            className={`flex items-start gap-3 border-b-2 border-black p-5 sm:border-b-3 ${meta.tone}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white">
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-heading text-xl uppercase tracking-wide">
                {meta.title}
              </h2>
              <p className="text-sm font-bold text-black/70">for {child.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-testid="money-actions-sheet-close"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border-2 border-black bg-white transition-transform motion-safe:hover:-translate-y-0.5"
            >
              <X size={18} strokeWidth={3} aria-hidden="true" />
            </button>
          </div>

          <div className="p-5">
            {phase === 'done' ? (
              <div className="space-y-4 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-lime-300">
                  <Check size={28} strokeWidth={3} aria-hidden="true" />
                </span>
                <p className="font-bold text-gray-900" data-testid="money-actions-done-message">
                  {doneMessage}
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={onClose}
                  testId="money-actions-done-close"
                >
                  Done
                </Button>
              </div>
            ) : action === 'claim' ? (
              <ClaimRewardFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            ) : action === 'cash' ? (
              <CashOutFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            ) : action === 'save' ? (
              <SaveFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            ) : action === 'invest' ? (
              <InvestFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            ) : (
              <WithdrawFlow
                child={child}
                snapshot={snapshot}
                weekId={weekId}
                headers={headers}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
