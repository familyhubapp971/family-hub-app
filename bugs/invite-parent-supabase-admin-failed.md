---
name: invite-parent-supabase-admin-failed
status: fixed (FHS-352)
type: bug
area: invitations
surface: backend
---

# Invite a Parent/Partner fails with "Supabase admin invite failed; row marked expired"

**Sending a parent/partner invite from Manage Members fails — the form shows
"Supabase admin invite failed; row marked expired" and no email is sent.**

Reproduced on the Manage Members page → "Invite a Parent or Partner" with name
"Toonday" / email `oduniyio@gmail.com` → "Send Invite" → red error under the form.

## Technical detail

- The send handler ([apps/api/src/routes/invitations.ts:201-242](apps/api/src/routes/invitations.ts#L201-L242))
  inserts a `pending_invitations` row, then calls Supabase
  `POST /auth/v1/admin/invite` via `inviteUserByEmail`
  ([apps/api/src/lib/supabase-admin.ts:75-100](apps/api/src/lib/supabase-admin.ts#L75-L100)).
- On any non-2xx, it marks the pending row `expired`, logs `invite send failed
(supabase <status>)`, and returns 502 with detail
  "Supabase admin invite failed; row marked expired".
- **Likely root causes (to confirm from the logged `supabase <status>`):**
  1. The email is already a registered Supabase auth user (admin invite returns
     422 for an existing user) — very plausible since `oduniyio@gmail.com` is the
     founder's own account.
  2. `redirectTo` (`<baseUrl>/auth/callback?invite=…`) not in the staging
     Supabase project's allowed redirect URLs.
  3. SMTP / rate-limit on the staging Resend-backed sender (`noreply@fhapp.co`).
- Need the actual `supabase <status>` from the staging API logs to pick the path.
  If (1): the flow should treat "already registered" as a valid invite (link the
  existing auth user / send a tenant-join link) rather than a hard 502.

## Acceptance criteria

**Scenario: inviting a brand-new email sends the invite**

- Given an admin on Manage Members
- When they invite an email with no existing Supabase auth user
- Then the invite email is sent and the pending row stays `pending`

**Scenario: inviting an already-registered email does not hard-fail**

- Given an admin invites an email that already has a Supabase auth account
- When they submit the invite
- Then the system links/joins that user to the family (or shows a clear,
  actionable message) instead of "Supabase admin invite failed"

**Scenario: a genuine provider failure is recoverable**

- Given the Supabase admin call genuinely fails (SMTP/rate-limit)
- When the admin retries after the cause is resolved
- Then a fresh pending row is created and the invite sends (no stuck row)
