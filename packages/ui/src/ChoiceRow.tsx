import type { ReactNode } from 'react';

export interface ChoiceRowProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  testId?: string;
}

/**
 * One row in a single-choice list — e.g. the "Pocket money" screen's
 * (FHS-512) "What happens on a day they skip it?" Nothing / They-lose-
 * some-money choice. Generic enough for any radio-style choice list.
 */
export function ChoiceRow({ selected, onClick, title, description, icon, testId }: ChoiceRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testId}
      onClick={onClick}
      className={[
        'flex w-full items-start gap-3 rounded-xl border-2 border-black p-3.5 text-left transition-all',
        'motion-safe:hover:-translate-y-0.5',
        selected ? 'bg-yellow-50 shadow-neo-xs' : 'bg-white hover:bg-gray-50',
      ].join(' ')}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black text-lg',
            selected ? 'bg-yellow-300' : 'bg-gray-100',
          ].join(' ')}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-gray-900">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs font-medium text-gray-500">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-black',
          selected ? 'bg-black' : 'bg-white',
        ].join(' ')}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
    </button>
  );
}
