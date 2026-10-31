import { describe, it, expect } from 'vitest';
import {
  liveWeekStart,
  previousWeekStart,
} from '../../../tests/e2e/support/auth/seed-week-anchor.js';

// FHS-638: the date rule the e2e seed uses to anchor a week so today is its
// last day. The browser spec that relies on it can only run on the day it runs,
// so the rule itself is checked here across every weekday and both calendars.
//
// This imports the REAL function on purpose. The first version re-implemented
// it, which made it a copy grading itself: it passed while the seed was reading
// a UTC-built date with local getters, shifting every existing fixture's week a
// day earlier on any machine west of Greenwich.

/** The board's own check: `showCloseWeekBanner` in MyWorldTab. */
function bannerShows(startDate: string, today: Date): boolean {
  const lastDay = new Date(`${startDate}T00:00:00`);
  lastDay.setDate(lastDay.getDate() + 6);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return iso(today) >= iso(lastDay);
}

describe('the e2e seed anchors a week so Close Week is always offered (FHS-638)', () => {
  it('offers it on every day of the week', () => {
    for (let i = 0; i < 7; i += 1) {
      const today = new Date(2026, 7, 10 + i); // Aug 10-16 2026, Monday to Sunday
      const { startDate } = liveWeekStart(today, true);
      expect(bannerShows(startDate, today)).toBe(true);
    }
  });

  it('works across a month boundary', () => {
    const today = new Date(2026, 8, 2); // 2 Sep: the week starts in August
    const { startDate, year } = liveWeekStart(today, true);
    expect(startDate).toBe('2026-08-27');
    expect(year).toBe(2026);
    expect(bannerShows(startDate, today)).toBe(true);
  });

  it('works across a year boundary, and the year matches the start date', () => {
    const today = new Date(2027, 0, 3); // 3 Jan: the week starts in December
    const { startDate, year } = liveWeekStart(today, true);
    expect(startDate).toBe('2026-12-28');
    // Review finding: `year` was read with a UTC getter while `startDate` was
    // built locally, so the two could name different years in January.
    expect(year).toBe(2026);
    expect(startDate.startsWith(String(year))).toBe(true);
  });

  it('the ordinary week is the one that was flaky: only its own last day works', () => {
    const today = new Date(Date.UTC(2026, 7, 12)); // a Wednesday
    const { startDate } = liveWeekStart(today, false);
    expect(bannerShows(startDate, new Date(2026, 7, 12))).toBe(false);
    expect(bannerShows(startDate, new Date(2026, 7, 16))).toBe(true); // its Sunday
  });

  it('reads the ordinary week in the same calendar it builds it in', () => {
    // The bug this pins: building with Date.UTC and reading with local getters
    // moved the date a day earlier for every negative UTC offset.
    const today = new Date('2026-08-10T15:00:00Z');
    const { startDate, year } = liveWeekStart(today, false);
    expect(startDate).toBe('2026-08-10');
    expect(year).toBe(2026);
  });

  it('puts the previous week exactly seven days before', () => {
    expect(previousWeekStart('2026-08-10')).toBe('2026-08-03');
    expect(previousWeekStart('2026-01-04')).toBe('2025-12-28');
  });
});
