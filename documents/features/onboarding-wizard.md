# Feature: Onboarding wizard

**Jira:** [FHS-36](https://qualicion2.atlassian.net/browse/FHS-36)/[FHS-37](https://qualicion2.atlassian.net/browse/FHS-37)/[FHS-38](https://qualicion2.atlassian.net/browse/FHS-38)/[FHS-39](https://qualicion2.atlassian.net/browse/FHS-39) (wizard core) · [FHS-274](https://qualicion2.atlassian.net/browse/FHS-274)/[FHS-275](https://qualicion2.atlassian.net/browse/FHS-275) (founder rename + adult invite) · [FHS-432](https://qualicion2.atlassian.net/browse/FHS-432) (auto timezone/currency) · [FHS-487](https://qualicion2.atlassian.net/browse/FHS-487) (child age)
**Status:** shipped
**Owner:** product-manager

The four-step wizard a new admin walks through once, right after
signup, at `/t/:slug/onboarding`. A returning user whose family has
already finished onboarding is bounced straight to `/dashboard` before
the wizard renders.

## Steps

1. **Welcome** — orientation text only.
2. **Members** — the founder's own name (pinned "You · Admin" row),
   plus 0–7 other family members. Each row has a name, a role
   (Adult / Teen / Child / Guest), an optional emoji, and:
   - **Adults only** — an optional email that sends a sign-in invite.
   - **Children only** — an optional age in years (FHS-487).
3. **Location** — timezone + currency are auto-detected from the
   browser and shown read-only; a "Change" link reveals a manual
   picker only if detection failed or the value is wrong.
4. **Done** — a summary, then one POST to `/api/onboarding/complete`
   that creates every member row, renames the founder's own row, saves
   timezone/currency, seeds starter habits/rewards, emails any adult
   invites, and marks the tenant onboarded.

## User stories

### Story 1: Set up the family in one pass

**As a** new admin who just signed up
**I want** to add my family and confirm my timezone/currency in one flow
**so that** the app is ready to use without a separate settings trip.

#### Acceptance criteria

**Scenario: Founder completes onboarding with two other members**

- **Given** I am signed in and land on `/t/:slug/onboarding` for the
  first time
- **When** I fill in my name, add two members with names and roles,
  confirm the auto-detected timezone and currency, and finish
- **Then** I am redirected to `/dashboard`
- **And** my family now has those two members plus me as admin

**Scenario: Returning to onboarding after it's already done**

- **Given** my family's onboarding is already completed
- **When** I navigate to `/t/:slug/onboarding`
- **Then** I am redirected straight to `/dashboard` without seeing the wizard

### Story 2: Capture a child's age (FHS-487)

**As an** admin adding a child during onboarding
**I want to** optionally note their age
**so that** it's on file for later features to use (nothing reads it yet)

#### Acceptance criteria

**Scenario: Admin adds a child with an age**

- **Given** I am on the Members step of onboarding
- **And** I have added a member with the role "Child"
- **When** I enter "6" in that row's Age field
- **And** I finish onboarding
- **Then** the child's member record is saved with age 6

**Scenario: Admin leaves the child's age blank**

- **Given** I am on the Members step of onboarding
- **And** I have added a member with the role "Child"
- **When** I finish onboarding without entering an age
- **Then** the child's member record is saved with age set to nothing (null)

**Scenario: Age field only appears for child rows**

- **Given** I have added a member with the role "Adult"
- **Then** no age field appears for that row
- **When** I switch that row's role to "Child"
- **Then** an age field appears for that row

## Out of scope

- **Anything that reads the age value.** FHS-487 only captures and
  stores it — no dashboard, ChildWorld panel, or age-based gating
  consumes it yet.
- **Age for non-child roles.** Adults, teens, and guests never get an
  age field in the wizard; the API forces their `age` to null even if
  one is somehow submitted.
- **Editing age after onboarding.** The Manage Family "Add a child"
  form already has its own age field (FHS-276); this doc only covers
  the onboarding wizard's copy of that capability.

## Open questions

- **Staleness.** Like the FHS-276 Manage Family age field, this is a
  point-in-time number, not a birthday — it goes stale as the child
  grows. Acceptable for now; revisit if a future feature needs an
  accurate current age.

## Success metrics

- Not tracked yet — the field exists purely to avoid re-asking later;
  no usage metric until a feature consumes it.
