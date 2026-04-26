# 0007 — Reuse the family-hub stack

**Status:** accepted
**Date:** 2026-04-24
**Jira:** [FHS-154](https://qualicion2.atlassian.net/browse/FHS-154)

## Context

Sprint 0 is a one-shot. The legacy `family-hub` codebase has been
running in production for months on a stack that's already been
debugged, optimized, and shipped. Re-evaluating each library now
would cost weeks of comparison spikes for marginal benefit.

## Decision

**Reuse the family-hub stack verbatim where possible.** No
greenfield library selection in Sprint 0.

| Concern | Library | Why kept |
| --- | --- | --- |
| API framework | **Hono** | Tiny, fast, Web-API-native; works on Node + edge |
| ORM | **Drizzle** | Type-safe SQL, RLS-friendly, no runtime overhead |
| Schema validation | **Zod** | Already wired to Hono via `@hono/zod-validator`; same schemas reused on the web |
| Logging | **pino** | Structured JSON, low overhead, child-logger pattern |
| Frontend framework | **React 18** | Largest ecosystem; aligns with the `family-hub` UI codebase |
| Frontend tooling | **Vite** | Fast dev server, native ESM, Tailwind-friendly |
| Styling | **Tailwind 3** | Utility-first; family-hub design tokens port verbatim ([FHS-199](https://qualicion2.atlassian.net/browse/FHS-199)) |
| Unit testing | **Vitest** | Same Vite pipeline; instant cold start |
| E2E testing | **Playwright + playwright-bdd** | Gherkin traceability to `docs/features/` per the [E2E rules in CLAUDE.md](../../CLAUDE.md) |
| Performance | **k6** | SLO-driven load / stress / soak; per-tenant VU groups |
| Hosting | **Railway** | Zero-config Postgres + service deploys |
| Auth | **Supabase Auth** | Per [ADR 0003](0003-auth-library.md) — chose this over better-auth |
| Billing | **Stripe** | Per [ADR 0004](0004-stripe-billing.md) |
| Package manager | **pnpm 10** | Workspace primitives; strict mode enforces package boundaries |

The two surfaces that **diverge** from family-hub are written down in
their own ADRs:

- Multi-tenancy: shared schema + `tenant_id` + RLS — [ADR 0001](0001-multi-tenancy.md)
- Subdomain routing: `<slug>.familyhub.app` via middleware — [ADR 0002](0002-subdomain-tenant-routing.md)

## Consequences

**Easier:** Sprint 0 stays focused on multi-tenancy + scaffold, not
library shopping. The team's muscle memory transfers. Existing
patterns (request logging shape, Drizzle query style, Tailwind theme
extensions) port verbatim — see [ADR 0005](0005-monorepo-structure.md)
for layout.

**Harder:** any item on the list that turns out to be a poor fit at
scale costs more to swap because we've assumed it. Mitigation: this
ADR is **revisitable** — write a superseding ADR when a specific
library becomes a real bottleneck (cite the metric). Don't re-litigate
the whole stack at once.

## Alternatives considered

- **Greenfield evaluation per concern.** Rejected: weeks of spikes
  with no customer-facing value. Sprint 0's job is to ship a tenant
  vertical slice, not to bikeshed.
- **Mix-and-match (keep some, replace others).** Rejected for now:
  a partial swap incurs migration cost without de-risking anything.
  Specific swaps land via their own ADRs (see [ADR 0003](0003-auth-library.md)
  and [ADR 0004](0004-stripe-billing.md), which intentionally
  diverge for documented reasons).

## Re-evaluate when

A specific library hits a measurable failure mode:

- Hono — request throughput we can't tune past Railway's quota.
- Drizzle — query patterns the codegen can't express cleanly.
- pino — structured-log cardinality blowing past our log budget.
- Vite / Vitest — cold-start times >5s per test file at scale.
- Tailwind — design-system needs CSS-in-JS primitives only available elsewhere.

Each is its own ADR when triggered. Don't supersede this whole document —
swap the row, link the new ADR.
