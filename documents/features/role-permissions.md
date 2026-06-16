# Feature: Role & permission model (admin vs normal user)

**Jira:** [FHS-333](https://qualicion2.atlassian.net/browse/FHS-333) (epic)
**Status:** draft
**Owner:** product-manager
**ADR:** [0015 — role model: admin vs normal user](../decisions/0015-role-model-owner-flag.md)

Family Hub is multi-tenant — each family is a tenant, and members share one
roster with a `role` (admin / adult / teen / child / guest). Today permission
is a single blunt rule: the member themselves, OR any admin, OR any **adult**
can manage almost anything. In the legacy app there were two kinds of
grown-up: the one **admin** (full rights, including editing a habit sticker on
a previous day) and everyone else, a **normal user**. Multi-tenancy blurred
that line — a non-admin adult now gets admin-only powers, most visibly the
ability to rewrite a past day's stickers.

This feature restores the legacy two-tier model in the tenancy world:
**admin** (full rights) and **normal user** (everyday rights only). The family
registrant is an admin. An admin can make any **non-child** member an admin or
a normal user. Kids (teen/child) are scoped to their own data and can never be
admins. No new role or flag — just a tighter permission boundary plus a
member-management action.

## Rights matrix

Key: ✓ = allowed · ✗ = blocked · **self** = only on their own record/data.
"Normal user" = an adult who is not an admin (`role = 'adult'`).

| Action                                                    | Admin | Normal user | Teen | Child        |
| --------------------------------------------------------- | ----- | ----------- | ---- | ------------ |
| **My World — economy & history**                          |       |             |      |              |
| Log / edit a CURRENT-week sticker (any member)            | ✓     | ✓           | self | self         |
| Edit a PAST-day sticker (backdate) — _the named gap_      | ✓     | ✗           | ✗    | ✗            |
| Log a FUTURE-day sticker                                  | ✗     | ✗           | ✗    | ✗            |
| Close / finalize a week                                   | ✓     | ✗           | ✗    | ✗            |
| Re-open / un-finalize a closed week                       | ✓     | ✗           | ✗    | ✗            |
| Run the rewards shop (redeem current balance)             | ✓     | ✓           | ✗    | self-request |
| Change conversion rate / economy settings                 | ✓     | ✗           | ✗    | ✗            |
| Manually adjust a member's cash balance                   | ✓     | ✗           | ✗    | ✗            |
| **Members & access**                                      |       |             |      |              |
| Invite / add a member                                     | ✓     | ✗           | ✗    | ✗            |
| Set / reset a child PIN                                   | ✓     | ✗           | ✗    | ✗            |
| Edit another member's profile                             | ✓     | ✗           | ✗    | ✗            |
| Make a member an admin / a normal user                    | ✓     | ✗           | ✗    | ✗            |
| Make a child an admin                                     | ✗     | ✗           | ✗    | ✗            |
| Remove / delete a member                                  | ✓     | ✗           | ✗    | ✗            |
| Wipe family data / delete the family                      | ✓     | ✗           | ✗    | ✗            |
| Manage billing / subscription                             | ✓     | ✗           | ✗    | ✗            |
| **Shared content**                                        |       |             |      |              |
| Edit meals / calendar / assignments / noticeboard / tasks | ✓     | ✓           | ✗    | ✗            |
| Edit Journal / Learn entries                              | ✓     | ✓           | self | self         |
| **Self & visibility**                                     |       |             |      |              |
| Edit own profile                                          | ✓     | ✓           | ✓    | ✓            |
| View another member's data                                | ✓     | ✓           | ✗    | ✗            |
| View own data                                             | ✓     | ✓           | ✓    | ✓            |

## User stories

### Story 1: Registrant is the admin; admins set who else is admin or normal

**As a** person registering a new family
**I want** to be the admin, and to choose who else is an admin or a normal user
**so that** the family's controls stay with the people I trust.

**Scenario: Registrant becomes an admin**

- **Given** I register a new family and become its first member
- **When** my member record is created
- **Then** my role is `admin`

**Scenario: Admin promotes an adult to admin**

- **Given** I am an admin and Bola is a normal user (adult)
- **When** I make Bola an admin
- **Then** Bola has admin rights

**Scenario: Admin sets an admin back to a normal user**

- **Given** I am an admin and Bola is an admin
- **When** I set Bola to a normal user
- **Then** Bola keeps only normal-user rights

**Scenario: A child cannot be made an admin**

- **Given** I am an admin and Aisha is a child
- **When** I try to make Aisha an admin
- **Then** the request is rejected and Aisha stays a child

### Story 2: Only an admin can do the legacy admin-only actions

**As an** admin
**I want** the sensitive, historical, and irreversible actions limited to admins
**so that** a normal user can't rewrite history or change the family's setup.

**Scenario: Normal user is blocked from editing a past-day sticker**

- **Given** I am a normal user (adult, not admin)
- **When** I try to change a sticker on a day before today
- **Then** the request is rejected with a 403 "admin-only" error
- **And** the past-day edit control is not shown to me

**Scenario: Admin edits a past-day sticker**

- **Given** I am an admin
- **When** I change a past-day sticker
- **Then** the change is saved with my member id and a timestamp

**Scenario: Normal user keeps everyday actions**

- **Given** I am a normal user
- **When** I log/edit a current-week sticker or edit meals/calendar/tasks
- **Then** the change is saved

**Scenario: Normal user is blocked from setup + destructive actions**

- **Given** I am a normal user
- **When** I try to change a conversion rate, remove a member, or wipe data
- **Then** the request is rejected with a 403 "admin-only" error

### Story 3: Children and teens cannot escalate their own access

**As a** parent
**I want** children and teens to be unable to grant themselves powers
**so that** the family's controls stay with the adults.

**Scenario: Child attempts to make themselves an admin**

- **Given** I am signed in as a child (PIN login)
- **When** I send a request to set my own role to admin
- **Then** the request is rejected with a 403 "forbidden" error
- **And** my record is unchanged

**Scenario: Teen attempts to change another member's role**

- **Given** I am signed in as a teen
- **When** I try to change a sibling's role
- **Then** the request is rejected with a 403 "forbidden" error

## Story → ticket map

| Story                                                                              | Ticket                                                     | Points |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| Onboarding registrant is admin; admins set members admin/normal (never a child)    | [FHS-334](https://qualicion2.atlassian.net/browse/FHS-334) | 5      |
| Legacy admin-only actions are admin-only (past-day stickers, economy, destructive) | [FHS-335](https://qualicion2.atlassian.net/browse/FHS-335) | 5      |
| Centralize the admin check + hide admin-only UI + child-can't-be-admin guard + RLS | [FHS-336](https://qualicion2.atlassian.net/browse/FHS-336) | 5      |

(The earlier owner-tier stories FHS-337/338/339 were cancelled when the model
was simplified.)

## Out of scope

- A separate "owner / super user" tier (the earlier, abandoned design).
- Custom / per-family permission editing — fixed two-tier model only.
- Per-surface granular delegation (e.g. "meals admin" vs "calendar admin").
- A browsable audit-log viewer — sensitive edits record who/when, but the
  history screen is a later ticket.

## Open questions

- Should an admin be able to remove **guests** specifically, or are guests
  out of scope for now?
- Member removal — soft-delete (keep history) or hard-delete?
- Is there ever a case for a normal user (adult) closing a week, or is that
  firmly admin-only? (Currently admin-only.)

## Success metrics

- 0 non-admin past-day sticker edits succeed after rollout (server logs).
- The family registrant is an admin in 100% of new sign-ups.
- 0 children/teens ever hold an admin role (continuous invariant).
