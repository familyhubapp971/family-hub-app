# Comprehensive QA Implementation Plan

> **What actually shipped (2026-08-27).** Task 1 was dropped on the founder's
> call: the `qa-safeguards` integration feature repeated cross-family and
> closed-week checks the 64-file integration tier already covers, so it was
> removed rather than committed. Task 7's QA report runner was dropped with it.
> Tasks 2 to 5 landed in a reduced form aimed at the areas with NO browser
> coverage at all: the six parent dashboard tabs
> (`dashboard-daily-use.feature`), child and teen PIN sign-in
> (`kid-pin-login.feature`), and a real second adult in
> `role-permissions.feature`. The seeded personas and per-tab content are
> OPT-IN (`seedFamily({ withPersonas, withContent })`) because seeding them by
> default broke six existing specs. Tasks 6 and 8 (full browser matrix, CI
> artefacts) are not done.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add high-risk integration and browser journeys from the approved QA plan and generate one plain-English test report.

**Architecture:** Extend the existing Vitest Cucumber integration suite only where safeguards are missing, and extend the Playwright BDD harness for visible role journeys. Keep seeded families isolated and deterministic. Produce machine-readable JSON from both runners, then transform it into one local Markdown report.

**Tech Stack:** TypeScript, Vitest, @amiceli/vitest-cucumber, Postgres 16, Playwright, playwright-bdd, Node.js

---

## File map

- `tests/integration/features/qa-safeguards.feature`: missing repeated-action and cross-family safeguards.
- `tests/integration/steps/qa-safeguards.steps.ts`: real Postgres and API steps for those safeguards.
- `tests/e2e/support/auth/seed.ts`: reusable adult, child, teen, empty-state, and money fixture data.
- `tests/e2e/support/fixtures.ts`: admin, second-adult, child, and teen browser sessions.
- `tests/e2e/features/family-role-journeys.feature`: critical parent, adult, child, and teen journeys.
- `tests/e2e/steps/family-role-journeys.ts`: Playwright steps for role journeys and forbidden routes.
- `tests/e2e/features/dashboard-daily-use.feature`: six parent dashboard areas, filters, and empty states.
- `tests/e2e/steps/dashboard-daily-use.ts`: Playwright steps for daily dashboard behavior.
- `tests/e2e/features/money-reconciliation.feature`: visible action, close, reopen, and summary checks.
- `tests/e2e/steps/money-reconciliation.ts`: Playwright and database assertions for money totals.
- `tests/e2e/playwright.config.ts`: desktop, phone, tablet, Firefox, and WebKit full-run projects.
- `tests/reporters/qa-report.mjs`: combine Vitest and Playwright JSON into Markdown.
- `tests/reporters/qa-report.test.mjs`: reporter behavior tests.
- `tests/run-qa-report.mjs`: run both tiers and write their raw result files.
- `package.json`: expose `test:qa-report`.
- `.github/workflows/ci-pr-staging.yml`: upload raw and Markdown QA reports.

### Task 1: Prove missing integration safeguards

**Files:**

- Create: `tests/integration/features/qa-safeguards.feature`
- Create: `tests/integration/steps/qa-safeguards.steps.ts`

- [ ] **Step 1: Write the failing BDD scenarios**

```gherkin
Feature: QA safeguards across families and repeated actions

  Scenario: Repeating the same money request does not charge twice
    Given a family child has 20 available stickers
    When the same 5 sticker bank request is submitted twice
    Then only 5 stickers are banked
    And one audit entry records the bank action

  Scenario: An adult cannot change another family's child
    Given two isolated families exist
    When an adult from the first family changes the second family's child
    Then the request is forbidden
    And the second family's child is unchanged

  Scenario: A closed week rejects another money action
    Given a child's week is closed with a final summary
    When an adult tries to cash out from that week
    Then the request is rejected as a conflict
    And the final summary is unchanged
```

- [ ] **Step 2: Add steps using the established integration helpers**

Implement one `describeFeature` block. Seed two UUID-scoped tenants through `integrationPool`, mint role tokens with the same ES256 helper used by `money-permissions-by-role.steps.ts`, call `app.request`, and store every response and before/after row count in scenario context. Assert HTTP `403` for cross-family access, HTTP `409` for a closed week, and exactly one matching `mw_week_actions` row after the repeated request.

- [ ] **Step 3: Run the new scenarios and confirm the intended failure**

Run: `pnpm test:integration -- tests/integration/steps/qa-safeguards.steps.ts`

Expected: at least one scenario fails because the repeated-action contract is not yet enforced or its current endpoint contract differs. Record the exact result without changing production code in this ticket.

