# Feature: Change a grown-up's sign-in email

**Jira:** [FHS-510](https://qualicion2.atlassian.net/browse/FHS-510)
**Status:** shipped
**Owner:** product-manager

An admin can update any grown-up's sign-in email from Manage Members. A
one-time confirm link is emailed to the NEW address; the old address keeps
working until that link is clicked and the recipient explicitly confirms.
The OLD address is also notified — both when the change starts and when it
completes — so a silent account takeover isn't possible. Clicking the link
lands on a ConfirmEmail screen that applies the change only after an
explicit tap.

## User stories

### Story 1: Admin starts an email change

**As an** admin
**I want to** set a new sign-in email for another grown-up in my family
**so that** their account moves to their current email address without
losing access to their account in the meantime.

#### Acceptance criteria

**Scenario: Admin sends a confirm link to a new address**

- **Given** I am signed in as an admin and viewing Manage Members
- **And** a grown-up "Yusuf" has a sign-in email and no change already pending
- **When** I choose "Change email" on Yusuf's card and submit a new address
- **Then** a one-time confirm link is emailed to the NEW address
- **And** a heads-up notice (no action link) is emailed to Yusuf's OLD address
- **And** Yusuf's card shows "Confirm the new email" with the pending address
- **And** Yusuf can still sign in with his OLD email until the link is confirmed

**Scenario: The new address already belongs to another Family Hub account**

- **Given** I am an admin on Manage Members
- **When** I submit an email that is already registered to a different account
- **Then** the request is rejected
- **And** no confirm email is sent

**Scenario: A non-admin cannot start or cancel a change**

- **Given** I am signed in as an adult, teen, or guest (not admin)
- **When** I attempt to start or cancel an email change for any member
- **Then** the request is rejected

**Scenario: A non-admin never sees a grown-up's sign-in email or pending change**

- **Given** I am signed in as an adult, teen, or guest (not admin)
- **When** I view Manage Members
- **Then** every member's sign-in email and any pending change are hidden from me
- **And** no "Change email" or pending-change controls are shown

### Story 2: Recipient confirms the new email

**As the** grown-up whose email is being changed
**I want to** open the link I was emailed and explicitly confirm it
**so that** my account starts using the new address, and a scanned or
prefetched link can never spend the confirmation on my behalf.

#### Acceptance criteria

**Scenario: Opening the link shows a confirm step, not an instant change**

- **Given** an admin started an email change for me and I received the confirm link
- **When** I open the link
- **Then** I land on a ConfirmEmail screen showing "Confirm your new email" and a button
- **And** nothing about my account has changed yet

**Scenario: Tapping confirm applies the change**

- **Given** I am on the "Confirm your new email" screen from a valid link
- **When** I tap "Confirm email change"
- **Then** the screen shows "Email updated" with my new sign-in email
- **And** a heads-up notice is emailed to my OLD address confirming the change
- **And** a "Back to the family" button returns me to the family

**Scenario: An expired, already-used, or cancelled link shows a clear message**

- **Given** the link has already been confirmed once, or 24 hours have passed, or an admin cancelled the change
- **When** I tap "Confirm email change"
- **Then** I see "This link has expired" with no email address shown
- **And** nothing about my account is changed

**Scenario: A transient failure shows a retryable error, not "expired"**

- **Given** I am on the "Confirm your new email" screen from a valid, unexpired, unused link
- **When** I tap "Confirm email change" and a transient failure occurs (e.g. the Supabase
  update fails, or the local apply fails right after Supabase succeeds)
- **Then** I see "Something went wrong" with a "Try again" button
- **And** I am never told the link has expired for a failure that may still be retryable

### Story 3: Admin manages a pending change

**As an** admin
**I want to** resend or cancel a pending email change
**so that** I can recover from a typo or a change of mind before the
recipient confirms the link.

#### Acceptance criteria

**Scenario: Admin resends the confirm link**

- **Given** a member has a pending email change
- **When** I choose Resend on their card
- **Then** a fresh one-time link is emailed to the same pending address
- **And** the previous link stops working

**Scenario: Admin cancels a pending change**

- **Given** a member has a pending email change
- **When** I choose "Cancel change" on their card
- **Then** the pending request is dropped
- **And** the member's card no longer shows a pending state
- **And** the member's sign-in email is unchanged

## Out of scope

- A grown-up changing their OWN email (self-service) — this ticket covers
  only the admin-initiated flow.
- Changing a kid's PIN-login identity — kids don't have a sign-in email
  (ADR 0009).
- Per-target throttling beyond the one-pending-change-per-member database
  constraint, drift monitoring/alerting on the rare Supabase-succeeded-but-
  local-apply-failed case, and revoking the target's other active sessions
  on a completed change — tracked as follow-ups, not blocking for v1.

## Open questions

- None outstanding.

## Success metrics

- Zero cross-tenant or cross-member email changes (verified by the
  single-use, hashed-token design + admin-only start/cancel).
- Admins can recover from a mis-typed new address without engineering
  support (Resend / Cancel cover it).
- Zero silent account takeovers — the OLD address always gets a signal
  (start + completion notices), so an unexpected change is always
  detectable by the person it happened to.
