# Feature: Getting started (first-run setup guide)

**Jira:** [FHS-511](https://qualicion2.atlassian.net/browse/FHS-511)
**Status:** shipped
**Owner:** product-manager

One-line: a card at the top of the family dashboard that walks a brand-new
family through the first four setup steps, celebrates when they're all done,
then clears itself and never comes back.

The card lives above the Today content on the dashboard's home tab. Its progress
is **tap-driven** (tapping a step's button both takes you to that area and ticks
the step) and remembered per family in the browser, so a family that finished or
hid the guide never sees it again.

Two guardrails: the guide **only shows to an admin** (every step lands on an
admin-only setup screen, so a non-admin adult never sees it), and the steps are
**sequential** — only the next step has an active button; later steps sit as a
quiet "Up next" so you can't skip ahead and "finish" an empty family.

## User stories

### Story 1: A new family is guided through setup

**As a** parent who just created a family
**I want** a short checklist of the first things to do
**so that** I know how to get the app working for my kids.

#### Acceptance criteria

**Scenario: New family sees the guide**

- **Given** a family that just signed up
- **When** I open the dashboard
- **Then** I see the "Getting started" card with "0 of 4 done" and the first
  step highlighted as the button to tap

**Scenario: Completing a step**

- **Given** I am on the "Getting started" card
- **When** I tap a step's button
- **Then** I'm taken to that area
- **And** the step is marked done and the progress bar advances
- **And** that progress is remembered if I come back

**Scenario: Finished**

- **Given** all four steps are done
- **Then** the card celebrates with "You are all set up"
- **And** a "Got it" button clears it for good

**Scenario: Returning users**

- **Given** a family that already set up (or hid the guide)
- **Then** the card does not show

## The four steps

| #   | Step                           | Why                                             | Button           | Goes to                 |
| --- | ------------------------------ | ----------------------------------------------- | ---------------- | ----------------------- |
| 1   | Add your kids                  | Everything else hangs off who is in the family. | Add a child      | Manage Members          |
| 2   | Give each kid a PIN            | It is how they sign in to their own world.      | Set PINs         | Manage Members          |
| 3   | Choose what a sticker is worth | Decide how much a finished habit pays.          | Set pocket money | Reward Settings         |
| 4   | Pick their first habits        | Start with two or three easy wins.              | Open their world | The first child's world |

## Out of scope

- **Data-driven completion.** A step ticks when you tap its button, not by
  detecting that the underlying data now exists (e.g. it doesn't auto-tick
  "Add your kids" just because kids already exist). Matches the design; a
  data-aware version is a possible follow-up.
- **Cross-device memory.** "Done/hidden" is remembered in the browser
  (localStorage, keyed per family, not per user) — there's no backend flag yet.
  So a different device/browser shows the guide again until dismissed, and two
  family members on the **same** browser share one checklist. Fine for a one-off
  setup task; a per-family server flag is a follow-up if it becomes a problem.

## Open questions

- Should completing a step be data-aware (auto-tick when the data is there) as
  well as tap-driven?
- Do we want a server-side "first-run done" flag so the guide is truly
  once-per-family across devices?

## Success metrics

- Share of new families who complete all four steps within their first session.
- Fewer "how do I add a child / set a PIN / start habits?" support questions
  from new families after rollout.

## Implementation notes

- Component: `apps/web/src/pages/tenant/dashboard/GetStarted.tsx`, mounted above
  `TodayTabPanel` on the dashboard home tab (`DashboardPage.tsx`).
- Persistence: `localStorage` key `fh.getStarted.<slug>` storing
  `{ dismissed, completed: string[] }`, read/written through try/catch wrappers
  (private-mode safe).
- The step-4 deep-link needs a child id; the card reads the family's members
  from `GET /api/dashboard/today` and targets the first kid, falling back to
  Manage Members when there are no kids yet.
