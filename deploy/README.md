# deploy/

Infrastructure, deployment, and ops scripts that don't belong to a
single application workspace.

## Layout (planned)

```text
deploy/
  railway/         # Railway env configs, service definitions
  docker/          # Dockerfiles, docker-compose for local dev
  scripts/         # bootstrap / migration / seed shell scripts
  supabase/        # exported email templates, RLS policies (versioned)
```

Wired across multiple Sprint 0 tickets:

- Railway: [FHS-156](https://qualicion2.atlassian.net/browse/FHS-156),
  [FHS-159](https://qualicion2.atlassian.net/browse/FHS-159).
- Docker / local dev: [FHS-168](https://qualicion2.atlassian.net/browse/FHS-168).
- Supabase template export: [FHS-188](https://qualicion2.atlassian.net/browse/FHS-188).

Per [ADR 0005](../docs/decisions/0005-monorepo-structure.md), `deploy/`
is **not** a pnpm workspace — scripts and configs live as plain files,
referenced from CI workflows and the root `package.json`.
