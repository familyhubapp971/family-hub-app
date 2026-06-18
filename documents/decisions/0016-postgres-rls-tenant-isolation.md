# 0016 — Postgres RLS for tenant isolation

**Status:** proposed
**Date:** 2026-06-18
**Jira:** [FHS-344](https://qualicion2.atlassian.net/browse/FHS-344)
**Builds on:** [0001 — multi-tenancy](0001-multi-tenancy.md) (RLS deferred),
[0008 — supabase-environments](0008-supabase-environments.md)

## Plain-English summary

Today each family's data is kept apart by our own code: every query says
"only rows where `tenant_id` = this family." That works until one query
forgets the filter — then one family could see another's data. This ADR adds
a **second, deeper lock inside the database itself** (Row-Level Security,
RLS). Even if our code forgets a filter, Postgres refuses to return another
family's rows. We tell Postgres, once per web request, "this request belongs
to family X," and it enforces that on every table automatically. If we ever
fail to say which family, the database returns **zero rows** — it fails
locked, not open.

## Context

Per ADR 0001 we shipped multi-tenancy with **application-level isolation
only**: every tenant-scoped table carries `tenant_id`, and every route
hand-filters `WHERE tenant_id = $tenantId` (resolved in
`apps/api/src/middleware/resolve-tenant.ts`). RLS was deferred. That is
weak because:

- **One missed filter = a cross-tenant leak.** Isolation rests on ~27
  tables being filtered correctly at ~69 `getDb()` call sites, forever, by
  every contributor. A forgotten `.where(eq(t.tenantId, …))`, a new route,
  a raw `sql` query, or a widening JOIN silently breaks it. No backstop.
- **The DB role bypasses the DB's own protection.** `DATABASE_URL` connects
  as a privileged/owner role (effectively `BYPASSRLS`), so policies would be
  ignored even if they existed.
- **Our isolation test only proves the app filters work**
  (`tests/integration/steps/tenant-isolation.steps.ts`), not that the
  database would block an _unfiltered_ query — the exact failure we fear.

### The hard part

The DB layer is a single shared `pg.Pool` behind a `getDb()` singleton, and
**most queries run outside transactions** (only a few flows use
`db.transaction`). RLS policies read a per-connection setting
(`current_setting('app.current_tenant')`). A session-level `SET` on a
pooled connection would **leak to the next request** that reuses it — a
silent cross-tenant bug. The mechanism must pin the tenant for exactly one
request's DB work, on whatever connection it uses, with a guaranteed reset,
**without rewriting all 69 call sites**.

## Decision

Four coordinated changes:

### 1. A dedicated non-`BYPASSRLS` role (`app_runtime`)

The running app connects as `app_runtime`: no `BYPASSRLS`, not a table
owner (so RLS applies), with only CRUD on the tenant tables + `users` and
sequence `USAGE`. **Migrations keep running as the owner role** (a separate
migrate connection) — owners bypass RLS, which is correct for DDL/backfill.

### 2. GUC delivery — per-request dedicated client via AsyncLocalStorage (Option B)

- A DB middleware (after `resolveTenant`) checks out one pooled client,
  runs `select set_config('app.current_tenant', $tenantId, false)`
  (session-local to that connection — covers non-transactional queries),
  builds a request-scoped `drizzle(client)`, and runs the request inside an
  **AsyncLocalStorage** store holding it.
- `getDb()` becomes ALS-aware: inside a request it returns the request's
  client; outside (jobs/startup) it returns the root pool. **No call-site
  edits.**
- A `finally` always **resets the GUC to an empty sentinel then releases**
  the client, so a reused connection can never carry a real tenant.
- Public/tenant-less routes set the empty sentinel (no-match), never a
  stale value.

### 3. Policies — deny-by-default, equality on the GUC

For every `TENANT_SCOPED_TABLES` entry:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON <t>
  USING      (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

`USING` filters reads + the visible side of update/delete; `WITH CHECK`
rejects writes into another tenant. `current_setting(…, true)` returns NULL
when unset → comparison fails → **zero rows / rejected write** (fail
closed). Only this policy exists, so everything else is denied by default.

### 4. The global `users` table

`users` is not tenant-scoped; it gets a **self-scoped** policy on a second
GUC `app.current_user` (`id = current_setting('app.current_user', true)::uuid`).
The user-mirror lazy upsert (which precedes tenant context) sets
`app.current_user` to the new id first so it can run as `app_runtime`.

### Fail-closed contract

Missing GUC (middleware bug, background job, route mounted before the DB
middleware) → NULL → every comparison fails → zero rows, every write
rejected. A page may render empty (visible, debuggable) but **data never
leaks**. We assert this in tests.

### App-level filters STAY

The existing `WHERE tenant_id = …` filters remain as defence-in-depth and
for query ergonomics. RLS is the floor; app filters are the first line.
ADR 0001's isolation is **augmented, not replaced**.

## Consequences

- **Easier:** a forgotten filter can no longer leak; isolation becomes a
  schema property provable in one place; new tables get protection by a
  one-line policy + the existing registry-audit test.
- **Harder / cost:** one extra connection checkout + two tiny `set_config`
  round-trips per request; a slow request now pins a connection for its
  lifetime (may need a higher pool `max`); a new "empty page when GUC
  unset" failure surface (mitigated by logging + a boot guard).
- **Perf:** policy is an equality on the already-indexed `tenant_id`; the
  cost is the per-request connection pin, not policy evaluation. Validate
  p95 read < 250ms / write < 500ms holds post-flip (k6 smoke).

## Pooler caveat (Supabase / Railway)

Session-local GUCs do **not** survive a transaction-mode pooler (e.g.
Supabase port 6543). `app_runtime` MUST connect on the **session-mode**
port (Supabase 5432 / session pooler) so a connection is exclusively ours
for the request. Contingency if only transaction-mode is available: switch
to transaction-local (`set_config(…, true)`) and wrap each request's DB
work in a transaction (a controlled form of the rejected Option A). The
migrate role uses the direct port.

## Alternatives considered

- **(A) Wrap every request in a transaction with `SET LOCAL`.** Rejected —
  forces all reads into transactions and still needs ALS/threading; the
  dedicated-client reset gives the same safety without the cost.
- **(B) Per-request dedicated client + `set_config(…,false)` + reset, via
  AsyncLocalStorage.** **Chosen** — no call-site rewrites, covers
  non-transactional queries, no leak (connection never shared while pinned).
- **(C) Supabase JWT-claim RLS (`auth.jwt()`).** Rejected for the API path —
  built for clients hitting PostgREST directly; our traffic goes through our
  Hono server over a shared pool with one role. We reuse its spirit (limited
  role + per-request setting) but deliver the setting ourselves.
- **(D) Session `SET` on the shared pool / transaction-pooler.** Rejected —
  leaks across reused connections; transaction poolers discard session GUCs.

## Rollout

Create the role → enable+force RLS + policies on all tables **while still
connected as owner** (no prod impact, owner bypasses) → prove on staging →
**flip `DATABASE_URL` to `app_runtime` in one deploy** (instant rollback =
revert the env var). Add a boot guard that refuses to start if the connected
role has `BYPASSRLS`, and a test that runs **as `app_runtime`** with no app
filter and asserts only the current tenant's rows return (and zero rows when
no GUC).

## Implementation notes (as built — FHS-344 epic)

Two refinements emerged during build that the original draft above doesn't
capture:

- **Migration delivery.** Staging/prod boot with `drizzle-kit push --force`
  (schema-diff), which knows nothing about roles/RLS/policies/grants and would
  silently skip them — and can drop a table's grants when it recreates it. So
  RLS is delivered as **hand-written idempotent SQL migrations** (`0027` role +
  grants, `0028` tenant policies, `0029` users policy), NOT via schema.ts
  `pgPolicy`. They reach the test/CI DBs via `drizzle-kit migrate`; they reach
  staging via a dedicated **`apply-rls` step** in `start.sh` (run as the owner,
  after `push`, gated by `APPLY_RLS`). DDL/grants run as the owner via
  `MIGRATE_DATABASE_URL`; the app serves traffic as `app_runtime` via
  `DATABASE_URL`.
- **Fail-closed GUC readers.** Policies key on `app_current_tenant()` /
  `app_current_user()` — `STABLE` SQL functions that **regex-gate** the GUC
  before the `::uuid` cast, so unset, the empty sentinel, OR a malformed value
  all map to `NULL` (zero rows / rejected writes) and the cast can never raise a 500. `set_config(..., false)` (session) for the request middleware;
  `set_config(..., true)` (transaction-local) for pre-tenant writes (the
  user-mirror upsert, onboarding's founding member).
- **Pre-tenant write paths.** Writes that run before a tenant is resolved must
  pin the target tenant transaction-locally first, or RLS rejects them.
  Onboarding (founding member) is fixed (FHS-351); the invite-claim flow reads
  invites cross-tenant by email and needs a `SECURITY DEFINER` lookup —
  tracked as a pre-flip blocker (FHS-354).

## Flip runbook (FHS-351)

The code is flip-ready and merged; flipping is a deploy-only operation:

1. **Provision the role password + CONNECT** on the staging DB (as the owner):
   `ALTER ROLE app_runtime WITH LOGIN PASSWORD '<secret>';` then verify
   `SELECT has_database_privilege('app_runtime', current_database(), 'CONNECT');`
   — if false (Supabase revokes CONNECT from PUBLIC), run
   `GRANT CONNECT ON DATABASE <dbname> TO app_runtime;`. Store the secret; never
   commit it.
2. **Set Railway staging env** (api service): `MIGRATE_DATABASE_URL=<owner URL>`
   (the current `DATABASE_URL`), then `DATABASE_URL=<app_runtime URL>`,
   `APPLY_RLS=true`, `RLS_ENFORCED=true`. **The `app_runtime` URL MUST use the
   session-mode port** (Supabase **5432**, not the transaction pooler 6543) —
   `postgresql://app_runtime:<pw>@<host>:5432/<dbname>` — or session GUCs leak
   between requests (the boot guard would still pass, so this is silent: verify
   the port by hand).
3. **Deploy.** `start.sh` runs `push` + `apply-rls` as the owner, then the app
   boots as `app_runtime`; the boot guard verifies it cannot bypass RLS.
4. **Validate** staging E2E + perf smoke.
5. **Rollback** (if needed): revert `DATABASE_URL` to the owner + unset
   `RLS_ENFORCED` — one env change, instant.

> Pre-flip blocker: FHS-354 (invite-claim RLS-readiness) must land first.
