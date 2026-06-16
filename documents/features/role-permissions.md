# Feature: Role & permission model (Owner tier)

**Jira:** [FHS-333](https://qualicion2.atlassian.net/browse/FHS-333) (epic)
**Status:** draft
**Owner:** product-manager
**ADR:** [0015 — role model: `is_owner` flag over roles](../decisions/0015-role-model-owner-flag.md)

Family Hub is multi-tenant — each family is a tenant, and members share one
roster with a `role` (admin / adult / teen / child / guest). Today permission
is a single blunt rule: the member themselves, OR any admin, OR any adult can
manage almost anything. That worked when one person ran a family, but now that
several people can be admin or adult, powers that used to belong to the single
account holder have leaked to everyone in those roles — most visibly, anyone
can now rewrite history by editing a habit sticker from a previous day.

This feature re-introduces a top authority tier as an **`is_owner` flag** on a
member (not a new role). The family registrant is the first Owner; more Owners
can be added. Regular Admins keep all everyday management. A short, explicit
list of sensitive, historical, or irreversible actions becomes **Owner-only**.
Roles are unchanged; this is a flag layered on top of them.

## Rights matrix

Key: ✓ = allowed · ✗ = blocked · **self** = only on their own record/data.
An Owner is always also an Admin/Adult in role terms, so an Owner inherits
every Admin ✓ plus the owner-only rows.

| Action | Owner | Admin | Adult | Teen | Child |
| --- | --- | --- | --- | --- | --- |
| **My World — economy & history** | | | | | |
| Log / edit a CURRENT-week sticker (any member) | ✓ | ✓ | ✓ | self | self |
| Edit a PAST-day sticker (backdate) — *the named gap* | ✓ | ✗ | ✗ | ✗ | ✗ |
| Log a FUTURE-day sticker | ✗ | ✗ | ✗ | ✗ | ✗ |
| Close / finalize the current week | ✓ | ✓ | ✓ | ✗ | ✗ |
| Re-open / un-finalize a closed week | ✓ | ✗ | ✗ | ✗ | ✗ |
| Run the rewards shop (redeem current balance) | ✓ | ✓ | ✓ | ✗ | self-request |
| Change sticker→cash / reward conversion rate | ✓ | ✗ | ✗ | ✗ | ✗ |
| Change economy settings (allowance rules, caps) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manually adjust a member's cash balance | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Members & access** | | | | | |
| Invite / add a member | ✓ | ✓ | ✗ | ✗ | ✗ |
| Set / reset a child PIN | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit another member's profile | ✓ | ✓ | ✗ | ✗ | ✗ |
| Change a member's role (e.g. teen→adult) | ✓ | ✓ | ✗ | ✗ | ✗ |
| Make / remove an Admin | ✓ | ✗ | ✗ | ✗ | ✗ |
| Make someone an Owner | ✓ | ✗ | ✗ | ✗ | ✗ |
| Remove own Owner flag (demote self) | ✓\* | ✗ | ✗ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ | ✗ |
| Remove / delete a member | ✓ | ✗ | ✗ | ✗ | ✗ |
| Wipe family data / delete the family | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Shared content** | | | | | |
| Edit meals / calendar / assignments / noticeboard / tasks | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit Journal / Learn entries | ✓ | ✓ | ✓ | self | self |
| **Self & visibility** | | | | | |
| Edit own profile | ✓ | ✓ | ✓ | ✓ | ✓ |
| View another member's data | ✓ | ✓ | ✓ | ✗ | ✗ |
| View own data | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Account / tenant settings** | | | | | |
| Manage billing / subscription | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit family name / slug / branding | ✓ | ✓ | ✗ | ✗ | ✗ |

\* allowed only if at least one other Owner remains (last-owner protection).

## User stories

### Story 1: Registrant becomes the first Owner

**As a** person registering a new family
**I want** to be the family's Owner automatically
**so that** the sensitive controls have a clear first holder.

**Scenario: Registrant is flagged as Owner**

- **Given** I register a new family and become its first member
- **When** my member record is created
- **Then** my record has `is_owner = true`
- **And** my role is `admin`
- **And** `/api/me` returns `isOwner: true` for this membership

**Scenario: Existing families backfill exactly one Owner**

- **Given** a family created before this feature, with no Owner flag set
- **When** the backfill runs
- **Then** the earliest-created `admin` member is set `is_owner = true`
- **And** every other member keeps `is_owner = false`

### Story 2: Only an Owner can edit a past-day sticker

**As an** Owner
**I want** to be the only one who can change a habit sticker on a previous day
**so that** the family's history can't be quietly rewritten by every admin.

**Scenario: Owner edits a past-day sticker**

- **Given** I am an Owner
- **And** a sticker exists for a child on a day before today
- **When** I change that past-day sticker
- **Then** the change is saved with my member id and a timestamp

**Scenario: Admin is blocked from editing a past-day sticker**

- **Given** I am an Admin but not an Owner
- **When** I try to change a sticker on a day before today
- **Then** the request is rejected with a 403 "owner-only" error
- **And** the past-day edit control is not shown to me

**Scenario: Anyone can still edit the current week**

- **Given** I am an Admin (not Owner)
- **When** I log or change a sticker for today or a day in the current week
- **Then** the change is saved

### Story 3: Owner manages other Owners and Admins

**As an** Owner
**I want** to promote or demote Owners and Admins
**so that** authority can move as the family changes, safely.

**Scenario: Owner promotes an Admin to Owner**

- **Given** I am an Owner and Bola is an Admin
- **When** I grant Bola the Owner flag
- **Then** Bola passes owner-only checks

**Scenario: Last-owner protection blocks self-demotion**

- **Given** I am the only Owner
- **When** I try to remove my own Owner flag
- **Then** the request is rejected with a 409 "last-owner" error
- **And** I remain an Owner

**Scenario: Transfer ownership**

- **Given** I am an Owner
- **When** I make Bola an Owner and remove my own flag in one action
- **Then** Bola is an Owner and I am not
- **And** the family never drops to zero Owners during the change

### Story 4: Admin is blocked from owner-only actions

**As an** Admin who is not an Owner
**I want** clear, consistent blocking of owner-only actions
**so that** I can't accidentally take an irreversible action.

**Scenario: Admin attempts to change the conversion rate**

- **Given** I am an Admin (not Owner)
- **When** I try to change the sticker→cash rate
- **Then** the request is rejected with a 403 "owner-only" error
- **And** the economy-settings controls are hidden from me

**Scenario: Admin attempts to remove a member**

- **Given** I am an Admin (not Owner)
- **When** I try to remove a member
- **Then** the request is rejected with a 403 "owner-only" error

### Story 5: Children and teens cannot escalate their own access

**As a** parent
**I want** children and teens to be unable to grant themselves powers
**so that** the family's controls stay with the adults.

**Scenario: Child attempts to make themselves an Owner**

- **Given** I am signed in as a child (PIN login)
- **When** I send a request to set my own `is_owner` to true
- **Then** the request is rejected with a 403 "forbidden" error
- **And** my record is unchanged

**Scenario: Teen attempts to change another member's role**

- **Given** I am signed in as a teen
- **When** I try to change a sibling's role to adult
- **Then** the request is rejected with a 403 "forbidden" error

## Story → ticket map

| Story | Ticket | Points |
| --- | --- | --- |
| `is_owner` flag + migration + backfill + `/api/me` | [FHS-334](https://qualicion2.atlassian.net/browse/FHS-334) | 3 |
| Owner-only PAST-day sticker edits (the named gap) | [FHS-335](https://qualicion2.atlassian.net/browse/FHS-335) | 3 |
| Members promote/demote Owner & Admin + last-owner protection | [FHS-336](https://qualicion2.atlassian.net/browse/FHS-336) | 5 |
| Owner-only My World economy (rates, settings, re-open, adjust) | [FHS-337](https://qualicion2.atlassian.net/browse/FHS-337) | 5 |
| Owner-only tenant lifecycle (remove, wipe, transfer, billing) | [FHS-338](https://qualicion2.atlassian.net/browse/FHS-338) | 5 |
| Centralize permission layer + escalation guards + RLS | [FHS-339](https://qualicion2.atlassian.net/browse/FHS-339) | 8 |

## Out of scope

- Custom / per-family permission editing — fixed matrix only for v1.
- Per-surface granular delegation (e.g. "meals admin" vs "calendar admin").
- A browsable audit-log viewer — sensitive edits record who/when, but the
  history screen is a later ticket.
- Time-boxed / temporary ownership.

## Open questions

- **Manual cash-balance adjustment** — defaulted to **Owner-only** (it
  rewrites the ledger like a past-sticker edit). Confirm, or move to Admin.
- **Billing** — defaulted to **Owner-only**. Want a dedicated "billing
  admin" instead?
- Should Admins be able to remove **guests** (but not children/adults)?
- Max number of Owners — cap, or unlimited?
- Member removal — soft-delete (keep history) or hard-delete?

## Success metrics

- 0 non-owner past-day sticker edits succeed after rollout (server logs).
- 100% of existing families have exactly one Owner post-backfill.
- 0 families ever reach zero Owners (continuous invariant; alert if breached).
