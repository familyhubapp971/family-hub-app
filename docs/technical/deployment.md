# Deployment topology — Railway

Authoritative reference for the `family-hub-saas` Railway project. Captures
the running infrastructure, env-var matrix, deploy flow, and known
constraints. Update whenever topology changes (add a service, rotate a
secret format, change a branch tracking rule, upgrade plan).

> **Status as of 2026-04-26:** Sprint 0 bootstrap. Trial plan ($5 / 28-day
> cap). Staging-only provisioning. Production environment exists but is
> intentionally unconfigured pending Hobby-plan upgrade — see
> [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202).

## Project

| Field | Value |
| --- | --- |
| Name | `family-hub-saas` |
| ID | `bc7e539b-fc8b-4f56-99e2-daffee70138f` |
| Workspace | Trial workspace (1 contributor) |
| Plan | Trial ($5 cap) |
| Region | us-east4 (forced on trial — see [Region constraints](#region-constraints)) |

Created via the Railway MCP server (`@jasontanswe/railway-mcp`)
configured in `.mcp.json` (gitignored — see [`.env.example`](../../.env.example)
for variable names).

## Environments

| Name | ID | Purpose | Branch |
| --- | --- | --- | --- |
| `staging` | `3fb76a04-e926-4bdf-ae03-659966366dfb` | Pre-prod, all bootstrap work lands here | `staging` |
| `production` | `4d84223a-86d3-49ef-a66c-acefe2100158` | GA target — currently unconfigured | `main` (planned) |

The branching strategy is documented in
[ADR 0006](../decisions/0006-branching-strategy.md): merges land on
`staging` only during bootstrap, then promote to `main` as a single
batch when the W1 vertical slice ships ([FHS-198](https://qualicion2.atlassian.net/browse/FHS-198)).

## Services

Three project-level services, each with one instance per environment.
Railway's model: services are project-scoped; per-environment runtime
config (region, build/start commands, vars, source) lives on the
service instance.

| Service | ID | Source | Image |
| --- | --- | --- | --- |
| `postgres` | `e2a7c43f-46db-44e8-bc06-a934fe290699` | — | `postgres:16-alpine` |
| `api` | `7a93c040-1220-4afb-a564-f4cf98901948` | `familyhubapp971/family-hub-app` | — |
| `frontend` | `f3048c9c-195b-4141-8cca-daf0f213d6a9` | `familyhubapp971/family-hub-app` | — |

### Postgres

Persistent volume `postgres-volume`
(ID `5d88b9b5-28e6-4db5-b252-0836214162cf`) mounted at
`/var/lib/postgresql/data` in the staging instance. Production instance
has no volume and is set to `sleepApplication: true` (deploys CRASHED on
boot due to missing `POSTGRES_PASSWORD` — intentional, prevents trial
credit drain until [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202)).

### api

Hono server (Node 20+, ESM). pnpm workspace — depends on
`@familyhub/shared` via `workspace:*`. Build/start config lives at the
service-instance level so per-env overrides are possible later.

> **Known issue:** the staging deploy currently fails at runtime because
> tsc emits to `apps/api/dist/apps/api/src/index.js` instead of
> `apps/api/dist/index.js` — workspace cross-imports widen the rootDir.
> Tracked as [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201).
> Bundling with esbuild/tsup is the recommended fix.

### frontend

Vite SPA. Built into `apps/web/dist/` and served via `vite preview`
bound to `$PORT`. Public domain
**[`frontend-staging-409d.up.railway.app`](https://frontend-staging-409d.up.railway.app)**
(domain ID `098cbd7e-9a09-40d2-9004-c37bf6a62518`, target port `8080`).

`vite preview` is acceptable for staging but not ideal long-term — it
runs a full Node process to serve static files. Post-upgrade we can
switch to a static-file server (Caddy/nginx) or Railway Edge.

## Build & start commands (staging)

| Service | Build | Start |
| --- | --- | --- |
| `api` | `corepack enable && pnpm install --frozen-lockfile && pnpm -F @familyhub/api build` | `pnpm -F @familyhub/api start` |
| `frontend` | `corepack enable && pnpm install --frozen-lockfile && pnpm -F @familyhub/web build` | `pnpm --filter @familyhub/web exec vite preview --host 0.0.0.0 --port $PORT` |
| `postgres` | — (image) | — (image entrypoint) |

`rootDirectory` is left at the default (`/` — repo root) on every
instance because rootDirectory: `apps/api`/`apps/web` would break
pnpm workspace resolution (Railway can't see the workspace packages).

Healthcheck: api uses `/health`
([`apps/api/src/routes/health.ts`](../../apps/api/src/routes/health.ts)).
Frontend has no healthcheck — Railway falls back to TCP-level checks.

## Environment variable matrix (staging)

### postgres vars

| Variable | Source | Value |
| --- | --- | --- |
| `POSTGRES_USER` | MCP `variable_bulk_set` | `familyhub` |
| `POSTGRES_DB` | MCP `variable_bulk_set` | `familyhub_staging` |
| `PGDATA` | MCP `variable_bulk_set` | `/var/lib/postgresql/data/pgdata` |
| `POSTGRES_PASSWORD` | MCP `variable_set` | (32-char URL-safe random; rotate via dashboard if exposure suspected) |

### api vars

| Variable | Source | Value |
| --- | --- | --- |
| `NODE_ENV` | MCP | `production` (the api config schema only accepts `development`/`test`/`production`; staging is treated as production-like for strictness) |
| `LOG_LEVEL` | MCP | `info` |
| `DATABASE_URL` | MCP (Railway-resolved at deploy) | `postgresql://${{postgres.POSTGRES_USER}}:${{postgres.POSTGRES_PASSWORD}}@${{postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{postgres.POSTGRES_DB}}` (see [cross-service references](#cross-service-references)) |
| `PORT` | Railway-injected | (assigned by Railway, read by [`apps/api/src/config.ts`](../../apps/api/src/config.ts)) |

### frontend vars

No app-level vars yet. Railway injects standard `RAILWAY_*` and `PORT`.

### Cross-service references

Railway's `${{serviceName.VAR}}` interpolation lets one service read
another's variables at deploy time. **The service name is lowercase**
and matches what was passed as `name` on `service_create_*`. Empirically
verified at the api service in staging via `list_service_variables`,
where the resolved `DATABASE_URL` showed:

| Token | Resolves to |
| --- | --- |
| `${{postgres.POSTGRES_USER}}` | `familyhub` ✓ |
| `${{postgres.POSTGRES_DB}}` | `familyhub_staging` ✓ |
| `${{postgres.RAILWAY_PRIVATE_DOMAIN}}` | `postgres.railway.internal` ✓ |
| `${{postgres.POSTGRES_PASSWORD}}` | (empty in `list_service_variables` output — Railway appears to strip `*PASSWORD*`-suffixed values from cross-service ref displays for safety; deploy-time injection still expected to work but **unverified end-to-end** until [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201) lands and the api boots) |

## Deploy flow

```text
push to staging branch
        ↓
deploymentTrigger fires (per service)
        ↓
Railpack builds image
        ↓
container deployed to staging env
        ↓
healthcheck (api: /health; frontend: TCP)
        ↓
public domain serves traffic
```

Deployment triggers (one per service, per env):

| Trigger ID | Service | Branch | Repo |
| --- | --- | --- | --- |
| `a97c3872-4e12-46ac-9883-aeb03e1bd15e` | api | `staging` | `familyhubapp971/family-hub-app` |
| `f3456b7a-d1a6-461c-a222-c3fa6e011550` | frontend | `staging` | `familyhubapp971/family-hub-app` |

Manual deploys can be triggered via the Railway MCP
(`mcp__railway__deployment_trigger` with a commit SHA) or by pushing
the staging branch.

## Region constraints

The Railway trial plan does **not** allow region selection. Setting
`region` via either the MCP `service_update` or the GraphQL
`serviceInstanceUpdate` mutation returns success but does **not**
persist — a silent no-op. All workloads run in `us-east4`.

The user-facing edge (TLS termination + static asset cache) is auto-
selected by Railway based on visitor geography. UAE traffic terminates
at `asia-southeast1-eqsg3a` (Singapore), keeping perceived latency
acceptable for an MVP. Origin requests still cross to us-east4
(~120-140 ms from UAE), so any latency-sensitive paths should be
treated with caution until [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202)
unlocks `europe-west4` for closer Middle East peering.

## Cost expectations (trial plan)

- Idle frontend service: ~free (no traffic ⇒ minimal compute)
- Postgres staging: low constant cost (small image, single replica)
- Postgres production: $0 — never wakes (CRASHED + sleep)
- api staging: ~free until [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201) lands and it actually runs

The $5 trial cap is the upper bound until upgrade. Burn rate so far
(2026-04-26 provisioning session): negligible — most credit was
consumed by image pulls and the Postgres staging instance running.

## Operational handles

- **Dashboard:** [railway.com/project/bc7e539b-...](https://railway.com/project/bc7e539b-fc8b-4f56-99e2-daffee70138f)
- **Frontend staging:** [frontend-staging-409d.up.railway.app](https://frontend-staging-409d.up.railway.app)
- **Railway MCP:** configured in `.mcp.json` (gitignored). Set `RAILWAY_API_TOKEN` in `.env.local`, then `claude mcp add railway --scope local --env RAILWAY_API_TOKEN=$RAILWAY_API_TOKEN -- npx -y @jasontanswe/railway-mcp`. Verify with `claude mcp list` (expect `railway: ✓ Connected`).
- **Direct GraphQL:** `https://backboard.railway.com/graphql/v2` with `Authorization: Bearer $RAILWAY_API_TOKEN`. Use for anything the MCP doesn't expose (e.g., `deploymentTriggerCreate`, `serviceInstanceUpdate.region`).

## Runbook: add a new service to staging

The MCP doesn't expose a single "create + connect + deploy" call —
service setup is a 5-step workflow. Capturing it here so it's not
re-derived each time.

1. **Create the service** at the project level:
    - Repo-based: `mcp__railway__service_create_from_repo({ projectId, repo: "familyhubapp971/family-hub-app", name: "<svc-name>" })`
    - Image-based: `mcp__railway__service_create_from_image({ projectId, image: "<image>:<tag>", name: "<svc-name>" })`
    - Capture the returned `serviceId`.
2. **Configure the staging instance** via `mcp__railway__service_update`:
    - Always: `region` (no-op on trial — see [Region constraints](#region-constraints)), `buildCommand`, `startCommand`, `healthcheckPath` if applicable.
    - **Don't** set `rootDirectory` to `apps/<svc>` — it breaks pnpm workspace resolution. Leave at the default `/`.
3. **Wire branch-based deploys** via direct GraphQL (the MCP doesn't expose `deploymentTriggerCreate`):

    ```graphql
    mutation {
      deploymentTriggerCreate(input: {
        projectId: "bc7e539b-fc8b-4f56-99e2-daffee70138f"
        environmentId: "3fb76a04-e926-4bdf-ae03-659966366dfb"
        serviceId: "<svc-id>"
        provider: "github"
        repository: "familyhubapp971/family-hub-app"
        branch: "staging"
        checkSuites: false
      }) { id }
    }
    ```

4. **Set env vars** via `mcp__railway__variable_bulk_set` — secrets must
    not be inlined in the MCP call (transcript exposure); set those via
    the Railway dashboard "Generate" affordance or, if necessary, via
    `mcp__railway__variable_set` accepting the transcript trade-off.
5. **Trigger the first deploy** via `mcp__railway__deployment_trigger`
    with the staging branch HEAD SHA, or push to `staging` and let the
    trigger fire automatically. Verify with `mcp__railway__deployment_status`
    and `deployment_logs`.

For image-based services that can't be allowed to also auto-deploy in
the production env (cost reasons during trial), immediately call
`service_update({ environmentId: <production>, sleepApplication: true })`
to neutralize the production instance before it racks up runtime.

## References

- [FHS-156](https://qualicion2.atlassian.net/browse/FHS-156) — Create Railway project (this work)
- [FHS-201](https://qualicion2.atlassian.net/browse/FHS-201) — Fix api production build (blocks staging api deploy)
- [FHS-202](https://qualicion2.atlassian.net/browse/FHS-202) — Configure Railway production post-upgrade
- [FHS-155](https://qualicion2.atlassian.net/browse/FHS-155) — Railway Infrastructure & DNS (parent epic)
- [ADR 0006](../decisions/0006-branching-strategy.md) — branching strategy
