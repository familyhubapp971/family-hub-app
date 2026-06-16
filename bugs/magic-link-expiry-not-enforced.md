---
status: in-jira: FHS-331
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

## Suspected root cause

Supabase magic links are email OTPs; their lifetime is governed by the
project's **`mailer_otp_exp`** auth setting (a.k.a. "Email OTP
Expiration"), in seconds. The branded email template hard-codes
"expires in 1 hour", but the staging Supabase project's
`mailer_otp_exp` is almost certainly set far higher than `3600`
(Supabase has historically defaulted this to `86400` = 24h in some
flows).

Likely config drift: the auth-config PATCH that sets our SMTP block
(see the email-domain notes) may never have set `mailer_otp_exp`, so it
sits at a long default. The `/auth/v1/verify` endpoint then accepts the
token because, as far as Supabase is concerned, it has not expired.

## Fix direction (to confirm when picked up)

1. `GET` the staging Supabase auth config and read `mailer_otp_exp`.
2. Set `mailer_otp_exp = 3600` (match the email copy) — and **include
   the full SMTP block in the PATCH** so it isn't wiped (known
   gotcha — see the email-config notes). Consider 900–1800s (15–30 min)
   for magic links; founder decision.
3. Re-test: a link older than the window returns an "expired" error at
   `/auth/callback`; a fresh link still works.
4. Confirm `/auth/callback` surfaces a friendly expired-link message
   rather than a silent failure or a successful sign-in.
5. Add a guard that asserts the configured `mailer_otp_exp` value (the
   time-based behaviour itself is hard to unit-test without waiting).

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
