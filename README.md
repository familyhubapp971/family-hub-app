# Family Hub

A multi-tenant SaaS platform for families to coordinate schedules, tasks, and shared life.

## Stack

- **API:** [Hono](https://hono.dev/) + [Drizzle ORM](https://orm.drizzle.team/) + [Zod](https://zod.dev/)
- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Database:** Postgres (with Row-Level Security for tenant isolation)
- **Hosting:** Railway (staging + production)
- **Testing:** Vitest (unit), Playwright (E2E), k6 (perf)

## Quick Start

```bash
# Install
pnpm install

# Configure
cp .env.example .env.local
# Fill in DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, etc.

# Develop
pnpm dev          # runs api + web concurrently
pnpm test         # run unit tests
pnpm test:e2e     # run Playwright E2E
```

## Repository Layout

```text
apps/
  api/      # Hono API server
  web/      # React + Vite frontend
packages/
  shared/   # Shared types, schemas, utilities
  test-utils/
docs/
  features/
  technical/
  decisions/  # ADRs
  strategy/
```

## Branches

- `main` — production
- `staging` — pre-production / QA
- feature branches → PR into `staging` → promoted to `main`

Both `main` and `staging` require PR reviews and passing CI.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture Decision Records](docs/decisions/) — durable choices
  - [ADR 0001 — Multi-tenancy strategy](docs/decisions/0001-multi-tenancy.md)
  - [ADR 0002 — Subdomain tenant routing](docs/decisions/0002-subdomain-tenant-routing.md)
  - [ADR 0003 — Auth library: Supabase Auth](docs/decisions/0003-auth-library.md)
  - [ADR 0004 — Billing provider: Stripe](docs/decisions/0004-stripe-billing.md)
  - [ADR 0005 — Monorepo structure](docs/decisions/0005-monorepo-structure.md)
  - [ADR 0006 — Branching strategy](docs/decisions/0006-branching-strategy.md)
- [Technical docs](docs/technical/)
- [Feature specs](docs/features/)
- [Strategy docs](docs/strategy/)

## License

See [LICENSE](LICENSE).
