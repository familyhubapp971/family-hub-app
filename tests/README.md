# tests/

Cross-app and infrastructure-level tests that don't belong inside a
single workspace.

## Layout (planned)

```text
tests/
  e2e/        # Playwright (BDD-style, mirrors Gherkin in documents/features/)
  perf/       # k6 scenarios (smoke / load / stress / soak)
```

`e2e/` is wired in [FHS-153](https://qualicion2.atlassian.net/browse/FHS-153)
and [FHS-182](https://qualicion2.atlassian.net/browse/FHS-182).
`perf/` is wired in [FHS-153](https://qualicion2.atlassian.net/browse/FHS-153)
and [FHS-183](https://qualicion2.atlassian.net/browse/FHS-183).

Per [ADR 0005](../documents/decisions/0005-monorepo-structure.md), `tests/`
is **not** a pnpm workspace — each tier brings its own runner config
and dependencies are installed at the root.

Per the project Testing section in [`/CLAUDE.md`](../CLAUDE.md#testing):

- **Unit** lives next to source as `*.test.ts` inside each workspace
  (Vitest), not here.
- **Integration** lives in each workspace as `*.integration.test.ts`
  (Vitest + real Postgres), not here.
- **E2E + perf** live here.
