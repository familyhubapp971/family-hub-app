# 0015 — Role model: `is_owner` flag over roles

**Status:** accepted
**Date:** 2026-06-16
**Jira:** [FHS-333](https://qualicion2.atlassian.net/browse/FHS-333)

## Context

[ADR 0009](0009-family-membership-model.md) gave us one `members` table with
a `role` enum (implemented as `admin | adult | teen | child | guest`) and
deferred "roles, permissions, and additional relationships" to later sprints.
Permission today is a single blunt rule used across the API:

```
canManage = caller is the member themselves OR role === 'admin' OR role === 'adult'
```

In the **legacy single-user app** only the one account holder ("admin") could
edit a habit sticker on a **previous day** (backdate history). Everyone else
was a normal user. Now that Family Hub is multi-tenant and a family can have
**several** `admin`/`adult` members, that privilege has leaked — any admin or
adult can rewrite a past day's stickers (the only date guard is "no future
days"). We need to re-introduce a single top authority tier **without**
re-architecting the role enum or every check that reads it.

Forces:

- **Minimise blast radius.** The role enum and `is_child` flag are referenced
  widely; a new role value would make `owner` and `admin`/`adult` mutually
  exclusive and force revisiting every check.
- **Multiple owners.** A family may want two parents to both hold the top
  tier; the model must allow more than one.
- **No token churn.** Role and tenant are resolved per-request from the DB
  `members` row in the tenant-resolution middleware — the Supabase JWT only
  carries `sub`. The new authority signal should ride the same path.
- **Security-sensitive boundary.** The owner-only set is the line between
  "run the family day-to-day" and "rewrite history / take irreversible
  actions". It must be unambiguous and enforced server-side.

## Decision

Add a boolean **`is_owner`** flag on `members` (default `false`), layered on
top of the existing roles — **not** a new role enum value. The family
**registrant is flagged `is_owner = true`**; more owners can be granted.
Roles (`admin | adult | teen | child | guest`) are unchanged.

- **Owner = a flag, not a role.** An owner is always also an admin/adult in
  role terms and inherits every admin power, **plus** the owner-only set.
- **Owner-only actions** (sensitive, historical, irreversible): edit a
  **past-day** sticker; re-open a finalized week; change sticker→cash /
  reward conversion rates and economy settings; manually adjust a balance;
  promote/demote owners and admins; transfer ownership; remove a member;
  wipe/delete the family; manage billing.
- **Admins keep everyday management:** invite members, set/reset child PINs,
  log/edit the **current** week's stickers, run the rewards shop, edit
  meals/calendar/assignments/noticeboard/tasks.
- **`is_owner` resolves from the DB row** (same path as `role`) and is
  exposed on `/api/me`; no JWT change.
- **Last-owner invariant:** a family can never reach zero owners — enforced
  transactionally (self-demotion / transfer must leave ≥1 owner).

The full Owner/Admin/Adult/Teen/Child rights matrix lives in
[`documents/features/role-permissions.md`](../features/role-permissions.md).

## Consequences

Easier:

- No enum migration, no token re-issue — one nullable-free boolean column +
  a one-time backfill (earliest-created admin per tenant becomes owner).
- The owner tier is additive; existing admin/adult behaviour is unchanged
  except where an action is explicitly moved to owner-only.

Harder / follow-ups (epic FHS-333):

- `is_owner` must be threaded through middleware, `/api/me`, and the UI
  (owner-only controls hidden for non-owners — server gate is the real
  boundary). The scattered `canManage`/`isAdminOrAdult` checks should be
  consolidated into one shared permission module (FHS-339).
- RLS should enforce the boundary as defence-in-depth.
- A handful of placements are **open questions** (see the feature doc):
  manual balance-adjust owner-vs-admin, and billing owner-vs-billing-admin.
  Both default to **owner-only** until confirmed.

## Alternatives considered

- **New `owner` role in the enum** — rejected: a member holds one role, so
  `owner` would be mutually exclusive with `admin`/`adult`, forcing a rewrite
  of every role check and losing the "owner is also an admin" inheritance.
- **Custom per-family permission editing** — rejected for v1: families
  inventing their own roles is far more than the problem needs; a fixed
  matrix is clearer and safer.
- **Keep the single blunt `canManage`** — rejected: it's exactly what leaked
  the backdating privilege; the gap is real.
