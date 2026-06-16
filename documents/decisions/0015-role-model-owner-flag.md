# 0015 — Role model: admin vs normal user (multi-tenant)

**Status:** accepted
**Date:** 2026-06-16
**Jira:** [FHS-333](https://qualicion2.atlassian.net/browse/FHS-333)

> **Note:** an earlier draft of this ADR proposed a separate `is_owner`
> "super user" flag layered on top of roles. It was simplified — before any
> implementation — to the two-tier admin/normal model below, which mirrors
> the legacy app. The file name keeps the original slug for link stability.

## Context

[ADR 0009](0009-family-membership-model.md) gave us one `members` table with
a `role` enum (implemented as `admin | adult | teen | child | guest`) and
deferred "roles, permissions, and additional relationships" to later sprints.
Permission today is a single blunt rule used across the API:

```text
canManage = caller is the member themselves OR role === 'admin' OR role === 'adult'
```

In the **legacy single-user app** there were two kinds of grown-up: the one
**admin** (the account holder, full rights — including editing a habit sticker
on a **previous day**) and everyone else, a **normal user**. Multi-tenancy
broke that cleanly-drawn line two ways:

- The blunt rule grants the elevated rights to **any** `admin` _or_ `adult`,
  so a non-admin adult can now do admin-only things (most visibly, backdate a
  past-day sticker — the named gap).
- There was no concept of "the person who set up this family" or a way for
  them to decide who else is an admin.

We want the legacy behaviour back, expressed in the tenancy world, **without**
inventing extra tiers.

## Decision

Two grown-up permission tiers, mapped onto the existing role enum — **no new
column, no new role value**:

- **Admin** (`role = 'admin'`) — full legacy-admin rights. Multiple admins
  allowed. The family **registrant is an admin** (already set at tenant
  creation). Admin-only actions: edit a **past-day** sticker, close/re-open a
  week, change economy settings + sticker→cash/reward conversion rates,
  manually adjust a balance, manage members (invite, PIN, edit profile,
  change role), **make another member an admin or a normal user**, remove a
  member, wipe/delete the family, and billing.
- **Normal user** (`role = 'adult'`, i.e. an adult who isn't an admin) —
  legacy normal-user rights: everyday **current-day** actions (log/edit this
  week's stickers), shared content (meals, calendar, assignments,
  noticeboard, tasks), and their own data. **Not** the admin-only set above.
- **Kids** (`role = 'teen' | 'child'`) — unchanged; scoped to their own data.
  A child can **never** be made an admin.

Mechanics:

- An admin can promote any **non-child** member to `admin`, or set them back
  to a normal user (`adult`). Promoting a child/teen to admin is blocked.
- The elevated checks change from `admin OR adult` to **`admin` only**;
  everyday/current-day and shared-content actions stay open to normal users.
- Role resolves per-request from the DB `members` row (same as today); the
  Supabase JWT only carries `sub`, so there is **no token change**.

The full Admin / Normal user / Teen / Child rights matrix lives in
[`documents/features/role-permissions.md`](../features/role-permissions.md).

## Consequences

Easier:

- No schema migration and no new flag — it's a permission-check change plus a
  member-management action. The registrant is already an admin.
- Matches the legacy mental model exactly; one fewer concept than an owner
  tier.

Harder / follow-ups (epic FHS-333):

- The scattered `canManage` / `isAdminOrAdult` checks must be consolidated
  into one shared **`isAdmin`** check and the admin-only set must drop
  `adult` (FHS-336).
- The UI must hide admin-only controls from normal users (server gate is the
  real boundary).
- A child/teen must never be able to escalate to admin; RLS should back the
  boundary as defence-in-depth (FHS-336).

## Alternatives considered

- **Separate `is_owner` "super user" tier** (the earlier draft) — rejected as
  over-complicated: it added a third grown-up tier the legacy app never had,
  with last-owner-protection edge cases, for no clear product need.
- **New `owner`/`normal` role enum values** — rejected: `adult` already
  serves as "non-admin grown-up"; adding values churns every role check for
  no behaviour gain.
- **Keep the single blunt `admin OR adult` rule** — rejected: it is exactly
  what leaked the backdating privilege to non-admin adults.
