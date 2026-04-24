# Architecture Decision Records (ADRs)

Durable record of decisions that shape the system. ADRs are immutable
once accepted — supersede with a new ADR rather than editing.

## When to write an ADR

Write one when a decision:

- changes the shape of the system in a way someone might later question,
- chooses one viable option over another (e.g., Postgres vs DynamoDB),
- locks in a constraint future contributors need to respect.

**Don't** write an ADR for routine implementation choices. The bar is
"future-me would want context on this if they come back in six months."

## Naming

`NNNN-kebab-case-title.md`, where `NNNN` is a zero-padded sequential
number starting at `0001`. Examples:

- `0001-multi-tenancy-strategy.md`
- `0002-subdomain-tenant-routing.md`
- `0003-auth-library-choice.md`

Numbers are assigned at write time — bump from the highest existing
number; never reuse or renumber.

## Format

Every ADR uses the [MADR-lite template defined in
`/CLAUDE.md`](../../CLAUDE.md#architecture-decision-records-adrs). Required
sections:

- **Status:** proposed / accepted / superseded by NNNN
- **Date** (ISO `YYYY-MM-DD`)
- **Jira:** ticket key when applicable
- **Context** — what forces are in play
- **Decision** — what we decided
- **Consequences** — what becomes easier, what becomes harder, follow-ups
- **Alternatives considered** — and why rejected

## Lifecycle

- **Proposed** — drafted but not yet ratified. Open a PR to discuss.
- **Accepted** — merged after sign-off; treat as binding.
- **Superseded** — keep the file; update its `Status` line to point at the
  ADR that replaced it. Never delete an ADR.

## Index

_Seeded by FHS-172 / FHS-173 / FHS-174 — populate as ADRs land:_

- [`0001-multi-tenancy.md`](0001-multi-tenancy.md) — accepted (FHS-172)
- `0002-subdomain-tenant-routing.md` — TBD (FHS-173)
- `0003-auth-library.md` — TBD (FHS-173)
- `0004-stripe-billing.md` — TBD (FHS-173)
- `0005-monorepo-structure.md` — TBD (FHS-174)
- `0006-branching-strategy.md` — TBD (FHS-174)
