# 0019: Role → privilege matrix, formalised + labelled

**Status:** accepted
**Date:** 2026-07-30
**Jira:** [FHS-485](https://qualicion2.atlassian.net/browse/FHS-485) (this ADR + label fix), [FHS-486](https://qualicion2.atlassian.net/browse/FHS-486) (invite rework)

## Context

[ADR 0015](0015-role-model-owner-flag.md) set the two grown-up tiers
(`admin` full rights, `adult` everyday rights) and the detailed rights grid
lives in
[`documents/features/role-permissions.md`](../features/role-permissions.md).
Two gaps remained:

- **The invite flow couldn't create a second admin.** `POST /api/invitations`
  only accepted `adult | teen | guest`: a family where two parents both
  need full rights (edit past days, run the economy, manage members) had no
  way to invite the second parent as anything but a permanently-capped
  "normal user."
- **The Manage Members UI mislabels `adult` as "Parent."** A real parent is
  an `admin`. Labelling the non-admin tier "Parent" tells a founder inviting
  grandma or a sitter that they're inviting a parent, which they aren't,
  and it hides that a genuine co-parent needs the admin invite, not this one.

## Decision

Formalise the five-role privilege matrix (the detailed per-action grid stays
in `documents/features/role-permissions.md`; this is the plain-English
summary every future contributor should read first):

| Role      | Who                                        | Rights                                                                                                                                 |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **admin** | Parent / partner (registrant is one)       | Full: everyday actions **+** past-date edits, week close, economy settings, member management, billing (`isAdmin` in `permissions.ts`) |
| **adult** | Invited grown-up (grandma, cousin, sitter) | Everyday + current/future-day writes. **Not** past-date edits, **not** admin actions (`canManage` in `permissions.ts`)                 |
| **teen**  | Own PIN login                              | View-only on shared family content; writes only their own kid-scoped data (My World, Journal, Learn)                                   |
| **child** | Own PIN login                              | Same as teen: view-only on shared content, writes only their own data                                                                  |
| **guest** | Login, no write rights                     | Read-only everywhere (`canManage` already excludes `guest`)                                                                            |

Two changes ship with this pair of tickets:

1. **Invite flow can grant `admin`.** `POST /api/invitations` accepts
   `admin | adult | teen | guest` (still not `child`: kids use PIN login,
   never the magic-link invite). **Safeguard:** only a caller who is already
   `admin` may set `role: 'admin'` on an invite; a non-admin `adult` inviter
   who tries gets `403`. This lets two parents both hold full rights without
   opening a silent privilege-escalation hole for a normal user.
2. **Label fix, no behaviour change.** The Manage Members role badge for
   `adult` now reads **"Adult"**, not "Parent", matching the matrix above.
   The invite form is renamed **"Invite member"** with an explicit role
   picker (Parent/partner · Adult · Teen · Guest, each with a one-line
   plain-English description) instead of a form that only ever said "Invite
   Parent" while silently sending `role: 'adult'`.

## Consequences

Easier:

- A two-parent (or two-guardian) family can both hold full admin rights
  from day one, via invite, without a separate promotion step.
- The invite form's role picker matches what actually happens on submit,
  no more silent `role: 'adult'` hardcoding regardless of the button label.
- The Manage Members badge stops implying every non-admin adult is "the
  parent."

Harder / follow-ups:

- **Known enforcement gap (not fixed by this ADR):** `POST/PUT/DELETE
/api/events` (`apps/api/src/routes/events.ts`) gates writes on
  `WRITE_ROLES = {admin, adult}` only, there is no date-based check at all.
  The web Calendar tab (`CalendarTabPanel.tsx`) blocks _creating a new
  event_ on a past day client-side, but explicitly allows _editing/deleting
  an existing_ event on a past day for any writer role, including a
  non-admin `adult`: with **no server-side admin gate** backing that up.
  This is the same class of gap ADR 0015 named for My World stickers
  (§ "Consequences → harder"), just not yet closed for Calendar. Filing a
  follow-up ticket under the tech-debt epic ([FHS-205](https://qualicion2.atlassian.net/browse/FHS-205))
  rather than fixing it inside FHS-485/486, which are label + invite-flow
  changes only.
- `documents/features/role-permissions.md` should eventually add a row for
  "invite someone as admin (co-admin)", deferred to when that feature doc
  next gets a pass, since the Gherkin scenarios for it now live directly in
  the invitations test suite.

## Alternatives considered

- **Keep `admin` un-invitable, require a separate "promote to admin" step
  after a normal invite**, rejected: adds a second action for the common
  "invite my co-parent as a full parent" case with no safety benefit, since
  the same admin-only guard would apply to a promotion endpoint anyway.
- **Let any `adult` inviter grant `admin`**, rejected: that's a privilege
  escalation hole (a normal user could hand out full rights to someone they
  choose, bypassing the admin's control over who's an admin, exactly what
  ADR 0015 closed for the `role` PATCH on `/api/members`).
- **Duplicate the full rights matrix in this ADR**, rejected: ADR 0015 +
  `documents/features/role-permissions.md` already own the detailed grid;
  this ADR adds the plain-English summary + the two decisions above and
  cross-links rather than forking the source of truth.