- [ ] **Step 4: Align the assertions with existing supported contracts only**

If the endpoint already has an idempotency key, send the same key twice. If it intentionally rejects duplicates, assert the documented rejection and unchanged rows. Do not weaken the invariant that one request produces one financial action.

- [ ] **Step 5: Run the focused integration scenarios**

Run: `pnpm test:integration -- tests/integration/steps/qa-safeguards.steps.ts`

Expected: 3 scenarios pass with no skipped steps.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/features/qa-safeguards.feature tests/integration/steps/qa-safeguards.steps.ts
git commit -m "test: cover family and money safeguards" -m "Refs FHS-645"
```

### Task 2: Extend deterministic family personas

**Files:**

- Modify: `tests/e2e/support/auth/seed.ts`
- Modify: `tests/e2e/support/fixtures.ts`
- Create: `tests/e2e/support/auth/seed-personas.test.ts`

- [ ] **Step 1: Write a failing fixture contract test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildPersonaNames } from './seed.js';

describe('buildPersonaNames', () => {
  it('creates stable role labels from one suffix', () => {
    expect(buildPersonaNames('abcd1234')).toEqual({
      admin: 'E2E Admin abcd1234',
      adult: 'E2E Adult abcd1234',
      child: 'E2E Kid abcd1234',
      teen: 'E2E Teen abcd1234',
    });
  });
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `pnpm vitest run tests/e2e/support/auth/seed-personas.test.ts`

Expected: FAIL because `buildPersonaNames` is not exported.

- [ ] **Step 3: Add the persona data**

Export `buildPersonaNames`. Extend `SeededFamily` with `adultMemberId`, `adultUserId`, `adultEmail`, `teenMemberId`, and persona display names. Insert a linked second-adult user/member plus a PIN-enabled teen. Seed at least one meal, event, assignment, notice, task, journal entry, reward request, and learning-progress row using the existing Drizzle schema names. Keep every row under the generated tenant ID.

- [ ] **Step 4: Add role-session helpers**

Refactor token and local-storage creation into `createSessionEntry(userId, email)`. Expose fixtures named `adminFamily`, `adultFamily`, and `kidFamily`. Each fixture must seed once, create only its role's valid session, and call `cleanupFamily` after use.

- [ ] **Step 5: Run the fixture contract and TypeScript checks**

Run: `pnpm vitest run tests/e2e/support/auth/seed-personas.test.ts && pnpm typecheck`

Expected: the contract test passes and typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/support/auth/seed.ts tests/e2e/support/fixtures.ts tests/e2e/support/auth/seed-personas.test.ts
git commit -m "test: seed complete family personas" -m "Refs FHS-645"
```

### Task 3: Add critical role journeys

**Files:**

- Create: `tests/e2e/features/family-role-journeys.feature`
- Create: `tests/e2e/steps/family-role-journeys.ts`

- [ ] **Step 1: Write failing browser scenarios**

```gherkin
Feature: Family journeys stay inside each role

  @critical @authed-local
  Scenario: A second adult manages daily family work without admin settings
    Given I am signed in as the seeded second adult
    When I open the family dashboard and profile menu
    Then I can open daily family areas
    And Family settings is not shown

  @critical @authed-local
  Scenario: A child enters their world and cannot open adult pages
    Given I open the seeded family's child sign-in
    When I choose the child and enter the correct PIN
    Then My World opens for that child
    And a direct visit to Family settings returns me to the child world

  @authed-local
  Scenario: A teen sees age-appropriate learning and money areas
    Given I open the seeded family's child sign-in
    When I choose the teen and enter the correct PIN
    Then the teen can open Learn and their money summary
    And parent controls are not shown
```

- [ ] **Step 2: Generate specs and confirm missing steps fail**

Run: `pnpm --dir tests/e2e exec bddgen test --config playwright.critical.config.ts`

Expected: FAIL listing undefined steps from `family-role-journeys.feature`.

- [ ] **Step 3: Implement browser steps**

Use `createBdd(test)` from `support/fixtures.ts`. Locate controls by `data-testid`, label, or role. Never use CSS position selectors. After every navigation, wait for a named page landmark. For forbidden direct URLs, assert both the final URL and absence of protected settings content.

- [ ] **Step 4: Run the focused critical journeys**

Run: `pnpm --dir tests/e2e test:e2e:critical -- --grep "second adult|child enters"`

