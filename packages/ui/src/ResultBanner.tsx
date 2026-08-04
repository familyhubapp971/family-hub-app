import type { ReactNode } from 'react';
import { AlertTriangle, Star } from 'lucide-react';

export interface ResultBannerProps {
  children: ReactNode;
  tone?: 'positive' | 'warning';
  testId?: string;
}

/**
 * A small "here's what this means" banner, e.g. the "Pocket money" screen's
 * (FHS-512) "This habit pays {amount} each time." live result under the
 * boost picker. `tone="warning"` for the skip-penalty preview. The leading
 * icon is decorative (aria-hidden) and doesn't add to `.textContent`.
 */
export function ResultBanner({ children, tone = 'positive', testId }: ResultBannerProps) {
  const toneStyles =
    tone === 'warning'
      ? 'bg-red-50 border-red-300 text-red-800'
      : 'bg-lime-50 border-black text-gray-900';
  const Icon = tone === 'warning' ? AlertTriangle : Star;
  return (
    <p
      data-testid={testId}
      className={[
        'flex items-start gap-2 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold',
        toneStyles,
      ].join(' ')}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
