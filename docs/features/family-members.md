# Feature: Family members

**Jira:** TBD (Sprint 1 — Tenant Foundation, expected under [FHS-1](https://qualicion2.atlassian.net/browse/FHS-1) / [FHS-12](https://qualicion2.atlassian.net/browse/FHS-12))
**Status:** draft (informs Sprint 1 schema design; no code yet)
**Owner:** product-manager

The model for "who is in this family". Captures parents, children, and
other adults living in the household (grandparents, nannies, guardians).
Designed up-front to handle real-world family shapes that single-child
schemas trip over: twins, triplets, blended families, multi-generational
households.

This doc exists _before_ the Sprint 1 schema work to lock in the shape
the data model has to support. The implementation lives under FHS-1
(epic) once Sprint 1 starts.

## User stories

### Story 1: Add a family member

**As a** parent (signed-in account holder)
**I want to** add a person to my family — child, partner, parent,
guardian, or helper
**so that** the rest of the app (tasks, calendar, milestones) can
reference them.

#### Acceptance criteria

**Scenario: Parent adds a child with a unique name**

- **Given** I am signed in and on my family's setup page
- **When** I add a child named "Aisha" with date of birth 2020-03-12
- **Then** Aisha appears in my family roster
- **And** her role is "child"
- **And** her record has its own stable id (not derived from name + birthday)

**Scenario: Parent adds a second adult to the household**

- **Given** I am signed in
- **When** I add my partner with their email
- **And** I assign the role "parent"
- **Then** they receive an invite to claim a Supabase login
- **And** until they accept, their row exists with `auth_user_id = NULL`

**Scenario: Parent adds a non-parent adult**

- **Given** I am signed in
- **When** I add a household member with role "guardian" (e.g. nanny, grandparent)
- **Then** the member appears with the correct role label
- **And** their permissions are scoped per the role's defaults (Sprint 2)

### Story 2: Add twins, triplets, or higher-order multiples

**As a** parent of twins (or triplets, etc.)
**I want to** add each child as their own person with the same date of
birth and similar names
**so that** I can assign tasks, log milestones, and see schedules per
individual without the system collapsing them into one row.

#### Acceptance criteria

**Scenario: Parent adds twins born on the same day**

- **Given** I am signed in
- **When** I add "Bilal" with date of birth 2022-08-01
- **And** I add "Bashir" with date of birth 2022-08-01
- **Then** both children appear as separate rows in the roster
- **And** the system does **not** flag a duplicate-birthday error
- **And** each has their own stable id

**Scenario: Parent records birth order for twins**

- **Given** I have just added Bilal and Bashir
- **When** I mark Bilal as "first-born" and Bashir as "second-born"
- **Then** the system records `birth_rank: 1` for Bilal and `birth_rank: 2` for Bashir
- **And** the family roster shows them in birth-order
- **And** the `birth_rank` field is optional (cultures where it doesn't
  matter can leave it null)

**Scenario: Parent groups a set of multiples**

- **Given** I have added triplets — Sara, Mira, Lina (all born 2021-05-04)
- **When** I mark them as a multiple-birth set
- **Then** they share a `multiple_birth_group_id`
- **And** the family timeline can render their first-birthday as a single
  shared event ("Sara, Mira, Lina turn 1")
- **And** I can still address each child individually for tasks and milestones

**Scenario: Parent adds children with the same first name**

- **Given** I have a child named "Mohammed" already
- **When** I add another child also named "Mohammed" (e.g. step-child
  joining a blended family)
- **Then** the system accepts the addition without error
- **And** the UI disambiguates them by `display_name` (e.g. "Mohammed
  (Sr)" / "Mohammed (Jr)") or by a parent-supplied nickname
- **And** task assignments to "Mohammed" surface a picker — never a silent
  guess

### Story 3: Blended and multi-generational families

**As a** parent in a blended family (step-children, foster, joint
custody)
**I want** the membership model to recognise relationships beyond
"biological child of two parents"
**so that** my real household shape can be represented without forcing
fictional parentage.

#### Acceptance criteria

**Scenario: Family has more than two parents**

- **Given** the family has my partner and me, plus a co-parent from a
  previous relationship who shares custody
- **When** the co-parent is added with role "parent"
- **Then** the family supports three parent rows without a "max two
  parents" constraint
- **And** all three parents see the same shared roster, calendar, tasks
  (the per-role visibility rules land in Sprint 2)

**Scenario: Grandparent lives in the household**

- **Given** my mother lives with us and helps with the kids
- **When** I add her with role "guardian" (or future role "grandparent")
- **Then** she appears in the roster with that role
- **And** she can be assigned to tasks (e.g. "school pickup") just like
  any other adult

**Scenario: Step-child has their own auth account, joins multiple families**

- **Given** my partner's child has their own Supabase login
- **And** they are also a member of their other parent's family
- **When** I add them to my family with role "child"
- **Then** the same `auth.users` row references two `family_members`
  rows (one per family) — Sprint 2 multi-family support
- **And** in _my_ family, they show up under my roster
- **And** in their other parent's family, they show up there too

### Story 4: Children gain their own login as they grow

**As a** child who has reached an age where I can have my own account
**I want to** claim my place in my family without my parent having to
recreate my history
**so that** task history, milestones, and references to me persist
through the transition.

#### Acceptance criteria

**Scenario: Child claims their auth account**

- **Given** I am a child whose parent created my row at age 4 (no login)
- **When** I am old enough and my parent invites me to claim a login
- **Then** I sign up via Supabase with my email
- **And** the existing `family_members` row gets `auth_user_id` populated
- **And** every historical task, milestone, photo previously assigned to
  me remains attached to the same id (no dangling references)

## Out of scope

- **Schema implementation** — lives under FHS-1 (Tenant Foundation
  epic) when Sprint 1 starts. This doc only constrains what the schema
  must support.
- **Per-role permissions** — task visibility, calendar editing rights,
  who can invite a new member — Sprint 2.
- **Custody / legal flags** — court-ordered visitation calendars,
  restricted-access flags. Backlog; needs legal review before design.
- **Pets** — out of scope for the foundation. Could be added as a `role`
  later if user research surfaces strong demand.

## Open questions

- **Role taxonomy.** Starting set: `parent` / `child` / `guardian` /
  `other`. Do we need `grandparent` as a distinct role, or is
  `guardian` enough? Decide in Sprint 1 schema review.
- **Birth rank presentation.** Some cultures (East Asian, Middle Eastern,
  African) assign meaningful seniority to birth order; others don't.
  Default UI: hide `birth_rank` unless the family explicitly enables
  it. Confirm during user research.
- **Display-name vs legal-name.** Probably split — legal_name for
  records (school, healthcare integrations later), display_name for
  the app UI. Validate with a few real families before locking the
  field shape.
- **Identity continuity across families.** A step-child who exists in
  two families: does the app surface that to the parent (e.g. "this
  child also has a calendar in their other parent's family")? Privacy
  question — answer in Sprint 2 alongside multi-family work.

## Success metrics

- **Coverage:** >= 95 % of beta households can model their real
  composition without a workaround (post-Sprint 2 user survey).
- **No data loss on transitions:** when a child claims an auth login,
  100 % of pre-existing assignments / milestones / photos remain
  attached.
- **Twin/triplet error rate:** zero "duplicate child" errors reported
  by twin/triplet families in their first 30 days.
- **Blended-family adoption:** at least 10 % of paying customers in
  Year 1 self-identify as blended/multi-generational households —
  proves the model isn't just nuclear-family-coded.

## Implementation notes for Sprint 1 schema design

These are non-binding hints to the dev who designs the actual tables:

- **One table for everyone.** A single `family_members` table — rows
  for parents, children, guardians, others — keyed on a UUID, with a
  `role` enum and an optional `auth_user_id` foreign key. Avoid a
  separate `children` table; that path makes joins worse and forces
  awkward migrations when a child grows up and gets a login.

- **No accidentally-unique constraints.** Specifically:

  - `(family_id, first_name)` should NOT be unique — twins, blended families.
  - `(family_id, date_of_birth)` should NOT be unique — twins, triplets.
  - `(family_id, last_name)` should NOT be unique — single-parent + biological-father separate surnames.

- **Optional disambiguators.** Add nullable `birth_rank: int` and
  `multiple_birth_group_id: uuid` for the twins/triplets cases. Both
  default to NULL so they don't clutter single-child families.

- **Per-tenant RLS.** Inherits from ADR 0001 — every row carries
  `tenant_id` (a.k.a. `family_id`); RLS policies prevent cross-family
  reads. The user-mirror `users` table stays global (a single auth
  identity belongs to multiple families).