Expected: 2 Chromium scenarios pass with 0 retries locally.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/features/family-role-journeys.feature tests/e2e/steps/family-role-journeys.ts
git commit -m "test: cover adult and child journeys" -m "Refs FHS-645"
```

### Task 4: Cover daily dashboard use

**Files:**

- Create: `tests/e2e/features/dashboard-daily-use.feature`
- Create: `tests/e2e/steps/dashboard-daily-use.ts`

- [ ] **Step 1: Write failing dashboard scenarios**

```gherkin
Feature: The family dashboard works every day

  @critical @authed-local
  Scenario Outline: Every parent dashboard area opens
    Given I am signed in as the admin of a populated family
    When I open the <area> dashboard area
    Then the <area> content appears without a loading error

    Examples:
      | area        |
      | Today       |
      | Meals       |
      | Calendar    |
      | Assignments |
      | Noticeboard |
      | Tasks       |

  @authed-local
  Scenario: Empty dashboard areas explain what to do next
    Given I am signed in as the admin of an empty family
    When I open each dashboard area
    Then every empty area shows a useful empty message

  @authed-local
  Scenario: Long family content does not create sideways scrolling
    Given the family has long event, task, meal and notice titles
    When I inspect every dashboard area at phone width
    Then no area scrolls sideways
```

- [ ] **Step 2: Generate and verify missing steps**

Run: `pnpm --dir tests/e2e exec bddgen test --config playwright.critical.config.ts`

Expected: FAIL listing the new dashboard steps.

- [ ] **Step 3: Implement the steps**

Map each area to its existing tab test ID and content landmark. Observe API responses and fail on status 400 or higher. For responsive checks, calculate `document.documentElement.scrollWidth - clientWidth` and require a value no greater than 1.

- [ ] **Step 4: Run the focused dashboard suite**

Run: `pnpm --dir tests/e2e test:e2e:critical -- --grep "Every parent dashboard area opens"`

Expected: 6 example rows pass in Chromium.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/features/dashboard-daily-use.feature tests/e2e/steps/dashboard-daily-use.ts
git commit -m "test: cover daily dashboard areas" -m "Refs FHS-645"
```

### Task 5: Reconcile money across browser and database

**Files:**

- Create: `tests/e2e/features/money-reconciliation.feature`
- Create: `tests/e2e/steps/money-reconciliation.ts`

- [ ] **Step 1: Write failing money journeys**

```gherkin
Feature: A child's money always adds up

  @critical @authed-local
  Scenario: Saving stickers updates every visible total once
    Given a seeded child has 20 available stickers
    When the admin saves 5 stickers and confirms once
    Then available stickers fall to 15
    And saved stickers rise by 5
    And the week history contains one save action

  @critical @authed-local
  Scenario: Closing and reopening a week preserves its final maths
    Given the seeded child has a week ready to close
    When the admin closes the week and records the final figures
    And the admin reopens the week
    Then the reopened figures reconcile with the recorded final figures

  @authed-local
  Scenario: A repeated confirmation creates one money action
    Given a seeded child has 20 available stickers
    When the admin double-clicks the 5 sticker save confirmation
    Then one save action appears
    And available stickers are 15
```

- [ ] **Step 2: Generate and verify missing steps**

Run: `pnpm --dir tests/e2e exec bddgen test --config playwright.critical.config.ts`

Expected: FAIL listing the new money-reconciliation steps.

- [ ] **Step 3: Implement visible and persisted assertions**

Read amounts from test IDs as integer sticker values. Query `mw_week_actions` through `getE2eDb()` after each visible action. Require `available + saved + cashedOut + invested + withdrawnAdjustments` to equal the earned sticker total according to the shared money contract. For double-click, use `Promise.all` on two click attempts and assert one persisted action.

- [ ] **Step 4: Run the focused money suite**

Run: `pnpm --dir tests/e2e test:e2e:critical -- --grep "Saving stickers|Closing and reopening"`

Expected: 2 critical scenarios pass, with exact visible and database totals.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/features/money-reconciliation.feature tests/e2e/steps/money-reconciliation.ts
git commit -m "test: reconcile child money journeys" -m "Refs FHS-645"
```

### Task 6: Expand the full browser and device matrix

**Files:**

- Modify: `tests/e2e/playwright.config.ts`

- [ ] **Step 1: Add matrix expectations to a config test**

Create `tests/unit/e2e/playwright-matrix.test.ts` that imports the config and expects project names `chromium-desktop`, `chromium-phone`, `chromium-tablet`, `firefox-desktop`, and `webkit-desktop`.

- [ ] **Step 2: Run the matrix test and verify it fails**

Run: `pnpm vitest run tests/unit/e2e/playwright-matrix.test.ts`

Expected: FAIL because the existing projects are named `chromium` and `mobile-chrome`.

- [ ] **Step 3: Define the full projects**

Use Playwright's `Desktop Chrome`, `Pixel 5`, `iPad (gen 7)`, `Desktop Firefox`, and `Desktop Safari` device presets. Keep the critical config Chromium-only.

- [ ] **Step 4: Verify project discovery**

Run: `pnpm vitest run tests/unit/e2e/playwright-matrix.test.ts && pnpm --dir tests/e2e exec playwright test --config playwright.config.ts --list`

Expected: the unit test passes and every scenario is listed under all 5 projects.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/playwright.config.ts tests/unit/e2e/playwright-matrix.test.ts
git commit -m "test: expand browser and device coverage" -m "Refs FHS-645"
```

