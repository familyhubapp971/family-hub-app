# Technical docs

Implementation specs derived from feature requirements. This is *how*
the system is built; the *what* and *why* live in
[`../features/`](../features/) and [`../decisions/`](../decisions/).

## When to add a doc

- Architecture overviews when a major system component is introduced.
- API contracts when a new public surface stabilises (the OpenAPI spec
  itself lives in `apps/api/openapi.yaml` — link from here, don't duplicate).
- Data model docs (ERDs, schema rationale) when tables are added or
  reshaped beyond a routine migration.
- Sequence diagrams or runbooks when a flow spans multiple services or
  has non-obvious failure modes.
- Deployment / infra docs when topology changes.

Skip docs for routine implementation that the code itself documents
adequately.

## Naming

`<topic-slug>.md` — kebab-case, no prefixes. Examples:

- `architecture.md`
- `api/conventions.md`
- `data-model/tenants.md`
- `deployment.md`
- `slos.md`

Use subfolders (`api/`, `data-model/`, etc.) when a topic grows past
3–4 docs.

## Cross-linking

Every technical doc that implements a feature should link back to the
matching `../features/<slug>.md`. ADRs that drove the implementation
should be linked in a "References" section at the bottom.

## Index

_Initial seed — populate as docs are added:_

- `architecture.md` — TBD (high-level system overview)
- `deployment.md` — TBD (Railway topology, env vars, CI/CD flow)
- `slos.md` — TBD (SLI/SLO definitions per service)
- `api/` — TBD (conventions, error envelope, pagination, auth)
- `data-model/` — TBD (per-domain ERDs and schema rationale)
