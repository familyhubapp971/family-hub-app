# 0001 — Multi-tenancy strategy

**Status:** accepted
**Date:** 2026-04-24
**Jira:** [FHS-172](https://qualicion2.atlassian.net/browse/FHS-172)

## Context

Family Hub is being transformed from a single-tenant application
(`family-hub`, currently scoped to one family with no `tenant_id` anywhere
in the schema) into a multi-tenant SaaS. Sprint 1 begins building the
tenant model, and every subsequent feature touches tenant-scoped data,
so the isolation strategy needs to be settled before the data layer
work starts.

Forces in play:

- **Operational simplicity.** A single team is bootstrapping the
  product; every additional database / schema / connection pool is
  ongoing operational cost.
- **Cost.** At 0–500 tenants, separate databases or schemas are
  prohibitively expensive per tenant.
- **Defence in depth for tenant isolation.** Application-only
  filtering (`WHERE tenant_id = ?`) leaks tenant data the moment any
  query forgets the predicate. Bugs of this shape are catastrophic
  and not noisy.
- **Performance and migration.** A schema migration must apply once,
  not per-tenant. Query plans must remain stable as the tenant table
  grows.
- **Future scale.** We may eventually have a small number of large
  enterprise tenants who require physical data separation for
  compliance.

## Decision

Use **shared database, shared schema, `tenant_id` column on every
tenant-scoped table, enforced by Postgres Row-Level Security (RLS)**.

Specifics:

- Every table that holds tenant-scoped data carries a non-nullable
  `tenant_id uuid` foreign key referencing `tenants(id)`.
- Every such table has an enabled RLS policy of the form:

  ```sql
  CREATE POLICY tenant_isolation ON <table>
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
  ```

- The application uses a non-superuser, non-`BYPASSRLS` Postgres role
  in production. RLS bypass is not available — even buggy code cannot
  cross tenants.
- Tenant context is propagated through the request via
  Node's `AsyncLocalStorage` (`apps/api/src/context/tenant.ts`):
  middleware extracts the tenant from the JWT / subdomain, opens an
  `AsyncLocalStorage` scope, sets `app.tenant_id` on the Postgres
  connection (`SET LOCAL app.tenant_id = $1`), and runs the handler
  inside the scope. All Drizzle queries within the scope inherit the
  setting transparently.
- Cross-tenant operations (admin tooling, support exports) run under a
  separate Postgres role with `BYPASSRLS` and explicit audit logging,
  not through the public API.

## Consequences

**Becomes easier:**

- One schema to migrate. One connection pool. One backup. One
  Postgres instance to size and tune.
- Defence in depth: any handler that forgets the `WHERE tenant_id`
  predicate still cannot leak data, because RLS filters at the
  storage layer.
- Onboarding a new tenant is a single `INSERT` into `tenants` plus
  whatever feature-specific seed rows are needed — no provisioning,
  no DDL, no DNS work for the tenant itself.

**Becomes harder:**

- Every query plan must be tenant-selective. We add composite indexes
  starting with `tenant_id` (e.g., `(tenant_id, created_at)`) on
  hot-path queries to keep plans efficient as the largest tenant
  grows.
- RLS adds overhead per query. Benchmarks show <5% in our profile,
  but it must be measured under load (k6 perf tests in Sprint 0).
- "Noisy neighbour" risk: a tenant running an expensive operation
  affects others on the shared instance. Mitigated by per-tenant
  rate limits and query timeouts; revisit if it becomes painful.
- Migrations that touch tenant-scoped tables must consider the
  worst-tenant data volume, not the average.
- Test fixtures must always create a tenant first; `packages/test-utils`
  provides a `withTenant()` helper to avoid boilerplate.

**Follow-up work created:**

- Add a CI check that fails if a new table is added without
  `tenant_id` and an RLS policy (or is explicitly listed as a
  global table — e.g., `tenants`, `feature_flags`).
- ADR for cross-tenant admin operations (separate role + audit log
  schema) — defer until first admin tool ships.

## Alternatives considered

### Schema-per-tenant (one Postgres schema per tenant in a shared DB)

Each tenant gets `tenant_<id>.<table>` and the application picks the
schema via `search_path` per connection.

- **Rejected because:** every migration runs N times (one per
  tenant), creating long deploy windows once N grows past a few
  hundred. Tooling (Drizzle, drizzle-kit) doesn't support this
  natively — we'd build glue. Connection pooling becomes per-schema,
  multiplying open connections. Onboarding a tenant requires DDL,
  which is slow and error-prone on a live system.
- **Re-evaluate if:** a single large enterprise tenant needs schema
  isolation for contractual / compliance reasons.

### Database-per-tenant (separate Postgres instance per tenant)

Maximum isolation; each tenant has their own database.

- **Rejected because:** infrastructure cost is per-tenant, not
  per-data-volume. Single-tenant Railway / RDS instances are
  ~$15–50/month minimum each. Operationally heavy: per-instance
  monitoring, backup, patching, schema-version drift management.
- **Re-evaluate if:** we sell to a regulated enterprise tier
  (HIPAA, FedRAMP, financial-services compliance) where physical
  separation is contractually required.

### Application-only filtering (no RLS)

Plain `WHERE tenant_id = ?` in every query, no Postgres-level
enforcement.

- **Rejected because:** a single missing predicate leaks all tenants'
  data with no audible failure. Code review and tests cannot
  reliably catch this — it's a structural bug class. RLS reduces it
  from "always possible" to "requires intentional `BYPASSRLS`."

## Exit criteria — when to revisit

Move off shared-schema + RLS toward schema-per-tenant or
database-per-tenant if **any** of:

- **Scale:** more than ~5,000 active tenants on a single Postgres
  instance, **and** vertical scaling has hit its ceiling.
- **Compliance:** we sell into a tier that contractually requires
  physical or schema-level data separation (HIPAA BAA with separation
  clause, FedRAMP, certain EU public-sector tiers, financial services
  with data-residency mandates).
- **Performance:** per-tenant query plans degrade beyond SLO at the
  P95 even with appropriate composite indexes, and the offending
  workload cannot be sharded by tenant within the shared schema.
- **Noisy neighbour:** a single large tenant's workload degrades
  smaller tenants' P95 latency and per-tenant rate-limiting / query
  timeouts cannot mitigate it.

A single trigger is sufficient grounds to open a follow-up ADR; we
don't wait for two.

## References

- [`/CLAUDE.md` Multi-tenancy section](../../CLAUDE.md#multi-tenancy)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/documents/current/ddl-rowsecurity.html)
- Source codebase: [family-hub](https://github.com/familyhubapp971/family-hub-app)
  (single-tenant precursor — schema has no `tenant_id` today; the
  SaaS port adds it everywhere)
