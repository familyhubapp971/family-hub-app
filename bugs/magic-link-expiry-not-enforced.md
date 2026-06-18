---
status: fixed (FHS-331)
date: 2026-06-16
found-by: oduniyi (manual exploration)
severity: high (security — expired credential still valid)
---

# Magic sign-in link still works ~9 hours after the promised 1-hour expiry

## What the user sees

A magic sign-in email created at **09:17** still signed the user in
successfully when the link was clicked at **18:45** — about 9.5 hours
later. The email itself states: _"This link works once and expires in
1 hour."_

Example link (from the email, now spent):

```
https://maolytpqazmykjzdybtj.supabase.co/auth/v1/verify
  ?token=…&type=magiclink&redirect_to=https://fhapp.up.railway.app/auth/callback
```

## What should happen

- A magic link clicked **more than 1 hour** after it was issued must be
  **rejected** — the user lands on `/auth/callback` and sees a clear
  "this link has expired, request a new one" message, and is NOT signed
  in.
- A fresh link (under the expiry window) signs the user in as today.
- The expiry the email promises ("1 hour") must match the actual
  enforced window.

## Why this matters (security)

The link is a **bearer credential** — anyone holding it can sign in as
that user. Promising 1-hour expiry but honouring it for 9+ hours widens
the window in which a leaked, forwarded, or device-cached email can be
abused to take over the account. This is a real account-takeover
exposure, not just a copy mismatch.

## Actual root cause (FHS-331 — confirmed)

The original hypothesis (a long `mailer_otp_exp`) was **wrong**: the
staging project's `mailer_otp_exp` is already `3600` (verified via the
Supabase Management API), and the SMTP block is intact. So Supabase
_does_ reject an hours-old link at `/auth/v1/verify` — it redirects to
`/auth/callback` with an error in the URL hash
(`#error=access_denied&error_code=otp_expired&error_description=…`).

The real bug was **client-side**: `AuthCallbackPage` ignored that error
hash entirely. It only handled the PKCE `?code=` exchange, then checked
`supabase.auth.getSession()`. A user who had signed in earlier that day
still had a **persisted session in localStorage**, so the expired link
landed on the callback, the error was ignored, `getSession()` returned
the stale session, and the page navigated to `/dashboard` — making the
expired link _look_ like it had worked.

## Fix (shipped)

`AuthCallbackPage` now reads the auth error from the redirect URL
(hash + query) on first render and, if present:

1. shows a clear message ("Your sign-in link has expired. Request a new
   one to log in." / "invalid or already used"),
2. **does not navigate into the app** (short-circuits to the error state
   before the navigate effect runs — no stale-session race), and
3. **signs out**, so an expired link can never leave the user signed in
   via a previously persisted session.

`mailer_otp_exp = 3600` already matches the email's "1 hour" promise, so
no Supabase config change was needed. Covered by an `AuthCallbackPage`
unit test (expired hash + stale session → expired message, no nav,
signOut called).

## Acceptance criteria

**Scenario: expired link is rejected**

- Given a magic link issued more than 1 hour ago
- When the user opens it
- Then they are not signed in
- And they see an "expired link — request a new one" message

**Scenario: fresh link still works**

- Given a magic link issued within the expiry window
- When the user opens it
- Then they are signed in successfully

**Scenario: promise matches enforcement**

- Given the email says "expires in 1 hour"
- Then the Supabase `mailer_otp_exp` is `3600` (or lower)
