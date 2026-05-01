# 0009 — Family membership model

**Status:** accepted
**Date:** 2026-04-30
**Jira:** TBD (decision lands ahead of Sprint 1 schema work in epic [FHS-1](https://qualicion2.atlassian.net/browse/FHS-1))

## Context

Sprint 1 will land the first family-scoped tables. Before the schema is
written, we need to lock in the model for "who is in a family" — which
ends up touching nearly every other table (tasks, calendar, milestones,
photos, billing).

The tempting naive shape is two tables: a `users` table for parents who
sign in, and a `children` table for everyone else. That falls apart on
any non-nuclear-family case:

- **Twins, triplets, multiples** — same surname, same date of birth,
  often similar first names. A `(family_id, name, date_of_birth)`-based
  uniqueness assumption rejects legitimate sibling sets.
- **Children growing into auth users** — a `children` table that lacks
  an `auth_user_id` column means migrating a child to an account holder
  is a row-move + reference-rewrite (every assignment, every milestone,
  every photo). With one table the migration is `UPDATE
family_members SET auth_user_id = ? WHERE id = ?`.
- **Blended families** — step-children, foster, joint custody, three or
  four parents across multiple households. A "max two parents" baked
  into the schema makes these cases either invalid or modelled as
  fiction.
- **Multi-generational households** — grandparents, nannies, helpers
  who aren't parents but also aren't children. They need to be
  assignable to tasks just like adults.
- **Same-name siblings** — culturally common (e.g. Mohammed Sr / Jr,
  step-siblings sharing a name). Uniqueness on `(family_id,
first_name)` rejects them.

[`documents/features/family-members.md`](../features/family-members.md)
captures the user-facing scenarios this decision has to support.

Forces in play:

- **Real-world coverage.** The product positioning targets diverse
  family shapes globally — twins/triplets are statistically rare but
  emotionally critical for those families; blended/multi-generational
  is common in many of our target markets.
- **Schema simplicity.** Two tables (`users` + `children`) feels
  natural at first but inflicts a permanent join tax and migration pain
  on every cross-cutting feature.
- **Identity continuity.** When a child gains a login, every reference
  to them — task history, calendar, milestones, photos — must persist.
  The id has to outlive the auth-status transition.
- **Per-tenant isolation.** Inherits from
  [ADR 0001](0001-multi-tenancy.md): every row carries `tenant_id`
  (a.k.a. `family_id`), guarded by RLS.
- **Speed of evolution.** Sprint 1 is foundational; we'll add roles,
  permissions, and additional relationships in Sprint 2+. The membership
  table needs to be flexible without being a god table.

## Decision

A **single `family_members` table** is the canonical "person in a
family" model. Every individual associated with a family — parents,
children, guardians, step-relatives — gets one row.

Required columns:

- `id: uuid PRIMARY KEY` — stable, app-controlled identity.
  Every other table that references "a person" foreign-keys this.
- `tenant_id: uuid NOT NULL` (a.k.a. `family_id`) — the family this row
  belongs to; enforced by RLS per ADR 0001.
- `role: enum NOT NULL` — `parent | child | guardian | other`.
  Constrained list; widen via migration when a new role becomes
  load-bearing (e.g. `grandparent` if user research justifies the
  split).
- `auth_user_id: uuid NULL REFERENCES public.users(id)` — set when the
  member has their own Supabase login; NULL for under-age children
  without an account yet. The transition from NULL → set is a single
  `UPDATE`, with no downstream id changes.
- `display_name: text NOT NULL` — what the app shows in lists, picker
  dropdowns, task assignments. Parent-supplied; can be a nickname.
- `legal_name: text NULL` — separate from display_name for future
  integrations (school records, healthcare). Optional in Sprint 1.
- `date_of_birth: date NULL` — optional. NOT unique-per-family; twins
  share it.
- `birth_rank: int NULL` — optional. 1 = first-born, 2 = second, ….
  Used for cultures where birth order matters; null otherwise.
- `multiple_birth_group_id: uuid NULL` — optional. Twins/triplets/etc.
  share this id; lets the timeline group their shared birthdays.
- `created_at`, `updated_at`, `deleted_at` — soft-delete by default so
  history doesn't break when a member is removed (e.g. estranged
  step-child, deceased grandparent — preserve the references but hide
  the row from active rosters).

**Indexes / constraints:**

- `(tenant_id, id)` is the natural lookup key for tenant-scoped queries.
- **No uniqueness constraints** on
  `(tenant_id, first_name)`,
  `(tenant_id, date_of_birth)`,
  `(tenant_id, last_name)`. All three legitimately collide for
  twins/triplets and blended families.
- **One uniqueness constraint:** `(tenant_id, auth_user_id) WHERE
auth_user_id IS NOT NULL` — a Supabase-authenticated identity can
  only appear once per family (but the SAME `auth_user_id` may appear
  in multiple families, e.g. a step-child whose login spans two
  households).

**Cross-cutting consequences:**

- Tasks, calendar events, milestones, photos that target a person
  reference `family_members.id`, NOT `auth.users.id`. Children who
  don't have logins yet are still first-class subjects.
- The existing `users` mirror table (created in FHS-192) stays as the
  global identity registry — one row per Supabase auth user, regardless
  of how many families they belong to. `family_members.auth_user_id`
  joins to it.
- Multi-family membership (a single auth identity in two families) is
  trivially representable: two `family_members` rows, same
  `auth_user_id`, different `tenant_id`. Sprint 2 surfaces this in the
  UI; the schema supports it from day one.

## Consequences

**Easier:**

- One table, one set of RLS policies, one set of indexes for "who is
  in a family". Every cross-cutting feature foreign-keys one place.
- Children growing into auth users is a single-row update. No
  reference rewrites.
- Twins, triplets, same-name siblings, blended families all model
  without workarounds.
- Multi-family membership for blended-family children is free.
- Pets, future role additions ("grandparent", "babysitter") become
  enum widenings, not new tables.

**Harder:**

- Queries asking "all parents in this family" must filter by `role =
'parent'` rather than `SELECT * FROM parents`. Trivially fast with a
  composite index `(tenant_id, role)`; just slightly more verbose.
- The `role` enum becomes a small migration footgun — adding a new
  value requires the standard "add value, deploy, then drop old check
  constraint" Postgres dance. Acceptable; happens rarely.
- A god-table risk if we keep stuffing fields onto `family_members`.
  Mitigation: anything role-specific (e.g. parental email-notification
  preferences) lives in a sibling table keyed on `family_member_id`,
  not on the membership row itself.

## Alternatives considered

- **Separate `users` and `children` tables.** Rejected — see Context.
  Permanent join tax, painful child→auth-user migration, awkward
  representations for guardians and grandparents.

- **Single `people` table at the global level (no `tenant_id`), plus a
  `family_memberships` join table.** Stronger normalisation: one
  identity row per real-world person across every family they belong
  to. Rejected for Sprint 1: the JOIN-tax cost on every read is
  permanent, while the cases this elegance solves (multi-family
  members) are uncommon and addressable in Sprint 2 by allowing the
  same `auth_user_id` to appear in multiple `family_members` rows. Can
  re-evaluate when concrete pain shows up.

- **Polymorphic `entity` table with a `type` discriminator.** Rejected
  — adds complexity (type-specific JOINs, optional columns enforced in
  app code rather than schema) without the flexibility we'd actually
  use.

- **Per-role tables (`parents`, `children`, `guardians`).** Strictly
  worse than the two-table version: every cross-role feature needs
  three-way UNION ALLs. Rejected without hesitation.
