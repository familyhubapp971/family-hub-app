import type { ReactNode } from 'react';

export interface ResultBannerProps {
  children: ReactNode;
  tone?: 'positive' | 'warning';
  testId?: string;
}

/**
 * A small "here's what this means" banner — e.g. the "Pocket money" screen's
 * (FHS-512) "This habit pays {amount} each time." live result under the
 * boost picker. `tone="warning"` for the skip-penalty preview.
 */
export function ResultBanner({ children, tone = 'positive', testId }: ResultBannerProps) {
  const toneStyles =
    tone === 'warning'
      ? 'bg-red-50 border-red-300 text-red-800'
      : 'bg-lime-50 border-black text-gray-900';
  return (
    <p
      data-testid={testId}
      className={['rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold', toneStyles].join(' ')}
    >
      {children}
    </p>
  );
}