### Task 7: Generate the plain-English QA report

**Files:**

- Create: `tests/reporters/qa-report.mjs`
- Create: `tests/reporters/qa-report.test.mjs`
- Create: `tests/run-qa-report.mjs`
- Modify: `tests/integration/vitest.config.ts`
- Modify: `tests/e2e/playwright.critical.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing reporter tests**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQaReport } from './qa-report.mjs';

test('summarises both tiers and blocks release on a failure', () => {
  const report = buildQaReport({
    integration: { passed: 3, failed: 1, skipped: 0 },
    e2e: { passed: 4, failed: 0, skipped: 1, retried: 0 },
    blockers: [],
    gaps: ['Google sign-in needs staging credentials'],
  });
  assert.match(report, /Integration.*3 passed.*1 failed/s);
  assert.match(report, /Release recommendation.*DO NOT RELEASE/s);
  assert.match(report, /Google sign-in needs staging credentials/);
});
```

- [ ] **Step 2: Run the reporter test and verify it fails**

Run: `node --test tests/reporters/qa-report.test.mjs`

Expected: FAIL because `qa-report.mjs` does not exist.

- [ ] **Step 3: Implement deterministic report rendering**

Export `buildQaReport(input)`. Render headings for environment, totals, results by tier, defects, blockers, gaps, evidence, and release recommendation. Recommend `DO NOT RELEASE` when any critical test fails, any blocker exists, or totals cannot be read. Recommend `READY FOR REVIEW` otherwise. Use the run's ISO date and never hide skipped or retried checks.

- [ ] **Step 4: Add raw JSON reporters and the runner**

Configure Vitest and Playwright to keep their existing console/HTML reporters and also write JSON under `tests/.qa-results/`. In `run-qa-report.mjs`, use `spawnSync` with argument arrays to run integration first and critical E2E second. Always call the report builder even if a child command fails. Write `tests/reports/qa-report-YYYY-MM-DD.md` and exit nonzero when either suite fails.

- [ ] **Step 5: Add the package command**

Add `"test:qa-report": "node tests/run-qa-report.mjs"` to root scripts.

- [ ] **Step 6: Verify the reporter**

Run: `node --test tests/reporters/qa-report.test.mjs`

Expected: all reporter tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json tests/reporters tests/run-qa-report.mjs tests/integration/vitest.config.ts tests/e2e/playwright.critical.config.ts
git commit -m "test: generate one QA run report" -m "Refs FHS-645"
```

### Task 8: Run the suite and publish CI evidence

**Files:**

- Modify: `.github/workflows/ci-pr-staging.yml`
- Modify: `tests/README.md`

- [ ] **Step 1: Document the local command and report location**

Add `pnpm test:qa-report`, its Postgres requirement, the raw-results directory, and the Markdown report path to `tests/README.md`.

- [ ] **Step 2: Upload reports in CI**

Add an `if: always()` artifact step for `tests/.qa-results/` and `tests/reports/`. Keep the integration and critical browser jobs as required release gates.

- [ ] **Step 3: Run formatting, static checks, and focused tests**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && node --test tests/reporters/qa-report.test.mjs`

Expected: every command exits 0.

- [ ] **Step 4: Run integration tests**

Run: `pnpm test:integration`

Expected: all integration scenarios pass with 0 failures.

- [ ] **Step 5: Run critical browser tests and generate the report**

Run: `pnpm test:qa-report`

Expected: a dated Markdown report is written even if a test fails. The command exits 0 only when both tiers pass.

- [ ] **Step 6: Inspect evidence honestly**

Open the Markdown report and Playwright HTML report. Record every failure, retry, skip, environment blocker, and unautomated provider check. Do not turn an environment blocker into a product pass.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci-pr-staging.yml tests/README.md
git commit -m "ci: publish comprehensive QA evidence" -m "Refs FHS-645"
```

- [ ] **Step 8: Request parallel review**

Dispatch the project `code-reviewer` and `qa-expert` together. Fix every blocking finding, rerun affected tests, then run the full verification commands again before opening the pull request.
