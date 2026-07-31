import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// FHS-513 — reusable collapsible group card: an emoji tile + title +
// optional subtitle/count in a coloured header bar, a chevron that
// flips on toggle, and a body that only renders while open. Used for
// the Manage Members "Grown-ups" / "Kids" groups and the "How your
// kids sign in" helper card — any future page that groups content
// behind a coloured, collapsible header should reuse this instead of
// hand-rolling another `useState` + chevron.

export interface CollapsibleSectionProps {
  /** Emoji (or any short glyph) shown in the round tile on the left. */
  emoji: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Shown as "(N)" next to the title when set. */
  count?: number;
  /** Tailwind background class for the header bar, e.g. "bg-cyan-200". */
  headerClassName?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}

export function CollapsibleSection({
  emoji,
  title,
  subtitle,
  count,
  headerClassName = 'bg-gray-100',
  defaultOpen = true,
  children,
  testId,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-neo-md"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={testId ? `${testId}-toggle` : undefined}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5 sm:py-4 ${headerClassName}`}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-xl"
        >
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg text-black">
            {title}
            {typeof count === 'number' && (
              <span className="ml-2 text-sm font-bold text-gray-700">({count})</span>
            )}
          </span>
          {subtitle && <span className="block text-xs font-bold text-gray-700">{subtitle}</span>}
        </span>
        <ChevronDown
          size={20}
          strokeWidth={3}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="p-4 sm:p-5" data-testid={testId ? `${testId}-body` : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}
