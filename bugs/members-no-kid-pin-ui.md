---
status: in-jira: FHS-252
date: 2026-05-05
found-by: oduniyi (sprint-2 close manual review)
severity: showstopper
sprint: 441 (Sprint 2 — Demo Slice)
---

# Parents have no way to set a kid's PIN or avatar — kid login can't be set up from the app

**In one line:** we shipped kid login but no parent UI to set a kid's
PIN, so no real family can use it.

- Today: `/t/<slug>/kid-login` works end-to-end if `pin_hash` +
  `is_child` + `avatar_emoji` are set on the member, but the only way
  to set them is direct SQL.
- Fix: on `/t/<slug>/members` an admin can enable kid login per
  member → set 4-digit PIN (typed twice) → pick avatar emoji. "Reset
  PIN" clears the lockout bucket.
- Endpoint: `PUT /api/members/:id/pin` (admin/adult only, bcrypt cost
  10 to match `auth-kid-pin.ts`).

## Acceptance criteria

- Admin enables kid login + sets PIN/emoji on Iman → `/t/khan/kid-login`
  shows Iman, PIN logs her in.
- Admin clicks "Reset PIN" on a locked-out kid → lockout clears.
- A kid POSTs to `PUT /api/members/:id/pin` → 403.
