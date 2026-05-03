import { useEffect, useState } from 'react';

// Tear-off calendar that mimics the look of the 📅 emoji glyph but
// shows the user's actual current date. Built because the OS-rendered
// 📅 emoji is hard-coded to "JUL 17" on Apple platforms and varies
// arbitrarily on other platforms — an obvious tell when used as a
// "today's plan" visual cue.
//
// The component picks up the date on mount and refreshes itself once
// per minute, so a user who keeps the page open past midnight still
// sees the right day without a hard reload.

export interface DynamicCalendarProps {
  /** Override "today" for tests / Storybook. Defaults to the live clock. */
  now?: Date;
  /**
   * BCP-47 locale for the month abbreviation. Defaults to the browser's
   * detected locale; falls back to "en-US" when unavailable (SSR / jsdom).
   */
  locale?: string;
  /** Tailwind width — defaults to w-12 to roughly match `text-4xl` emoji. */
  className?: string;
  testId?: string;
}

function detectLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
}

export function DynamicCalendar({ now, locale, className = 'w-12', testId }: DynamicCalendarProps) {
  // When `now` is passed (tests), don't run the clock effect at all so
  // the rendered date is fully deterministic.
  const [today, setToday] = useState<Date>(() => now ?? new Date());

  useEffect(() => {
    if (now) return;
    // Tick once a minute — cheap, and resilient to a tab kept open
    // across midnight without needing a precise sleep-to-midnight
    // calculation.
    const id = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [now]);

  const resolvedLocale = locale ?? detectLocale();
  const month = new Intl.DateTimeFormat(resolvedLocale, { month: 'short' })
    .format(today)
    .toUpperCase();
  const day = today.getDate();

  // a11y: render a hidden long-form date for screen readers; the visual
  // tear-off is purely decorative.
  const longDate = new Intl.DateTimeFormat(resolvedLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(today);

  return (
    <div
      role="img"
      aria-label={longDate}
      data-testid={testId}
      className={`inline-flex flex-col overflow-hidden rounded-md border-2 border-black bg-white shadow-neo-sm ${className}`}
    >
      <div className="bg-red-700 px-1 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-white">
        {month}
      </div>
      <div className="px-1 py-1 text-center font-heading text-xl leading-none text-black">
        {day}
      </div>
    </div>
  );
}
