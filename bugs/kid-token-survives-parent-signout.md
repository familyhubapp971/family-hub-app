---
status: in-jira: FHS-253
date: 2026-05-05
found-by: oduniyi (sprint-2 close manual review)
severity: medium
sprint: 441 (Sprint 2 — Demo Slice)
---

# Kid stays logged in on the iPad after a parent logs out

**In one line:** when a parent logs out on the family iPad, the kid's
session token is left behind so the kid is still "logged in".

- Today: `KidLoginPage` writes `fh.kid.token` to `localStorage` on
  success. Nothing clears it — not parent sign-out, not the JWT's
  60-min expiry, not a "switch user" button (there isn't one).
- Fix: `signOutAll()` helper in `auth-context.tsx` clears Supabase
  session + `fh.kid.token` together. Honour `exp` claim on read. Add
  a "Switch user" button on the dashboard when `fh.kid.token` is
  set.
- Latent today (no consumer middleware reads the kid JWT yet);
  becomes user-visible the moment kid-tab gating ships.

## Acceptance criteria

- Parent + kid both signed in → parent clicks "Log out" → both
  sessions cleared.
- Tampered/expired `fh.kid.token` + kid route mounts → token
  dropped, redirected to `/kid-login`.
- Kid clicks "Switch user" → `fh.kid.token` cleared, lands on
  `/kid-login`.
