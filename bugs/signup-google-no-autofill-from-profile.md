---
status: in-jira: FHS-259
date: 2026-05-06
found-by: oduniyi (FHS-251 manual test pass)
severity: medium
sprint: 441 (Sprint 2 — Demo Slice)
---

# Google sign-up doesn't auto-fill name + email — adds friction instead of removing it

**In one line:** "Continue with Google" makes the user type display name + email anyway, so it gives no speed benefit over the magic-link flow — Google should populate those fields from the profile.

- Today: the Google button only swaps the auth provider. Family name + display name + email are still required upfront, then validated by FHS-256's pre-OAuth gate. A user who clicks Google has typed everything already.
- Fix: only require **family name** + **slug** before Google. After the OAuth callback, take `display_name` (or `full_name`) + `email` from the Supabase `user_metadata` and POST those to `/api/public/tenant`. The user types the one thing Google can't tell us (their family's name) — Google fills the rest.
- File: `apps/web/src/pages/auth/SignupPage.tsx` (drop displayName + email from the Google pre-OAuth gate) + `apps/web/src/pages/auth/AuthCallbackPage.tsx` (read user_metadata, supply defaults to the tenant create call).

## Acceptance criteria

- On `/signup`, before Google: only family name + slug-not-taken are required. Display name + email fields stay visible (in case the user fills them anyway) but are optional on the Google path only.
- Click Google with empty display name + email + valid family name + slug → OAuth fires; post-callback the tenant is created with `displayName = user_metadata.full_name` (fallback to email local-part) + `email = user.email`.
- Email-path validation unchanged — typing family name + display name + email + clicking Continue with email still requires all three.
- New unit test: empty display name + Google + post-callback → tenant create receives the Google profile values.
