# 0014 — My World economy uses its own per-child tables

**Status:** accepted
**Date:** 2026-06-14
**Jira:** FHS-291 (epic FHS-290)

## Context

The kids' **My World** screen (ported from the legacy `family-hub` codebase
to match the Magic Patterns design) is a per-child sticker economy: habits
earn typed stickers, stickers convert to AED (1★ = 0.5 AED), can be saved,
invested (grow +5/day, −2/miss), spent on rewards, and reconciled at a
weekly "close week".

The schema already had unused stub tables named `weeks`, `savings`,
`investments`, and `week_actions` — scaffolded in Sprint 1 for a future
**family-level finance** feature (a savings _goal_ like a "Hajj fund",
stock/ETF holdings, tenant-wide weeks). Their shapes and meaning are
incompatible with the kid economy, and no code references them.

Decision needed: reuse those names/tables for the kid economy, or add new
ones.

## Decision

Add **new, distinctly-named, per-(tenant, member) tables** for the My World
economy and leave the family-finance stubs untouched:

- `mw_weeks`, `habit_stickers`, `mw_savings`, `mw_savings_transactions`,
  `mw_transaction_stickers`, `mw_investments`, `mw_week_actions` (+ enums
  `sticker_type`, `mw_savings_tx_type`, `mw_week_action_type`).
- `habits` gains `icon` + `is_bonus`.
- Every new table except the pure junction carries `tenant_id` + `member_id`
  and is registered in `TENANT_SCOPED_TABLES` (leak audit).

The legacy model is single-tenant/single-child (a `savings` singleton row);
here each child has their own economy, so the scoping is per member.

## Consequences

- **Easier:** the generic `weeks`/`savings`/`investments` names stay free
  for a future family-finance feature; no risk of one feature's migration
  breaking the other; each child's economy is cleanly isolated.
- **Harder:** two similarly-named concepts coexist (`savings` vs
  `mw_savings`) — mitigated by the `mw_` prefix + this ADR.
- **Follow-up:** the lightweight FHS-268 model (`habit_logs` +
  `reward_redemptions`) is superseded by `habit_stickers` + the claim flow;
  it is left in place until FHS-292 rewires the UI/API, then removed in a
  later cleanup.
- **FHS-378 — deductible investments.** `mw_investments` gained a
  `deductible boolean NOT NULL DEFAULT true` column. When `true` (the legacy
  behaviour, and the default for every existing row) a missed day still
  subtracts −2/day; when `false` the investment keeps counting and showing
  missed days but loses no value for them. Set on create (optional
  `deductible` in `POST /mw/financial/investments`, default true), changeable
  on an active investment via `POST /mw/financial/investments/:id/settings`
  `{ deductible }`, preserved across a close-week continuation, and returned
  on every investment GET (parent + kid). Migration `0033`.

## Alternatives considered

- **Repurpose the stub tables** — bends generic family-finance tables into
  kid-only meaning and would force a future family-finance feature to add
  its own tables anyway; rejected.
- **Single shared economy across the family** (not per-child) — contradicts
  "My World" being each child's own space; rejected.
