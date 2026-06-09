# Post-login redesign roadmap

**Source design:** https://www.magicpatterns.com/c/kudjspxd3xxroueg5jw11o
**Diff baseline:** staging as of 2026-06-07
**Tracked in Jira:** epic [FHS-260](https://qualicion2.atlassian.net/browse/FHS-260) (Sprint 3 — Modules & Gating)

## How to use this doc

For every step below: pick up the matching Jira ticket, branch from `staging`, ship one PR, merge, move on. Each step is small enough to fit a single PR and leaves staging working at the end. Tests that break are listed under each step — they are part of the work, not a follow-up.

The order matters. Phase A unlocks the rest. Phase B steps can run in parallel after A. Phase C depends on the dashboard ticket landing first because it borrows components.

---

## Phase A — Foundations

### Step 1. · [FHS-261](https://qualicion2.atlassian.net/browse/FHS-261) TopNav: profile dropdown, tab icons, family-name hero

**MP source:** `components/TopNav.tsx`, `pages/Dashboard.tsx`
**Live files:**

- `apps/web/src/pages/tenant/DashboardPage.tsx` (header markup, right-slot)
- `packages/ui/src/TopNav.tsx` (extend `TopNavTab` with `icon` + `badge`)

**Change in plain words:** Today the header shows "Family Hub" as a plain text link and the right-side shows the user's email plus a `Log out` button. Replace that with the MP design — a circular gradient avatar holding the family's first initial, the family name in bold uppercase to the right of it, and a small pulsing dot below reading `N MEMBERS ACTIVE`. The right-side becomes a profile pill (avatar + name + chevron) that opens a dropdown listing the children (each with `View World →`), an `Add Child` row, and `Log out` at the bottom. Every tab in between gets a `lucide-react` icon.

**Acceptance criteria:**

- TopNav reads family name + member count from tenant context (no new API call required)
- Each tab item supports an `icon` prop and a `badge` prop (number, hidden when 0)
- Profile pill renders parent display name + first-letter avatar; opens a dropdown on click
- Each child row in the dropdown navigates to `/t/<slug>/child/<memberId>` (the route lands in step 8)
- `Log out` lives at the bottom of the dropdown

**Tests that break / need updating:**

- `tests/unit/web/tenant/DashboardPage.test.tsx`

### Step 2. · [FHS-262](https://qualicion2.atlassian.net/browse/FHS-262) Expand `GET /api/dashboard/today` response

**MP source:** `pages/Dashboard.tsx` (the Today layout)
**Live files:**

- `apps/api/src/routes/dashboard.ts`
- `packages/shared/src/schemas/dashboard.ts` (extend the response schema)

**Change in plain words:** The MP Today screen shows per-member habit progress (`4/6`), streak counts, pending-task counts, a status line, plus a `Today's Snapshot` 3-stat row, a `Family Goals` sidebar, and a `Recent Activity` feed. None of that data is in the current `/api/dashboard/today` response. Expand the response so the UI can render every field without round-tripping to other endpoints.

**New fields to add to the existing response:**

- `counts.tasksDoneToday`, `counts.mealsPlanned`
- `members[].habitsDone`, `members[].habitsTotal`, `members[].streak`, `members[].tasksPending`, `members[].statusText`
- `goals: Array<{ id, label, progress, target }>`
- `recentActivity: Array<{ id, actor, action, timestamp }>` (last 3)

**Acceptance criteria:**

- Response schema extended in `@familyhub/shared` and the API returns the new fields (queries against habits / tasks / activity tables)
- Existing fields unchanged so step 1 ships before this if needed
- A new family with no data returns sensible zeros / empty arrays

**Tests that break / need updating:**

- `tests/unit/api/routes/dashboard.test.ts`
- `tests/integration/features/dashboard.feature`

---

## Phase B — Existing tab redesigns

### Step 3. · [FHS-263](https://qualicion2.atlassian.net/browse/FHS-263) Today tab redesign

**MP source:** `pages/Dashboard.tsx` (the Today layout)
**Live files:**

- `apps/web/src/pages/tenant/dashboard/TodayTabPanel.tsx`

**Change in plain words:** The Today tab today is a member grid + counts row. Match the MP: replace each child card with a stat-rich card (avatar, name, today's habit ring, streak flame, `View World →` link), each adult card with a card showing pending tasks + one-line status text. Add a top "Today's Snapshot" row showing kids habits / tasks done / meals planned. Add a right-hand sidebar with `Family Goals` (vertical progress bars) and `Recent Activity` (last 3 events).

**Acceptance criteria:**

- Consumes the expanded fields from step 2; no new API call
- Child cards clickable, navigate to `/t/<slug>/child/<memberId>`
- Snapshot row renders 3 stats with icons
- Goals sidebar renders up to 3 goals as bars
- Recent Activity sidebar renders 3 most recent events

**Tests that break / need updating:**

- `tests/unit/web/tenant/dashboard/TodayTabPanel.test.tsx`

### Step 4. · [FHS-264](https://qualicion2.atlassian.net/browse/FHS-264) Meals tab redesign + schema expansion

**MP source:** `components/MealPlan.tsx`, `pages/Dashboard.tsx` (Meals area)
**Live files:**

- `apps/api/src/db/schema.ts` (meals table — add `member_id`, `recurring`)
- `apps/api/src/routes/meals.ts`
- `apps/web/src/pages/tenant/dashboard/MealsTabPanel.tsx`
- Drizzle migration `0007_meals_member_recurring.sql` (or next free number)

**Change in plain words:** Add `member_id` (nullable — null means "everyone") and `recurring` (boolean) to the meals table. Update API to accept and return both fields. Replace the flat weekly grid with one card per day; inside each day, render meals stacked with a coloured avatar dot showing who-it's-for, and a small repeat icon on recurring ones. Add filter pills above the grid: `All / <child 1> / <child 2> / …`.

**Acceptance criteria:**

- Migration is reversible (named rollback file committed)
- `POST /api/meals` accepts `memberId: string | null` and `recurring: boolean` (defaults: null + false)
- Filter pills filter client-side from the loaded week
- Recurring meals show the repeat icon

**Tests that break / need updating:**

- `tests/unit/web/tenant/dashboard/MealsTabPanel.test.tsx`
- `tests/unit/api/routes/meals.test.ts`
- `tests/integration/features/meals.feature`

### Step 5. · [FHS-265](https://qualicion2.atlassian.net/browse/FHS-265) Calendar tab redesign + schema expansion

**MP source:** `pages/Dashboard.tsx` (Calendar area)
**Live files:**

- `apps/api/src/db/schema.ts` (events table — add `type`, `location`, `wear`, `member_id` if not already)
- `apps/api/src/routes/events.ts`
- `apps/web/src/pages/tenant/dashboard/CalendarTabPanel.tsx`
- Drizzle migration

**Change in plain words:** Add `type` (enum: `school | home`), `location`, `wear` (free text — "what to wear") fields to events. Add a School / Home sub-tab switcher in the panel. Add per-child filter pills. Expand event cards to show the new fields.

**Acceptance criteria:**

- Migration reversible
- API accepts and returns the new fields
- Sub-tab filters by `type`
- Filter pills filter by `memberId` client-side
- Event card layout shows location + wear when present

**Tests that break / need updating:**

- `tests/unit/web/tenant/dashboard/CalendarTabPanel.test.tsx`
- `tests/integration/features/events.feature`

### Step 6. · [FHS-266](https://qualicion2.atlassian.net/browse/FHS-266) Assignments + Noticeboard visual update

**MP source:** `pages/Dashboard.tsx` (Assignments + Noticeboard areas)
**Live files:**

- `apps/web/src/pages/tenant/dashboard/AssignmentsTabPanel.tsx`
- `apps/web/src/pages/tenant/dashboard/NoticeboardTabPanel.tsx`
- `apps/api/src/db/schema.ts` (notices — add `icon: string | null`)
- `apps/api/src/routes/notices.ts`
- Drizzle migration

**Change in plain words:** Assignments rows already carry `memberId` in the API response but the UI ignores it. Render a coloured avatar dot per row, plus a subject emoji. Notices become a post-it grid (lime-100 background, hover lift) with an emoji icon top-left and a "From <Author>" footer. Add an `icon` column to notices.

**Acceptance criteria:**

- Each assignment row shows the member's avatar dot
- Filter pills above the list filter by member
- Notices render as a wrapping grid of post-it cards
- `POST /api/notices` accepts an `icon` string (single emoji) and persists it

**Tests that break / need updating:**

- `tests/unit/web/tenant/dashboard/AssignmentsTabPanel.test.tsx`
- `tests/unit/web/tenant/dashboard/NoticeboardTabPanel.test.tsx`
- `tests/integration/features/notices.feature`

### Step 7. · [FHS-267](https://qualicion2.atlassian.net/browse/FHS-267) Tasks tab redesign

**MP source:** `pages/Dashboard.tsx` (Tasks area), `components/TaskList.tsx`
**Live files:**

- `apps/web/src/pages/tenant/dashboard/TasksTabPanel.tsx`
- maybe `apps/api/src/routes/tasks.ts` if scope changes (see below)
- maybe `apps/api/src/db/schema.ts` (if RLS policy widens to all members of a tenant)

**Architectural decision required at the start of this ticket:** Tasks today are scoped private-per-member. MP shows both parents' tasks side by side. Pick one: (a) keep private, render a single column and add a placeholder for the other parent, or (b) make tasks tenant-visible (schema + RLS policy change). Document the choice in the PR.

**Acceptance criteria (path b):**

- Schema migration drops the per-member RLS scope on `tasks` and substitutes a tenant-level scope
- API returns tasks for the whole tenant grouped by `assigneeId`
- UI renders one column per parent member with their done-count badge

**Tests that break / need updating:**

- `tests/unit/web/tenant/dashboard/TasksTabPanel.test.tsx`
- `tests/integration/features/tasks.feature` (if RLS changes)

---

## Phase C — Kid experience (ChildWorld)

### Step 8. · [FHS-268](https://qualicion2.atlassian.net/browse/FHS-268) ChildWorld scaffold + My World tab

**MP source:** `pages/ChildWorld.tsx`, `components/HabitTracker.tsx`, `components/Rewards.tsx`
**Live files (all new):**

- `apps/web/src/pages/tenant/child/ChildWorldPage.tsx`
- `apps/web/src/pages/tenant/child/MyWorldTab.tsx`
- `apps/api/src/routes/habits.ts` (extend with `PATCH /:id/log`)
- `apps/api/src/routes/rewards.ts` (extend with `POST /redeem`)
- Drizzle migrations: `habit_logs` table, `reward_redemptions` table

**Change in plain words:** Create the kid experience. A new route `/t/:slug/child/:memberId` renders a friendly ChildWorld shell with five tabs: My World, Meals, Calendar, Journal, Learn. This ticket scaffolds the route + My World tab. My World shows the kid's weekly habit tracker (one row per habit, day-of-week ticks, progress ring, streak), plus a Rewards Shop (star balance + items they can buy, with locked state when they can't afford it).

**Acceptance criteria:**

- Route `/t/:slug/child/:memberId` mounts under `ProtectedRoute` (only members of the tenant)
- `PATCH /api/habits/:id/log` toggles a habit for a date for a given member
- `POST /api/rewards/:id/redeem` spends stars and records the redemption
- Habit tracker UI ticks survive a refresh (writes to DB, reads on next mount)
- Reward "Buy" button is disabled when star balance < cost
- Both new tables have RLS policies tied to `tenant_id`

**Tests that break / need updating:**

- All new (no existing ChildWorld tests)

### Step 9. · [FHS-269](https://qualicion2.atlassian.net/browse/FHS-269) ChildWorld Meals + Calendar tabs

**MP source:** `pages/ChildWorld.tsx`
**Live files:**

- `apps/web/src/pages/tenant/child/MealsTab.tsx` (new)
- `apps/web/src/pages/tenant/child/CalendarTab.tsx` (new)

**Change in plain words:** Read-only versions of the parent Meals + Calendar tabs, filtered to just this child. Reuses the same `/api/meals` and `/api/events` endpoints — just calls them with a `memberId` query and renders without the edit controls.

**Acceptance criteria:**

- Both tabs query the existing APIs with the kid's `memberId`
- No create / edit / delete affordances visible
- Empty states are friendly ("No meals planned for you this week")

**Tests that break / need updating:**

- All new

### Step 10. · [FHS-270](https://qualicion2.atlassian.net/browse/FHS-270) ChildWorld Journal + Learn tabs

**MP source:** `pages/ChildWorld.tsx`
**Live files:**

- `apps/web/src/pages/tenant/child/JournalTab.tsx` (new)
- `apps/web/src/pages/tenant/child/LearnTab.tsx` (new)
- `apps/api/src/routes/journal.ts` (new)
- `apps/api/src/routes/learn.ts` (new)
- Drizzle migrations: `journal_entries`, `learn_progress`

**Change in plain words:** Journal is a private text journal — the kid writes entries, only they (and their tenant admin) can read them. Learn is a placeholder subject card UI (Maths, Reading, World Flags, Logic, Science, Creative) with a progress bar each — actual learning content is out of scope and tracked in a separate epic; this ticket just wires the UI + progress endpoint so the cards aren't empty.

**Acceptance criteria:**

- `POST /api/journal` creates an entry (text + timestamp); `GET /api/journal?memberId=` lists this kid's own entries (RLS: kid sees own only)
- `GET /api/learn/progress?memberId=` returns one row per subject with `{ certificatesEarned, certificatesTotal }`
- Learn cards render with progress bars

**Tests that break / need updating:**

- All new

---

## Cross-cutting notes

- **Shared components** (avatar disc, status pill, progress ring, day-of-week grid) should live in `packages/ui` so both the parent dashboard and ChildWorld pull from the same source.
- **Member-colour assignment** — pick a deterministic hash from `memberId → palette index` so the same kid always gets the same colour everywhere.
- **Tenant isolation** — every new endpoint goes through the same `resolveTenant` + `requireMember` middleware as the existing dashboard routes. New tables get `tenant_id` + matching RLS policies.
- **Tests-first cadence** — for each ticket, update the failing tests *before* shipping the new behaviour; the green run becomes the PR checkpoint.
- **Bug docs** — if a step uncovers a bug in shipped code (e.g. step 5 reveals an existing event-API gap), file under `bugs/<slug>.md`, promote to Jira immediately, and link the ticket back to the originating step.
