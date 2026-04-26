# Family Hub

A multi-tenant SaaS platform for families to coordinate schedules, tasks, and shared life.

## Stack

- **API:** [Hono](https://hono.dev/) + [Drizzle ORM](https://orm.drizzle.team/) + [Zod](https://zod.dev/) + [pino](https://getpino.io/)
- **Frontend:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS 3](https://tailwindcss.com/)
- **Database:** Postgres (with Row-Level Security for tenant isolation, [ADR 0001](docs/decisions/0001-multi-tenancy.md))
- **Hosting:** Railway (staging + production)
- **Auth:** Supabase Auth ([ADR 0003](docs/decisions/0003-auth-library.md))
- **Billing:** Stripe ([ADR 0004](docs/decisions/0004-stripe-billing.md))
- **Testing:** Vitest (unit + integration), Playwright + playwright-bdd (E2E), k6 (perf)
- **Package manager:** pnpm 10 workspaces

### Stack Reuse Rationale

This stack is **deliberately reused verbatim** from the legacy
`family-hub` codebase rather than re-evaluated greenfield. The
trade-offs and the criteria for revisiting any single library are
captured in [ADR 0007 — Reuse the family-hub stack](docs/decisions/0007-stack-reuse.md).

In short: Sprint 0's job is to ship a tenant vertical slice, not to
bikeshed library choices. The two surfaces that **do** diverge from
family-hub get their own ADRs ([0001](docs/decisions/0001-multi-tenancy.md)
multi-tenancy, [0002](docs/decisions/0002-subdomain-tenant-routing.md)
subdomain routing). Swap a single library when a specific metric
forces it; don't re-litigate the whole stack at once.

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

## Working with Claude Code

This repo ships [`.claude/`](.claude/README.md) with a curated set of
specialist subagents and skills, plus a conservative permission
allowlist. After cloning, Claude Code picks them up automatically.

Useful slash commands (via `~/.claude/skills/commands/`):

- `/plan` · `/write-plan` · `/execute-plan` — planning lifecycle
- `/brainstorm` — feature exploration before code
- `/start` — surface relevant skills at session start
- `/status` — check progress on the current effort

See [`.claude/README.md`](.claude/README.md) for the full list of
shipped agents and skills, and [`CLAUDE.md`](CLAUDE.md) for project
conventions and the skill-routing map.

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
  - [ADR 0007 — Reuse the family-hub stack](docs/decisions/0007-stack-reuse.md)
- [Technical docs](docs/technical/)
- [Feature specs](docs/features/)
- [Strategy docs](docs/strategy/) — incl. [SaaS Transformation Strategy](docs/strategy/saas-transformation.md)

## License

See [LICENSE](LICENSE).
