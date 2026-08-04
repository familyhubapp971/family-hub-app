# 0017: Learn is a kid-only feature

**Status:** accepted
**Date:** 2026-06-24
**Jira:** FHS-382, FHS-388

## Context

Learn (interactive lessons, reading log, world flags) was implemented as a
shared experience: a parent `/api/learn`, `/api/reading-log`, and
`/api/world-flags` surface that the parent ChildWorld tab called with a
`memberId` parameter, plus a parallel `/api/kid/*` surface that the kid
dashboard calls using the kid's own token.

The duplication was accidental, the parent-facing Learn tab let a parent
_take lessons on behalf of a child_ rather than _viewing that child's
progress_. Parents want to see how their child is doing, not re-do the
lessons themselves. The correct parent experience is a read-only
Learning Insights view (epic FHS-388, tickets FHS-383/384/385), not a
duplicate of the kid UI.

## Decision

Learn lives only in the kid experience at `/api/kid/*`.

- The parent `/api/learn`, `/api/reading-log`, and `/api/world-flags`
  routes are removed.
- The shared Zod schemas and DB helpers those routes exported (used by
  `kid.ts`) are moved to `apps/api/src/lib/learn-shared.ts` and
  `apps/api/src/lib/reading-log-shared.ts` so `kid.ts` and `registry.ts`
  can import them without depending on the deleted routers.
- `apps/api/src/lib/world-flags.ts` (the DB helpers shared by both the
  old parent router and kid.ts) is kept unchanged, kid.ts still imports
  from it.
- The parent ChildWorld tab's Learn tab (in `ChildWorldPage.tsx`) is
  removed. The page now has four tabs: My World, Meals, Calendar, Journal.
- Parents will gain a read-only Learning Insights tab via FHS-388, backed
  by a new `/api/learning-insights` endpoint that aggregates the kid's
  progress for parental viewing, no lesson-taking.

## Consequences

**Easier:**

- No duplicated route surface: learn logic lives in one place (`/api/kid/*`).
- Fewer routes to maintain, document, and test.
- Parent Learn tests (unit + integration) removed; kid Learn tests unchanged.
- The OpenAPI spec shrinks by 12 operations (4 per removed router).

**Harder / follow-ups:**

- Parents lose the ability to see live learn progress until FHS-388 ships.
  Acceptable: the kid ChildWorld (kid dashboard) already shows the kid's
  own progress; a parent can ask their child, or wait for insights.
- FHS-383/384/385 must be built under FHS-388 to close the parent gap.

## Alternatives considered

- **Keep the parent routes as a proxy to the kid data**, rejected; this
  duplicates auth logic and creates a second path where a regression in
  the parent route could expose cross-tenant or cross-member data. Cleaner
  to have one authoritative surface.
- **Hide the parent tab but keep the routes**, rejected; dead routes still
  appear in the spec, are tested, and must be kept secure. Deleting them
  removes the maintenance surface entirely.
