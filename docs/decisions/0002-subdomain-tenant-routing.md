# 0002 — Subdomain tenant routing

**Status:** accepted
**Date:** 2026-04-24
**Jira:** [FHS-173](https://qualicion2.atlassian.net/browse/FHS-173)

## Context

Multi-tenancy strategy is settled (see [ADR 0001](0001-multi-tenancy.md)):
shared DB, `tenant_id` + RLS. Every request must carry a tenant
context before it touches data. We need a consistent way to derive
that context from the request.

Requirements:

- Clean, brandable URLs per tenant (`acme.familyhub.app`).
- Trivial for the frontend (the browser "is" a tenant the whole session).
- No additional round-trips to resolve tenant.
- Plays with wildcard SSL and our existing Railway deployment.

## Decision

**Resolve tenant from the subdomain via API middleware.**

`<slug>.familyhub.app` → `tenants.slug = '<slug>'` → `tenant_id`.

Middleware runs before any route handler:

```ts
// apps/api/src/middleware/tenant.ts
export async function tenantFromSubdomain(c, next) {
  const host = c.req.header('host') ?? '';           // e.g. "acme.familyhub.app"
  const slug = host.split('.')[0];                   // "acme"

  if (!slug || RESERVED.has(slug)) {
    throw new HTTPException(400, { message: 'missing tenant' });
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
    columns: { id: true, slug: true },
  });
  if (!tenant) throw new HTTPException(404, { message: 'unknown tenant' });

  return runWithTenant(tenant.id, () => next());     // AsyncLocalStorage scope
}
```

`RESERVED` includes `www`, `api`, `staging`, `app`, plus any marketing
subdomains. The runtime `runWithTenant` opens the `AsyncLocalStorage`
scope and sets `app.tenant_id` on the Postgres connection (ADR 0001).

Frontend uses the same subdomain for its API calls — the browser's
`window.location.host` is the source of truth; no auth-token parsing
needed to pick the tenant.

## Consequences

**Becomes easier:**

- One line of code (`host.split('.')[0]`) picks the tenant for every
  request.
- Tenant-scoped caching, CDN rules, and logging all key off the host
  header without extra plumbing.
- CORS stays tight — each tenant is a distinct origin.

**Becomes harder:**

- Wildcard DNS + wildcard SSL required in production (already planned
  in FHS-157, scoped to staging subdomain first).
- Cookies scoped to `*.familyhub.app` carefully; session cookies do
  not leak across subdomains unless intentional.
- Custom domains (`app.customer-brand.com`) need a separate lookup
  keyed on host, not slug. Track as a follow-up ADR when first enterprise
  asks.
- Local dev needs `*.localhost` resolution (macOS and most Linux
  resolvers handle it automatically; Windows contributors use
  `/etc/hosts` entries or a dnsmasq config documented in README).

## Alternatives considered

- **Path prefix (`familyhub.app/t/acme/...`)** — rejected: messy URLs,
  no brand dedication, frontend has to thread slug through every
  link, subdomain-scoped cookies / CORS impossible.
- **Custom header (`X-Tenant: acme`)** — rejected: browsers won't
  send it on direct navigation, so deep links and shared URLs break.
  Fine for machine-to-machine but not for a user-facing app.
- **Tenant from JWT claim only** — rejected: requires auth even for
  anonymous marketing pages, and puts the tenant-lookup cost on every
  request's token verification.

## References

- [ADR 0001 — Multi-tenancy strategy](0001-multi-tenancy.md)
- [FHS-157 — Configure wildcard DNS](https://qualicion2.atlassian.net/browse/FHS-157)
