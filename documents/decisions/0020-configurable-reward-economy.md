# 0020: Configurable reward economy (rate, boost, skip penalty)

**Status:** accepted
**Date:** 2026-07-31
**Jira:** FHS-512 (amounts: FHS-488, boosts + skip penalty: FHS-489)

## Context

ADR 0014 set up the My World sticker economy with a single hardcoded
conversion: 1 sticker = 0.5 AED (`STICKER_TO_CASH` in `lib/myworld.ts`),
and a habit was either "bonus" (fixed value 5) or normal (value 1). The
"Pocket money" settings screen (FHS-512) lets a family set their own rate,
give a habit any boost multiplier, and optionally dock money when a habit
is skipped. This changes money math in a dozen call sites across the API
and needs a decision on units, storage, and where the deduction lands.

## Decision

1. **Money unit for every NEW field is an integer minor-currency unit**
   (e.g. `50` = `0.50`), never a float. New columns:
   `tenants.sticker_rate_minor` (family default, default `50`),
   `members.sticker_rate_minor` (nullable per-child override),
   `habits.boost` (integer, default `1`, replaces the old
   `isBonus ? 5 : 1`), `habits.skip_penalty_minor` (default `0`).
2. **A single resolver**: `effectiveRateMinor(child, family)` in
   `apps/api/src/lib/reward-config.ts`: decides which rate applies: the
   child's own `stickerRateMinor` if set, else the family default. Every
   site that used to read the `STICKER_TO_CASH` constant now resolves this
   per-child rate instead (`lib/myworld.ts`, `routes/mw-financial.ts`,
   `routes/mw-weeks.ts`, `routes/habits.ts`).
3. **Boost replaces `isBonus` as the source of truth** for sticker value.
   `is_bonus` is kept as a derived/legacy display flag (`boost > 1`) so
   older UI reading it doesn't break; the migration backfills
   `boost = 5` for every row that had `is_bonus = true`.
4. **Skip penalty is a two-part write**: a `money_adjustments` audit row
   (one per due day missed, negative `amount_minor`) PLUS an immediate
   decrement of `mw_savings.saved_cash` (floored at 0, same `GREATEST(...,
0)` pattern the codebase already uses for investment/auto-save
   reversals). Folding the deduction directly into the existing
   `saved_cash` ledger, instead of requiring every reader to separately
   sum `money_adjustments`: means every existing balance display (kid
   view, admin Savings tab, dashboard, cash-out, redemption checks)
   reflects the penalty automatically, with no second code path to keep
   in sync. `money_adjustments` exists purely as the audit trail and as
   what `reopen`/`repair` read to reverse the deduction (matched by `day`
   falling inside the week's Mon–Sun range, since the table has no
   `week_id` column).
5. **"Due day" = every day of the week (0–6).** Habit `cadence`
   (`daily`/`weekly`/`custom`) has never been enforced anywhere in the
   sticker economy, a child can place a sticker on any day regardless of
   cadence, so the skip-penalty accrual treats every day as due. A
   cadence-aware "due day" (e.g. a Mon–Fri-only habit) is a follow-up if
   FHS-489 wants it.
6. **Legacy decimal money columns are untouched.** `saved_cash`,
   `invested_amount`, `current_value`, `cash_amount`, etc. stay
   `numeric(12,2)` decimal, now fed by `rate = rateMinor / 100` instead of
   the fixed `0.5`. Converting the whole economy to minor-unit integer
   columns is a bigger, separate migration, out of scope here (see
   Alternatives).

## Consequences

- **Easier:** every existing money display (kid MyWorld, admin panel,
  dashboard) picks up the configured rate and the skip-penalty deduction
  with no per-screen change, because they all read `saved_cash` /
  `stickerRate` from the same shared loaders.
- **Easier:** `GET /api/mw/financial/savings` (and the kid mirror) now
  returns `stickerRateMinor` alongside the existing decimal `stickerRate`,
  so a money-safe caller never has to reconstruct the integer from a float.
- **Harder:** two money representations coexist, new fields are
  minor-unit integers, legacy fields are decimal. A future contributor
  adding a new money field must pick the right one; this ADR is the
  pointer to follow (new = minor units, old = decimal until migrated).
- **Follow-up:** a dedicated migration to move `saved_cash` and friends to
  integer minor units repo-wide would remove the dual-representation
  entirely; not done here to keep this ticket's blast radius to the
  reward-config feature.
- **Follow-up:** cadence-aware due days for the skip penalty (currently
  every day counts) if a future ticket wants habits configured for
  specific weekdays only.

## Alternatives considered

- **Store the skip penalty ONLY in `money_adjustments`, sum it on every
  read**, more "pure" (single source of truth) but means every balance
  reader (kid view, admin Savings tab, redemption affordability, dashboard)
  needs a new join/sum step; rejected as a much larger, riskier change for
  this ticket given the existing ledger-folding pattern already works for
  auto-save and investment maturity.
- **Migrate all money columns to integer minor units in this ticket**:
  correct long-term, but touches every numeric money column in the schema
  (`saved_cash`, `invested_amount`, `current_value`, `final_return`,
  `cash_amount`, `carried_over_cash`, `retrieved_cash`, `target_amount`,
  savings/investments family-finance stubs); rejected as out of scope for
  a "reward config + settings screen" ticket, tracked as a follow-up.
