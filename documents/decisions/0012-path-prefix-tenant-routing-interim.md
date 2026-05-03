# 0012 — Path-prefix tenant routing as interim

**Status:** accepted
**Date:** 2026-05-03
**Jira:** [FHS-249](https://qualicion2.atlassian.net/browse/FHS-249) (also covers [FHS-13](https://qualicion2.atlassian.net/browse/FHS-13))
**Amends:** [ADR 0002 — Subdomain tenant routing](0002-subdomain-tenant-routing.md)

## Context

[ADR 0002](0002-subdomain-tenant-routing.md) settled tenant resolution
on **subdomains**: `khans.familyhub.app` → `tenants.slug = 'khans'` →
`tenant_id`. That ADR explicitly rejected path-prefix routing on the
grounds that messy URLs and unscoped cookies/CORS hurt the long-term UX.

We agree with that _long-term_ — but we don't own a real domain yet.
Today the staging app is at `frontend-staging-409d.up.railway.app` and
the production app is parked. Without a domain, subdomain routing has
no slug to consume; users would have nowhere to go.

We need an **interim** routing mechanism so the multi-tenant codebase
can be exercised end-to-end (signup → tenant landing → dashboard) on
the Railway-issued URLs we already have.

## Decision

**Resolve tenant from one of three sources, in precedence order:**

1. **JWT custom claim** — `payload.app_metadata.tenant_slug`. Fastest
   path: no DB lookup needed beyond the slug → id resolution. Set by
   a Supabase auth hook in a future ticket; today this source is a
   no-op for most users.
2. **Subdomain** — `Host: <slug>.<BASE_DOMAIN>`. Matches the original
   ADR 0002 mechanism. **Skipped when `BASE_DOMAIN` is `localhost`**
   (local dev never has subdomains).
3. **Path prefix** — request path begins with `/t/<slug>/`. The
   interim source. Once `BASE_DOMAIN` flips from a Railway domain to
   `familyhub.app` (or whatever we end up owning), source 2 starts
   firing for real traffic and source 3 quietly becomes the fallback.

The middleware that implements this is
[`apps/api/src/middleware/resolve-tenant.ts`](../../apps/api/src/middleware/resolve-tenant.ts).
It runs after `authMiddleware` so the JWT-claim source can read the
verified payload.

The web app mounts tenant-scoped pages under `/t/:slug/*`. A
`<TenantProvider>` reads the slug param once at the top of the
subtree and exposes it to descendants via `useTenantSlug()`.

## Consequences

**Becomes easier:**

- We can exercise the full multi-tenant flow on the Railway domain
  today, no DNS work required.
- Same code path also handles a future world where each tenant uses
  a custom domain via JWT custom claims (the auth-hook source is
  already wired).

**Becomes harder:**

- Two URL conventions exist simultaneously (`khans.familyhub.app/...`
  vs `familyhub.app/t/khans/...`). All client code that builds a
  tenant URL must use a helper rather than string-concatenating; the
  helper picks the active form based on whether `BASE_DOMAIN` is set
  to a real domain.
- Cookies cannot be subdomain-scoped while we're on a single-domain
  Railway URL — anything we set ends up shared across the whole app.
  Mitigation: don't put per-tenant secrets in cookies during the
  interim window; rely on JWT claims and per-request RLS.
- Reserved-subdomain checks (`www`, `api`, …) only matter once
  source 2 is live, so adding new reserved names today has no effect
  but should still be documented for the cutover.

## Alternatives considered

- **Wait for a real domain** — rejected: blocks the entire vertical
  slice (FHS-179) on a procurement step that has no committed date.
- **Custom header (`X-Tenant-Slug`)** — rejected for SPA routes for
  the same reason ADR 0002 rejected it: browsers don't send custom
  headers on direct navigation, so deep links break. Acceptable for
  pure machine-to-machine API calls; not how we'll route the SPA.
- **Path-prefix only, no subdomain support** — rejected: makes the
  eventual cutover to a real domain a code change rather than a
  config change. Building both sources now is a few extra lines.

## Cutover plan

When we own the production domain:

1. Set `BASE_DOMAIN=familyhub.app` in Railway production env.
2. Configure wildcard DNS + wildcard SSL ([FHS-157](https://qualicion2.atlassian.net/browse/FHS-157)).
3. Source 2 (subdomain) starts matching real traffic; source 3
   (path prefix) quietly becomes the fallback.
4. Update SPA URL helpers to emit subdomain links.
5. Optional later: 301 path-prefixed URLs to subdomain equivalents
   for SEO and bookmark migration.

No code path needs to be removed — sources are additive and
order-independent in their effect (first hit wins).

## References

- [ADR 0001 — Multi-tenancy strategy](0001-multi-tenancy.md)
- [ADR 0002 — Subdomain tenant routing](0002-subdomain-tenant-routing.md) (amended by this ADR)
- [FHS-157 — Configure wildcard DNS](https://qualicion2.atlassian.net/browse/FHS-157)
- [FHS-13 — resolveTenant middleware](https://qualicion2.atlassian.net/browse/FHS-13)
- [FHS-249 — Path-based tenant routing (interim)](https://qualicion2.atlassian.net/browse/FHS-249)
