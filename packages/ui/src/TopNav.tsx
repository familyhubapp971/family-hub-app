import React from 'react';

export interface TopNavTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Optional numeric badge rendered as a pill next to the label.
   * Hidden when 0 or undefined so callers can pass the count straight
   * through without conditional logic. Negative values are clamped to 0.
   * FHS-261 — wired by the founder; counts come from /api/dashboard/today
   * once FHS-262 expands its response.
   */
  badge?: number;
}

interface TopNavProps {
  /** Brand area on the far left — usually the logo + product name. */
  brand?: React.ReactNode;
  /** Ordered tab list. Renders left-to-right after the brand. */
  tabs: TopNavTab[];
  /** Currently active tab id. */
  activeTab: string;
  /** Fires with the clicked tab's id. */
  onTabChange: (tabId: string) => void;
  /** Optional content rendered on the far right (user menu, settings, etc.). */
  rightSlot?: React.ReactNode;
  /** Optional className override on the outer <nav>. */
  className?: string;
  testId?: string;
}

/**
 * Sticky top navigation used across authenticated surfaces (Parent
 * Dashboard, ChildWorld). Designed for the kingdom-purple background:
 * white pill-buttons for tabs, yellow active state. Tab list is fully
 * data-driven so the same component serves multiple surfaces — Dashboard
 * passes its 6 tabs, ChildWorld passes its 5.
 *
 * Keyboard a11y: tab buttons are real <button>s; arrow keys are NOT
 * intercepted (browser default Tab key navigation is sufficient and
 * predictable).
 */
export function TopNav({
  brand,
  tabs,
  activeTab,
  onTabChange,
  rightSlot,
  className = '',
  testId,
}: TopNavProps) {
  return (
    <nav
      data-testid={testId}
      className={[
        'sticky top-0 z-30 w-full border-b-2 border-black bg-kingdom-bg/95 backdrop-blur',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="navigation"
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 md:px-6">
        {brand && <div className="shrink-0 font-heading text-xl text-white">{brand}</div>}

        <div
          className="flex flex-1 items-center gap-2 overflow-x-auto"
          role="tablist"
          aria-label="Primary"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={[
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-black px-3 py-1.5 text-sm font-bold transition-all duration-150',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-kingdom-bg',
                  active
                    ? 'bg-pink-400 text-white shadow-neo'
                    : 'bg-white/10 text-white shadow-none hover:bg-white/20',
                ].join(' ')}
              >
                {tab.icon && <span className="shrink-0">{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    aria-label={`${tab.badge} unread`}
                    data-testid={`tab-${tab.id}-badge`}
                    className={[
                      'ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-black leading-none',
                      active ? 'bg-black text-yellow-300' : 'bg-pink-500 text-white',
                    ].join(' ')}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </nav>
  );
}
