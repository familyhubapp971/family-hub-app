# Documentation

Source of truth for what the product does, why, and how it's built.

## Layout

| Folder                   | Owns                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [features/](features/)   | Product requirements per feature: user stories, Gherkin acceptance criteria, success metrics, scope                     |
| [technical/](technical/) | Implementation specs: architecture, API contracts, schemas, deployment, sequence diagrams                               |
| [decisions/](decisions/) | Architecture Decision Records (ADRs) — durable choices that future contributors must respect                            |
| [strategy/](strategy/)   | Long-form strategy docs: product vision, market positioning, multi-year roadmap, transformation plans                   |
| [design/](design/)       | Visual review artefacts: user journeys, flow diagrams, IA maps — render in a browser using the Family Hub design tokens |

## How docs flow

```text
strategy/  ── informs ──▶  features/  ── implemented as ──▶  technical/
                                │
                                └──▶ decisions/ (when a choice deserves an ADR)
```

1. **Strategy** sets direction (rare changes; long-lived).
2. **Features** translate strategy into user-visible capabilities (per Jira ticket).
3. **Technical** docs spell out _how_ a feature is built (created when implementation starts).
4. **Decisions** capture the _why_ behind non-obvious choices (created at the moment of deciding).

## Conventions

- Every doc is plain Markdown, kebab-case filename, one top-level `# H1`.
- Reference Jira tickets by key (`FHS-XXX`) — they auto-link in the GitHub UI once Jira ↔ GitHub integration is configured.
- Cross-link between folders rather than duplicating content.
- See [`/CLAUDE.md`](../CLAUDE.md) for the full doc-authoring rules and the
  user-story + Gherkin format required in `features/`.

## Index of subfolder READMEs

- [features/README.md](features/README.md) — what to put in `features/`
- [technical/README.md](technical/README.md) — what to put in `technical/`
- [decisions/README.md](decisions/README.md) — when to write an ADR
- [strategy/README.md](strategy/README.md) — strategy doc scope and cadence
- [design/README.md](design/README.md) — visual review artefacts (user journeys, flow diagrams)
