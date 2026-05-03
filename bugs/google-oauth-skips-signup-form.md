---
status: open
date: 2026-05-03
found-by: oduniyi (manual exploration)
---

# Google OAuth signup bypasses the family-name / slug capture step

## What the user sees

Clicking **Continue with Google** on `/signup` lands the user straight
into the app with no family name or family URL slug ever entered. Their
Supabase user is created but no tenant exists — the app then breaks
in subtle ways downstream (no `tenants[]` on `/api/me`, dashboard /me
have nothing to redirect to, etc.).

## What should happen

Either:

1. **Pre-OAuth gate** — disable the Google button on `/signup` until
   the family name + slug are valid + available (we already debounce
   slug-availability), then stash both in `sessionStorage`
   (`fh.signup.intent` already exists per FHS-26 / FHS-249) before
   firing the OAuth flow. The OAuth callback then POSTs `/api/public/tenant`
   with the stashed intent, exactly like the email magic-link flow.
2. **Post-OAuth gate** — accept Google with no slug, then redirect to
   a "finish setting up your family" mini-wizard that collects family
   name + slug + creates the tenant before letting the user reach
   `/dashboard`.

Option 1 is consistent with the magic-link flow. Option 2 reduces
drop-off at the auth step. Pick during ticket grooming.

## Suspected cause

`apps/web/src/pages/auth/SignupPage.tsx` wires the Google button to
`supabase.auth.signInWithOAuth({ provider: 'google' })` directly, with
no validation that the form fields (`familyName`, `slug`) have been
filled in. The `AuthCallbackPage` (FHS-249) already reads
`fh.signup.intent` if present, but the signup flow never _writes_ it
on the Google path.

## Blast radius

- Any user who clicks the Google button without typing a family name
  ends up tenant-less.
- `/api/me` returns `tenants: []`, so the new
  `LegacyDashboardRedirect` (FHS-227) bounces them back to `/`.
- `/onboarding` requires `:slug`, so they have nowhere to go.
- This is currently the easiest way to brick a new account.

## Notes for the fixing ticket

- Ensure the magic-link path keeps working unchanged.
- Add a Playwright critical-journey scenario covering Google →
  callback → tenant created → dashboard.
- Update `documents/features/auth.md` Gherkin scenarios to spell out
  the OAuth gate.
