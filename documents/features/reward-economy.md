# Feature: Reward economy (sticker rate, habit boosts, skip penalty)

**Jira:** [FHS-512](https://qualicion2.atlassian.net/browse/FHS-512) (build), [FHS-488](https://qualicion2.atlassian.net/browse/FHS-488) (rate placement), [FHS-489](https://qualicion2.atlassian.net/browse/FHS-489) (boosts + skip penalty)
**Status:** shipped
**Owner:** product-manager
**ADR:** [0020 — configurable reward economy (rate, boost, skip penalty)](../decisions/0020-configurable-reward-economy.md)

One-line: families set their own "1 sticker = how much money" rate (family-wide,
or a different rate per child), and can make specific habits pay more or dock
savings when skipped — replacing the old hardcoded 1 sticker = half a dirham
rule.

All of this lives on a single admin-only **"Reward settings"** screen
(`/t/:slug/reward-settings`, reachable from the profile menu). Every amount is
stored as a whole number of the family's onboarding currency's smallest unit
(e.g. `50` = `0.50`) — never a decimal — so money math never drifts from a
rounding error (see ADR 0020).

## User stories

### Story 1: Set how much a sticker is worth

**As an** admin
**I want** to set my family's default sticker rate, and optionally give one
child a different rate
**so that** each child's board pays out at the amount I choose for them.

#### Acceptance criteria

**Scenario: Admin sets the family's default rate**

- **Given** I am an admin on the "Reward settings" screen
- **When** I set "How much is one sticker worth?" to a new amount
- **Then** every child who doesn't have their own override earns at that rate
- **And** the amount is saved as a whole number of minor currency units (e.g.
  `75` for `0.75`), never a fraction

**Scenario: Admin gives one child a different rate**

- **Given** my family's default rate is `0.50`
- **When** I turn on "Different amount for {child}" and set it to `1.00`
- **Then** that child's board earns at `1.00` per sticker
- **And** every other child keeps earning at the family default of `0.50`

**Scenario: Turning an override off falls back to the family default**

- **Given** a child has a per-child rate override set
- **When** I turn that child's "Different amount" toggle off
- **Then** the override is cleared
- **And** the child's board goes back to earning at the family default

**Scenario: A non-admin can see but not change the rates**

- **Given** I am a signed-in family member who is not an admin
- **When** I open "Reward settings"
- **Then** I see the current family rate and each child's rate
- **And** every control is disabled, with a note that only an admin can change it
- **And** a save attempt is rejected by the server even if the UI were bypassed

### Story 2: Make a habit pay more

**As an** admin
**I want** to boost a specific habit's payout (2x, 3x, or 5x)
**so that** a bigger or harder habit is worth more than a routine one.

#### Acceptance criteria

**Scenario: Admin boosts a habit**

- **Given** I am an admin editing one of a child's habits
- **When** I choose a `2x`, `3x`, or `5x` boost
- **Then** that habit pays boost × the child's effective rate every time it's completed
- **And** the settings screen shows the resulting amount before I save (e.g.
  "This habit pays $1.50 each time")

**Scenario: A habit with no boost chosen pays the plain rate**

- **Given** a habit has never had a boost set
- **When** it is completed
- **Then** it pays exactly the child's effective rate (boost = 1×)

### Story 3: Dock money for a skipped habit

**As an** admin
**I want** to optionally deduct money when my child skips a habit
**so that** habits I've flagged as important carry real weight.

#### Acceptance criteria

**Scenario: Admin turns on a skip penalty**

- **Given** I am an admin editing a habit
- **When** I choose "They lose some money" and set an amount
- **Then** missing that habit on a day deducts the amount from the child's
  savings once the week closes
- **And** the deduction is written to an audit trail as well as taken
  immediately off the visible balance

**Scenario: No penalty is the default**

- **Given** a habit has never had a skip penalty configured
- **When** a day for that habit is missed
- **Then** nothing is deducted — the child simply earns no sticker that day

**Scenario: A penalty never pushes a balance negative**

- **Given** a child's savings balance is smaller than a habit's skip penalty
- **When** the week closes and the penalty is applied
- **Then** their balance is floored at zero, never negative
- **And** closing then reopening that week restores exactly what was deducted
  (no money is created — see ADR 0020's floor-compensation rule)

## Out of scope

- **Cadence-aware "due days."** Every day currently counts as due for the
  skip penalty (a weekdays-only habit still accrues a penalty on the
  weekend) — a deliberate simplification per ADR 0020, since habit cadence
  has never been enforced anywhere in the economy. Follow-up if wanted.
- **Migrating legacy decimal money columns** (`saved_cash`,
  `invested_amount`, etc.) to the new integer-minor-unit representation —
  ADR 0020 keeps the two representations side by side for now.
- **Zero/3-decimal currencies** (JPY, KWD) — money formatting still assumes
  2 decimals (tracked as [FHS-515](https://qualicion2.atlassian.net/browse/FHS-515)).
- **The rewards shop / redemption flow itself** — a separate feature; this
  doc only covers what a sticker is _worth_, not spending it.

## Open questions

- Should changing a child's rate or a habit's boost notify the child, or is
  silent-until-they-look the right default?
- Do we want cadence-aware due days for the skip penalty (ADR 0020's noted
  follow-up), or is "every day counts" fine long-term?

## Success metrics

- Share of admin families who ever customise a rate, boost, or skip penalty
  (adoption of the Reward settings screen beyond the defaults).
- Zero "wrong amount paid out" support reports after rollout.
- Zero savings balances observed negative in production (validates the
  floor-at-zero rule holds under real skip-penalty load).

## Implementation notes

- **Money resolver:** `effectiveRateMinor(child, family)` in
  `apps/api/src/lib/reward-config.ts` picks the child's own
  `stickerRateMinor` if set, else the family default — every money read
  site in the API goes through this resolver instead of a hardcoded constant.
- **Per-child data flow:** each kid's board reads _their own_ effective rate
  (via `/api/kid/financial/savings` → `stickerRateMinor`) and each habit's
  boost (via `/api/kid/habits`); the parent's view of a child uses the same
  resolver, so both sides always agree.
- **Endpoints:** `GET /api/reward-config` (any member, read-only) and
  `PUT /api/reward-config` (admin-only) manage the family + per-child rates;
  `PUT /api/habits/:id` carries `boost` and `skipPenaltyMinor` for a single habit.
- **Currency:** rates are in the family's onboarding currency
  (`tenants.currency`); the UI formats minor units back to a decimal display
  string via `Intl.NumberFormat`, but never stores or transmits a float.
