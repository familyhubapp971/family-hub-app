# Feature: Change a grown-up's sign-in email

**Jira:** [FHS-510](https://qualicion2.atlassian.net/browse/FHS-510)
**Status:** shipped
**Owner:** product-manager

An admin can update any grown-up's sign-in email from Manage Members. A
one-time confirm link is emailed to the NEW address; the old address keeps
working until that link is clicked. Clicking it lands on a ConfirmEmail
screen that applies the change.

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
- **And** Yusuf's card shows "Confirm the new email" with the pending address
- **And** Yusuf can still sign in with his OLD email until the link is clicked

**Scenario: The new address already belongs to another Family Hub account**

- **Given** I am an admin on Manage Members
- **When** I submit an email that is already registered to a different account
- **Then** the request is rejected
- **And** no confirm email is sent

**Scenario: A non-admin cannot start or cancel a change**

- **Given** I am signed in as an adult, teen, or guest (not admin)
- **When** I attempt to start or cancel an email change for any member
- **Then** the request is rejected

### Story 2: Recipient confirms the new email

**As the** grown-up whose email is being changed
**I want to** click the link I was emailed
**so that** my account starts using the new address.

#### Acceptance criteria

**Scenario: Clicking a valid link applies the change**

- **Given** an admin started an email change for me and I received the confirm link
- **When** I open the link (I may or may not be signed in)
- **Then** I land on a ConfirmEmail screen showing "Email updated"
- **And** it shows my new sign-in email
- **And** a "Back to the family" button returns me to the family

**Scenario: An expired, already-used, or invalid link shows a clear message**

- **Given** the link has already been clicked once, or 24 hours have passed, or an admin cancelled the change
- **When** I open the link
- **Then** I see "This link has expired" with no email address shown
- **And** nothing about my account is changed

### Story 3: Admin manages a pending change

**As an** admin
**I want to** resend or cancel a pending email change
**so that** I can recover from a typo or a change of mind before the
recipient clicks the link.

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

## Open questions

- None outstanding.

## Success metrics

- Zero cross-tenant or cross-member email changes (verified by the
  single-use, hashed-token design + admin-only start/cancel).
- Admins can recover from a mis-typed new address without engineering
  support (Resend / Cancel cover it).
