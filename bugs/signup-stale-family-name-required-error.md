---
status: in-jira: FHS-258
date: 2026-05-06
found-by: oduniyi (FHS-251 manual test pass)
severity: medium
sprint: 441 (Sprint 2 — Demo Slice)
---

# Signup form shows "family name is required" while the field is clearly filled

**In one line:** an inline error from a previous submit attempt sticks around even after the user keeps typing into the field, so a filled form looks broken.

- Today: `setStatus({ kind: 'error', ... })` only clears on the next submit/click. Typing into `familyName` doesn't clear the prior error.
- Fix: when any of the form fields change, if `status.kind === 'error'`, drop back to `'idle'`. One `useEffect` (or onChange wrap) on `[familyName, displayName, email, slug]` covers it.
- File: `apps/web/src/pages/auth/SignupPage.tsx`. Same pattern on `LoginPage.tsx` should be checked too — same drift risk.

## Acceptance criteria

- Submit with empty fields → "family name is required" appears.
- Type into the family-name field → error clears live (within one render).
- Same auto-clear behaviour for the display-name and email errors.
