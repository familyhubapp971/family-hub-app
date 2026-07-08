# Service level objectives (SLOs)

**Status:** working targets (first draft) · **Jira:** FHS-459
**Consumed by:** [tests/performance/config.js](../../tests/performance/config.js)
(k6 thresholds) and the scalability audit ([scalability-audit.md](scalability-audit.md)).

Plain version: these are the speed and reliability promises the API tries to
keep. The performance tests fail if we miss them, so they're the line between
"fast enough" and "needs work".

## Latency (response time)

Measured at the API, steady state (not cold start), realistic data volumes.

| Class             | Target       | Applies to                                                                                               |
| ----------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| Read (p95)        | **< 250 ms** | GET endpoints (lists, profiles, single-record reads)                                                     |
| Write (p95)       | **< 500 ms** | POST/PUT/PATCH/DELETE                                                                                    |
| Hot screens (p95) | **< 250 ms** | `GET /api/dashboard/today`, `GET /api/kid/today` — tagged separately in k6 so we watch them on their own |
| p99 (soak)        | **< 500 ms** | drift detection over a long run                                                                          |

"p95 < 250 ms" = 95 out of 100 requests finish in under a quarter second.

## Reliability

| Metric                   | Target                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| Error rate (load / soak) | **< 1%** of requests                                                 |
| Error rate (smoke)       | **< 5%** (a 30s/1-VU run fails on a single transient blip otherwise) |

## Load shapes the tests assert against

From [tests/performance/config.js](../../tests/performance/config.js):

| Profile | VUs | Duration | Purpose                                           |
| ------- | --- | -------- | ------------------------------------------------- |
| smoke   | 1   | 30s      | every CI run — is a real family session healthy   |
| load    | 50  | 5m       | nightly against staging — steady expected load    |
| stress  | 200 | 10m      | pre-release — past peak; latency/error budgets ×2 |
| soak    | 30  | 2h       | weekly — memory/connection-leak + drift detection |

## Caveats (read before trusting a number)

- **Rate limit:** the API allows 100 requests/min per IP. A single-machine k6 run
  shares one bucket across all VUs, so `load`/`stress` need `RATE_LIMIT_PER_MINUTE`
  raised on staging for the window, or distributed load — otherwise the run
  measures 429 rejections, not real latency.
- **Data volume matters:** several queries slow down with a family's _age_, not
  the number of families (see the scalability audit). Load tests must run
  against **seeded tenants with realistic row counts**, not empty ones, or they
  under-report latency.
- These are first-draft targets. Revisit once we have real production latency
  histograms to calibrate against.
