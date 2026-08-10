/**
 * FHS-638: where a seeded week starts, kept apart from the seeding itself.
 *
 * Its own module so the unit tier can import the real rule without dragging in
 * a database client. The first version of that test re-implemented this and so
 * graded a copy of itself: it passed while the seed was reading a UTC-built
 * date with local getters, which moved every existing fixture's week a day
 * earlier on any machine west of Greenwich.
 */

/**
 * Two calendars on purpose, and they must not be mixed:
 *
 *   - `weekEndsToday` builds and reads in LOCAL time, because the board's own
 *     "is it the last day?" check parses `startDate` as local. Local-to-local
 *     is the only comparison that cannot be a day out.
 *   - The ordinary week keeps the UTC calendar it has always used, built AND
 *     read in UTC, so every existing fixture keeps the dates it had.
 */
export function liveWeekStart(
  now: Date,
  weekEndsToday: boolean,
): { startDate: string; year: number } {
  if (weekEndsToday) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 6);
    return { startDate: isoDayLocal(start), year: start.getFullYear() };
  }
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
    ),
  );
  return { startDate: monday.toISOString().slice(0, 10), year: monday.getUTCFullYear() };
}

/** The previous week's start, in whichever calendar `liveWeekStart` used. */
export function previousWeekStart(startDate: string): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function isoDayLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
