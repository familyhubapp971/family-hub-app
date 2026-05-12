---
title: FamilyHub Impact Measurement Framework
status: v1 (2026-05-06)
owner: founder
audience: investors, accelerators, grant programs (e.g. Standard Chartered Foundation)
sources:
  - documents/business/theory-of-change.md
  - documents/business/business-model-canvas.md
  - documents/strategy/saas-transformation.md
---

# FamilyHub Impact Measurement Framework

_How we prove the [Theory of Change](theory-of-change.md) is actually working._

**In plain words:** every outcome we claim has to be a number we can
show. This document lists each metric, where the data comes from, what
the baseline is today, and what we expect to see at month 12 + month 24. Funders, the board, and the founding team look at the same
dashboard so there's no narrative drift.

---

## How to read this

For every claim in the Theory of Change there's at least one **outcome
metric** below. We split metrics into four layers:

| Layer        | Question it answers                               | Frequency |
| ------------ | ------------------------------------------------- | --------- |
| **Outputs**  | What did we ship + sell?                          | Weekly    |
| **Reach**    | Who is using it?                                  | Weekly    |
| **Outcomes** | Is anyone's life better?                          | Monthly   |
| **Impact**   | Is the world we're trying to bend toward bending? | Quarterly |

Every metric has the same five-field shape: **Metric · Source · Baseline (today) · Year-1 target · Year-2 target**.

---

## 1. Output metrics — _what we shipped + sold_

| Metric                           | Source             | Baseline | Year 1 target           | Year 2 target |
| -------------------------------- | ------------------ | -------- | ----------------------- | ------------- |
| Paid consumer families           | Stripe             | 0        | 1,000                   | 5,000+        |
| Enterprise / white-label tenants | Stripe + Jira      | 0        | 15                      | 30+           |
| Annual recurring revenue (ARR)   | Stripe             | $0       | $130k                   | $720k+        |
| Modules shipped                  | Repo (sprint plan) | 0        | 3 (Maths, Logic, Flags) | 5+            |
| Geographies live                 | Marketing          | 0        | 2 (UAE/Saudi + UK/US)   | 4+            |

## 2. Reach metrics — _who is using it_

| Metric                                                       | Source                    | Baseline | Year 1 target | Year 2 target |
| ------------------------------------------------------------ | ------------------------- | -------- | ------------- | ------------- |
| Children with ≥1 active learning module                      | PostHog product analytics | 0        | 1,500         | 8,000+        |
| Families using ≥3 of the 4 pillars in a week                 | PostHog cohort cut        | 0        | 60% of paid   | 70% of paid   |
| % paid families in MENA (UAE / Saudi / Pakistan / Indonesia) | Stripe billing country    | n/a      | 40%           | 50%+          |
| % paid families using Ramadan journal or mosque integration  | PostHog feature flag      | n/a      | 25%           | 35%           |
| Free → paid conversion at day 30                             | PostHog + Stripe          | n/a      | 8%            | 12%           |

## 3. Outcome metrics — _is anyone's life better?_

This is the layer funders care about most. Each outcome maps back to a
section of the Theory of Change.

| Outcome (from ToC)                         | Metric                                                                                                                    | Source               | Baseline         | Year 1 target         | Year 2 target      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------- | --------------------- | ------------------ |
| **Kids learn what they specifically need** | Median per-child Maths mastery delta after 90 days (vs synthetic generic-placement control)                               | App telemetry        | n/a (pre-launch) | +18 percentile points | +25 pp             |
| **Kids learn what they specifically need** | Weekly active days per child on a learning module                                                                         | PostHog              | n/a              | 3.5 days/week         | 4.5 days/week      |
| **Kids learn money + responsibility**      | % children meeting a self-set savings goal (sticker economy) in a 30-day window                                           | App telemetry        | n/a              | 35%                   | 55%                |
| **Parents save time + mental-load**        | Self-reported "minutes per week NOT juggling 5 apps" (NPS-style quarterly survey)                                         | In-product survey    | n/a              | 60 min/week           | 120 min/week       |
| **Families coordinate without nagging**    | Median # shared calendar events + meals + assignments created per family per week                                         | App telemetry        | n/a              | 12 / family / week    | 18 / family / week |
| **Underserved households fit**             | % monthly-active families using ≥1 cultural-flexibility feature (Ramadan journal, mosque calendar, extended-family roles) | PostHog feature flag | n/a              | 30%                   | 45%                |
| **Community orgs get a digital home**      | # active enterprise tenants with ≥5 active member-families                                                                | Stripe + PostHog     | 0                | 10                    | 25                 |

