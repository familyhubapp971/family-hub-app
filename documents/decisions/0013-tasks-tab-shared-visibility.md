# 0013: Tasks tab: shared-to-see, private-to-edit

**Status:** accepted
**Date:** 2026-06-13
**Jira:** FHS-267

## Context

The Tasks tab (`/api/tasks`, shipped in FHS-233) was a **private** per-member
to-do list: a member could only see and mutate their own tasks, even within
the same family. The Magic Patterns redesign (FHS-267) shows **both parents'
tasks side by side**, a family task board with one column per person and a
"done / total" badge each.

That visual is incompatible with the private model: to render another parent's
column you must be able to read their tasks. So the ticket forced a choice
(roadmap `documents/design/redesign-roadmap.md`, Step 7):

- **(a)** keep tasks private, render a single column for the caller plus a
  placeholder for the other parent. Ships a watered-down version of the design.
- **(b)** make tasks visible to the whole family, render a real column per
  member. Matches the design.

## Decision

Adopt **(b)**, with a deliberate read/write split:

- **Read is family-wide.** `GET /api/tasks` returns every task in the tenant,
  each tagged with its `memberId`, plus the caller's own `callerMemberId`. The
  UI groups by member and renders a column per person with a done-count badge.
- **Write stays owner-scoped.** `POST` always assigns to the caller; `PATCH`
  and `DELETE` keep their `member_id = caller` predicate and their 404-on-
  wrong-owner shape (a member can see another's column but cannot tick off or
  delete their tasks). The UI only renders add/toggle/delete controls in the
  caller's own column.

No database migration is required: task isolation is enforced in the query
layer (explicit `WHERE tenant_id = … AND member_id = …`), not via Postgres RLS
policy objects, and the `tasks` table already carries `tenant_id` + `member_id`
with supporting indexes. Widening the read is a one-line removal of the
`member_id` predicate on the `GET` query; nothing else in the data layer
changes.

## Consequences

- **Easier:** the Tasks tab now matches Magic Patterns exactly, a shared
  family board. Parents coordinate by seeing each other's lists.
- **Harder / accepted risk:** any member who reaches the dashboard
  (`/t/:slug/dashboard`) can read every family member's task titles, including
  a teen seeing a parent's column. Accepted: Tasks is explicitly a shared
  coordination surface. The genuinely private surface, the kid Journal
  (FHS-270), stays private and is reached through the separate ChildWorld
  route.
- **Contract change:** the FHS-233 invariant "a member only ever _sees_ their
  own tasks" is narrowed to "a member only ever _mutates_ their own tasks." The
  integration suite's "GET returns only the caller's tasks" scenario flips to
  "GET returns all members' tasks"; the PATCH/DELETE-not-yours and
  cross-tenant-isolation scenarios are unchanged.
- **Follow-up:** if a future ticket needs per-task privacy (e.g. a "personal"
  flag that hides a task from the family board), it layers on top of this, the
  default stays family-visible.

## Alternatives considered

- **(a) keep private + placeholder column**, rejected: ships a design that
  doesn't match Magic Patterns and would need re-work the moment a second
  parent is active. The placeholder communicates nothing useful.
- **Tenant-visible read + admin-editable write** (admins can tick off anyone's
  task), rejected for now: adds a role branch to every write path and a more
  complex permission story for no clear product need. Owner-scoped writes keep
  the existing, well-tested 404 contract intact.
- **Real Postgres RLS policies for tasks**: out of scope: the codebase does
  not yet use DB-level RLS policy objects anywhere; introducing them only for
  `tasks` would be inconsistent. Tracked separately if/when RLS is adopted
  project-wide.
