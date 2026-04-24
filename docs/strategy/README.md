# Strategy

Long-form strategy docs that set product direction and inform the
[`../features/`](../features/) backlog. Lower cadence than features /
technical docs — these change quarterly or per major pivot, not per
ticket.

## When to add a doc

- Product vision / north-star definitions.
- Market positioning, ICP (ideal customer profile), competitive analysis.
- Multi-year roadmap or theme planning.
- Transformation plans (e.g., monolith → SaaS migration strategy).
- Pricing / packaging strategy.

If a doc would be obsolete in three months, it probably belongs in
`features/` or a Jira ticket, not here.

## Naming

`<topic-slug>.md` — kebab-case, no dates in the filename. Use the
front-matter `Updated:` line for cadence. Examples:

- `saas-transformation.md`
- `vision.md`
- `pricing.md`
- `competitive-positioning.md`

## Format

Free-form; no required template — strategy docs vary in shape (narrative,
SWOT, OKRs, etc.). Include at minimum:

- **Status / Updated:** date last reviewed
- **Owner:** who maintains this
- **Audience:** who needs to read it (eng, leadership, all)

## Index

_Seeded by FHS-175 — populate as docs land:_

- `saas-transformation.md` — TBD (FHS-175)
