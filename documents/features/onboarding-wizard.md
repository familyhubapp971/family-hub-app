# Feature: Onboarding wizard

**Jira:** [FHS-36](https://qualicion2.atlassian.net/browse/FHS-36)/[FHS-37](https://qualicion2.atlassian.net/browse/FHS-37)/[FHS-38](https://qualicion2.atlassian.net/browse/FHS-38)/[FHS-39](https://qualicion2.atlassian.net/browse/FHS-39) (wizard core) · [FHS-274](https://qualicion2.atlassian.net/browse/FHS-274)/[FHS-275](https://qualicion2.atlassian.net/browse/FHS-275) (founder rename + adult invite) · [FHS-432](https://qualicion2.atlassian.net/browse/FHS-432) (auto timezone/currency) · [FHS-487](https://qualicion2.atlassian.net/browse/FHS-487) (child age) · FHR-20, FHR-22, FHR-24 to FHR-28, FHR-32 (QA fixes, 2026-10-28)
**Status:** shipped
**Owner:** product-manager

The four-step wizard a new admin walks through once, right after
signup, at `/t/:slug/onboarding`. A returning user whose family has
already finished onboarding is bounced straight to `/dashboard` before
the wizard renders.

## Steps

1. **Welcome**: orientation text only.
2. **Members**: the founder's own name (pinned "You · Admin" row),
   plus 0–7 other family members. Each row has a name, a role
   (Adult / Teen / Child / Guest), an optional emoji, and:
   - **Adults only**: an optional email that sends a sign-in invite.
   - **Kids only (Child or Teen)**: an optional age in years, 1–25 (FHS-487).
3. **Location**: timezone + currency are auto-detected from the
   browser and shown read-only; a "Change" link reveals a manual
   picker only if detection failed or the value is wrong.
4. **Done**: a summary, then one POST to `/api/onboarding/complete`
   that creates every member row, renames the founder's own row, saves
   timezone/currency, seeds starter habits/rewards, emails any adult
   invites, and marks the tenant onboarded.
   FHS-636: the wizard refuses a currency the app cannot show correctly (one
   with no small change, like the yen, or three decimals, like the dinar).
   The picker never offers one, and a family whose device suggests one is
   handed dollars instead, so this only bites a crafted request.

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

### Story 2: Capture a kid's age (FHS-487)

**As an** admin adding a kid (child or teen) during onboarding
**I want to** optionally note their age
**so that** it shows on their Manage Members card and is on file for later features

#### Acceptance criteria

**Scenario: Admin adds a kid with an age**

- **Given** I am on the Members step of onboarding
- **And** I have added a member with the role "Child" (or "Teen")
- **When** I enter "6" in that row's Age field (a whole number 1–25)
- **And** I finish onboarding
- **Then** that member's record is saved with age 6
- **And** it shows on their Manage Members card as "Child (6)"

**Scenario: Admin leaves the kid's age blank**

- **Given** I am on the Members step of onboarding
- **And** I have added a member with the role "Child" (or "Teen")
- **When** I finish onboarding without entering an age
- **Then** that member's record is saved with age set to nothing (null)

**Scenario: Age field only appears for kid rows**

- **Given** I have added a member with the role "Adult"
- **Then** no age field appears for that row
- **When** I switch that row's role to "Child" or "Teen"
- **Then** an age field appears for that row

### Story 3: Clear, forgiving setup (QA fixes, FHR)

**As a** parent setting up a new family
**I want** setup to keep what I typed and tell me what is missing
**so that** I never get stuck or see the wrong name.

#### Acceptance criteria

**Scenario: The name I typed carries into the wizard (FHR-25)**

- **Given** I typed "Sarah" as my name on the "Create your family hub" screen
- **And** my Google account is called something else
- **When** I reach step 2, "Who's in the family?"
- **Then** "Your name" shows "Sarah"

**Scenario: Next says what is missing (FHR-26)**

- **Given** I am on step 2 with my name blank, or an added person with no name
- **When** I press Next
- **Then** I stay on step 2
- **And** each blank box says "Enter your name." or "Enter a name, or remove this person."

**Scenario: No dead Back button on step 1 (FHR-28)**

- **Given** I am on step 1, Welcome
- **Then** there is no Back button

**Scenario: Long names stay inside the screen (FHR-24)**

- **Given** the name boxes on the create screen and in step 2
- **Then** each takes at most 40 characters
- **And** a long family name in the dashboard header wraps to two lines, then ends in "..."

**Scenario: My chosen name stays in the account menu (FHR-27)**

- **Given** I renamed myself during setup
- **When** I sign in again with Google
- **Then** the account menu still shows my chosen name, not my Google name

**Scenario: The homepage never claims a hub that is not ready (FHR-32)**

- **Given** I signed in but stopped before finishing setup
- **When** I open the homepage
- **Then** it says my family hub is not set up yet, with a "Finish setting up" button
- **And** it does not say "hub is ready"

**Scenario: Sign-up links work and phones do not zoom (FHR-22, FHR-20)**

- **Given** the sign-up screen
- **Then** "Terms" opens the Terms of Service, and /terms forwards there too
- **And** on a phone, tapping any text box does not zoom the page

## Out of scope

- **Age for grown-up roles.** Adults and guests never get an age field in the
  wizard; the API forces their `age` to null even if one is somehow submitted.
- **Age-based behaviour.** Nothing gates content on age yet, it's captured and
  displayed (on the Manage Members card) for later features to build on.
- **Editing age after onboarding.** The Manage Family "Add a child"
  form already has its own age field (FHS-276); this doc only covers
  the onboarding wizard's copy of that capability.

## Open questions

- **Staleness.** Like the FHS-276 Manage Family age field, this is a
  point-in-time number, not a birthday, it goes stale as the child
  grows. Acceptable for now; revisit if a future feature needs an
  accurate current age.

## Success metrics

- Not tracked yet, the field exists purely to avoid re-asking later;
  no usage metric until a feature consumes it.
