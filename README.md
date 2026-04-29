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
# Then fill in only what you need locally — see "Environment" below for
# where each value comes from.

# Develop
pnpm dev          # runs api + web concurrently
pnpm test         # run unit tests
pnpm test:e2e     # run Playwright E2E
```

## Environment

[`.env.example`](.env.example) is the canonical list of every variable
the api, web, and tooling read. Copy it to `.env.local` (gitignored)
and fill in the values you need.

Minimum vars needed to boot api + web locally: `DATABASE_URL` (and that
alone — everything else is optional until the dependent feature is wired).

Source of truth for real values:

| Group | Where the value comes from |
| --- | --- |
| Postgres | Local: docker-compose (FHS-168) or your own Postgres. Hosted: Railway dashboard injects `DATABASE_URL` automatically. |
| Runtime (`NODE_ENV`, `PORT`, `LOG_LEVEL`, `BASE_DOMAIN`, `VITE_API_URL`) | No external source — set per environment. Defaults in `.env.example` are dev-safe. |
| Supabase auth | Supabase dashboard → Project Settings → API |
| Stripe billing | Stripe dashboard → Developers → API keys (test mode for dev) |
| Sentry | Sentry dashboard → Project Settings → Client Keys (DSN) — separate projects for api + web |
| Jira tooling | [id.atlassian.com — API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| Railway MCP | [railway.com/account/tokens](https://railway.com/account/tokens) (Account Tokens, not Project) |

`.env.example` itself **never** holds real secrets. Production /
staging values live in the Railway dashboard; local dev values live
only in your `.env.local`. When the team grows past one person we'll
move to a shared vault — tracked as a follow-up.

## Tooling

[`scripts/refresh-confluence-epics-page.py`](scripts/refresh-confluence-epics-page.py)
refreshes the Confluence "FHS — Epics & Tickets" page from live Jira.
Runs after every ticket close per the CLAUDE.md post-merge rule:

```bash
set -a; source .env.local; set +a
python3 scripts/refresh-confluence-epics-page.py --reason "FHS-XXX close"
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
