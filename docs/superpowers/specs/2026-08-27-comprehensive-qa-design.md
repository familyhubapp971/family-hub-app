# FHS-645 Comprehensive QA Design

## Goal

Add reliable integration and browser coverage for Family Hub's highest-risk family journeys, then produce one plain-English report from every full run.

## Current position

The repository already has broad API and database coverage: 64 integration feature files with about 370 scenarios. Browser coverage is narrower: 16 Playwright feature files with about 40 scenarios. New work should extend proven helpers and avoid repeating checks that already exist at a lower layer.

## Test layers

### Integration

Use Vitest Cucumber and disposable Postgres data for rules that must remain true regardless of the screen:

- admin, adult, child, and cross-family access boundaries;
- money reconciliation, repeated actions, and closed-week protection;
- invite, member, PIN, learning, and audit-record consistency;
- predictable error results for invalid, expired, or conflicting actions.

### End to end

Use Playwright BDD for journeys where the browser and visible result matter:

- family setup and progress retention;
- adult invitation, role restrictions, and member safety;
- all parent dashboard areas, including empty and long-content states;
- the five child-money actions, close and reopen, and summary reconciliation;
- child and teen PIN entry, tabs, reward requests, learning, and forbidden routes;
- parent Child View and Learning Insights consistency;
- sign-out, expired sessions, back navigation, repeated taps, and failed requests;
- desktop, phone, and tablet layouts, with broader browser coverage outside the pull-request gate.

Critical Chromium journeys run for each pull request. The full Chromium, Firefox, and WebKit device matrix is suitable for staging or scheduled runs because it costs more time.

## Test data

Seed two isolated families. Each family has an admin, a second adult, a child, and a teen. Seed open and closed weeks, rewards, savings, investments, full tabs, and empty tabs. Fix the clock, currency, time zone, and week anchor so results do not change with the real date.

External email, Google sign-in, and calendar providers use controlled local boundaries in the repeatable suite. A smaller staging contract run checks real providers when credentials are available.

## Reporting

Add a report command that runs the selected integration and end-to-end suites and writes a dated Markdown summary under `tests/reports/`. The report contains:

- totals for passed, failed, skipped, blocked, and retried checks;
- results grouped by product area, role, browser, and device;
- defect evidence and severity;
- environment or credential blockers;
- coverage gaps that are not yet automated;
- a release recommendation.

Generated reports remain local or CI artifacts unless the ticket explicitly requires committing a baseline report.

## Release gate

A release is recommended only when every critical journey passes, no critical or high-severity defect remains open, no role or family-data leak exists, every money case reconciles, and no unexplained retry or missing report remains.

## Delivery boundary

FHS-645 adds the reusable reporting foundation and the highest-risk missing automated journeys first. Provider contracts, long-running concurrency checks, accessibility sweeps, visual comparisons, and the full nightly browser matrix remain clearly listed follow-up work if they cannot run deterministically in the local environment.