## 4. Impact metrics — _is the world we're trying to bend toward bending?_

These compound — they get more meaningful as the cohort ages.

| Impact claim                             | Metric                                                                        | Source                            | Baseline | Year 1 target           | Year 2 target |
| ---------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------- | -------- | ----------------------- | ------------- |
| **More child learning hours that count** | Cumulative AI-personalised lesson-completions across all children             | App telemetry                     | 0        | 250k                    | 2M+           |
| **Less parental burnout**                | Aggregate "minutes saved" claimed across paid families per year               | In-product survey × paid families | 0        | 1.04M minutes (17k hrs) | 10M+ minutes  |
| **Equitable family-tech access**         | Paid families in MENA + Indonesia + Pakistan as % of total paid base          | Stripe                            | n/a      | 40%                     | 50%+          |
| **Community-tech infrastructure**        | # community member-families coordinated via white-label tenants               | Stripe + PostHog                  | 0        | 1,200                   | 8,000+        |
| **Path to financial literacy**           | Distinct children who completed a "save → spend" cycle in the sticker economy | App telemetry                     | 0        | 1,000                   | 6,000+        |

---

## How we collect the data (and why we trust it)

| Source                       | What it gives us                                                                                                 | Trust level                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Stripe**                   | Revenue, conversion, churn, country-of-billing                                                                   | High — primary source of truth                     |
| **PostHog**                  | Product analytics: feature usage, cohorts, funnels                                                               | High — wired since FHS-141 (Sprint 1)              |
| **App telemetry (Postgres)** | Per-child learning events, sticker transactions, family activity                                                 | High — owned by us, real events not approximations |
| **In-product surveys**       | Subjective parent claims ("minutes saved", NPS)                                                                  | Medium — self-reported, anchor to behavioural data |
| **Sentry**                   | Reliability / error rate (not an impact metric per se, but feeds the "actually works for them" subjective layer) | High                                               |

## Cadence + governance

| Cadence       | Who                                  | What                                                                                     |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Weekly**    | Founder                              | Output + reach metrics. 1-line written update.                                           |
| **Monthly**   | Founder + first hire (once on team)  | Outcome metrics. Compare against ToC assumptions. Flag drift.                            |
| **Quarterly** | Founder + board / advisors / funders | Impact metrics. Full ToC review — assumptions still holding? Re-route if not.            |
| **Annually**  | Founder + board + funders            | External-facing impact report. Numbers, narrative, what changed in the Theory of Change. |

## Equity + privacy guardrails

- **Children under 13** — no PII in analytics; we report aggregates only. COPPA-compliant by design (Sentry redaction, anonymised PostHog identifiers).
- **Cultural metrics** — opt-in. A family choosing to use the Ramadan journal is a feature toggle, not a profiled attribute we sell or surface to anyone outside the family.
- **No engagement-for-engagement's-sake** — we measure mastery + parent-time-saved, not session length. Sticker streaks have caps to avoid compulsion-loop dynamics.
- **No dark patterns** — pricing tiers + churn flow comply with consumer-protection rules in launch markets (UAE Consumer Protection Law, UK Consumer Rights Act, FTC).

---

## Open questions for v2 of this framework

- **Counterfactual control.** Personalisation vs generic placement comparison is currently a _synthetic_ control. Worth funding a randomised cohort study by year 2.
- **External validation.** Should we partner with an education-research body (e.g. EEF in UK, IIE Cairo) for an independent mastery-delta study once enrolment crosses ~3,000 children?
- **Long-tail outcomes.** "Family bonding" / "child confidence" are real outcomes that we can't measure cleanly with click data. Likely need annual qualitative interviews with 20–30 families to triangulate.

---

## How this connects to the rest of the strategy

- **[Theory of Change](theory-of-change.md)** — every metric above maps to a ToC outcome / impact claim.
- **[Business Model Canvas](business-model-canvas.md)** — the activities + revenue streams that make these metrics possible.
- **[Strategy doc](../strategy/saas-transformation.md)** — the sprint-by-sprint product plan that ships the features the metrics measure.

If a metric here has no corresponding ToC outcome, it's vanity. If a ToC outcome has no metric here, it's a wish. We trim both.
