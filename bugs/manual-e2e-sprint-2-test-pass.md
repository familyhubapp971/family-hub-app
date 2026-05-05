---
status: in-jira: FHS-251
date: 2026-05-05
found-by: oduniyi (sprint-2 close)
type: manual-test-pass
sprint: 441 (Sprint 2 — Demo Slice)
---

# Manual E2E test pass — Sprint 2 (Demo Slice) — FHS-251

Founder-facing test sheet. Walk through every row, mark **Pass** /
**Fail** / **Blocked**. File a new bug doc in this folder for any
**Fail** (mirror the format of the existing bug files), and link
that doc in the Notes column.

## What you need

| Need               | Detail                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Staging URL or dev | `https://staging.familyhub.app` or `pnpm dev` running locally          |
| Two browsers       | One regular + one incognito so you can play "Sarah" + "Iman" at once   |
| Real email inbox   | You'll click magic-link emails from it twice (signup + invite)         |
| (Optional) iPad    | Sections F + G respond differently on touch — phone is fine if no iPad |

## Plain-English: what should be possible after Sprint 2

> Sarah opens a fresh browser, signs up for "Khan Family", picks her
> family URL, confirms her email, walks through onboarding, and ends
> up on her family dashboard. She invites Yusuf via email, sees Yusuf
> join. On a separate iPad, Iman opens `/t/khan/kid-login`, taps her
> face, types her PIN, and lands on the dashboard with her own
> session.

If any row blocks the next, that's a bug — file it.

---

## A. Marketing + signup

Tickets covered: FHS-220 / 221 / 222 / 26 / 27 / 223 / 224 / 225 / 248

| #   | Step                                                              | Expected outcome                                                                                       | Result | Notes |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ | ----- |
| A1  | Open `/`                                                          | Kingdom-purple landing page; starfield animates (off if reduce-motion)                                 |        |       |
| A2  | Click **Pricing**                                                 | Three plans: Free / Family / Family Pro with prices + CTAs                                             |        |       |
| A3  | Click any **Sign up** CTA                                         | Land on `/signup` with two-card layout (social proof + form)                                           |        |       |
| A4  | Type family name "Khan" + try a duplicate slug                    | Slug auto-fills "khan"; duplicate triggers red error within ~500ms                                     |        |       |
| A5  | Submit with email + family name + free slug                       | Land on `/verify-email` with email echoed back                                                         |        |       |
| A6  | Open magic-link email → click button                              | Land at `/auth/callback` → forwarded to `/t/<slug>/onboarding`                                         |        |       |
| A7  | On `/signup` click **Continue with Google** before filling fields | Should require family name + slug first (currently bypasses — see `google-oauth-skips-signup-form.md`) |        |       |

## B. Onboarding wizard

Tickets covered: FHS-36 / 37 / 38 / 39 / 40

| #   | Step                         | Expected outcome                                                                                               | Result | Notes |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| B1  | Step 1 (welcome) renders     | Stepper at top; connector line cuts through vertical centre of every circle. **FIXED in FHS-255 — re-verify.** |        |       |
| B2  | Pick a timezone + a currency | Searchable IANA list (e.g. Europe/London); ISO 4217 list (GBP/USD/AED)                                         |        |       |
| B3  | Submit final step            | Land on `/t/<slug>/dashboard` with family name in TopNav                                                       |        |       |

## C. Dashboard + 6 tabs

Tickets covered: FHS-227 / 228 / 229 / 230 / 231 / 232 / 233

| #   | Step                                                             | Expected outcome                                                                  | Result | Notes |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ | ----- |
| C1  | Look at TopNav                                                   | Family name + your avatar/initial + a logout menu                                 |        |       |
| C2  | Look at the tab bar                                              | Tabs: **Today**, **Meals**, **Calendar**, **Assignments**, **Notices**, **Tasks** |        |       |
| C3  | Click each tab                                                   | URL updates to `?tab=meals` etc.; clicking **Today** clears the param             |        |       |
| C4  | **Meals** — add a meal for a future day, refresh                 | Meal persists after hard refresh                                                  |        |       |
| C5  | **Calendar** — add an event, refresh                             | Event persists                                                                    |        |       |
| C6  | **Assignments / Notices / Tasks** — add + delete an item per tab | Each item appears, persists, and can be removed                                   |        |       |
| C7  | Family member grid (Today tab or Members link)                   | You appear as `admin` with your avatar                                            |        |       |

## D. Members + invitations

Tickets covered: FHS-91 / 108

| #   | Step                                             | Expected outcome                                                  | Result | Notes |
| --- | ------------------------------------------------ | ----------------------------------------------------------------- | ------ | ----- |
| D1  | Open `/t/<slug>/members` from TopNav             | Page renders with the family list                                 |        |       |
| D2  | Invite a family member by email + pick a role    | Form accepts admin/adult/teen/child/guest; submits without error  |        |       |
| D3  | Look at the new member's row                     | Status badge shows `pending invite`                               |        |       |
| D4  | In incognito, open the invite email → click link | Member logs in → joins khan family → lands on `/t/khan/dashboard` |        |       |
| D5  | Back as Sarah, refresh `/members`                | New member's status flips to `active`                             |        |       |
| D6  | Try inviting the same email again                | Form explains they're already invited / already a member          |        |       |

## E. Multi-tenancy / cross-family isolation

| #   | Step                                                            | Expected outcome                                              | Result | Notes |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------- | ------ | ----- |
| E1  | In incognito sign up a second family (slug "patel"), add a meal | Patel's Meals tab shows the new meal                          |        |       |
| E2  | Switch back to Khan (regular browser)                           | Patel's meal does **NOT** appear anywhere in Khan's dashboard |        |       |
| E3  | While logged in as Khan, hit `/t/patel/dashboard` directly      | Blocked / redirected — no Patel data leaks                    |        |       |

## F. Kid login

Tickets covered: FHS-235 / 236 / 237 / 238

> ⚠️ **Heads up:** Bug **FHS-252** (`members-no-kid-pin-ui.md`) means
> the parent UI doesn't yet let Sarah set a kid's PIN, avatar, or
> `is_child` flag — so this whole flow currently needs a manual
> SQL update to test. If you can't set a PIN, mark every row below
> **Blocked** and link FHS-252.

| #   | Step                                                                             | Expected outcome                                                                       | Result | Notes |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ | ----- |
| F1  | Open `/login`                                                                    | Two big buttons "I'm a parent" / "I'm a kid" at the top                                |        |       |
| F2  | Click "I'm a kid"                                                                | Panel changes to "Hi! Kid log-in lives at your family's link"; URL → `/login?role=kid` |        |       |
| F3  | Click "Switch to parent log-in"                                                  | URL drops `?role=kid`; parent form returns                                             |        |       |
| F4  | Open `/t/Khan/kid-login` (capital K)                                             | Resolves to Khan's family — no 404                                                     |        |       |
| F5  | Open `/t/khan/kid-login` on the family iPad                                      | Family name + avatar grid (each kid with a PIN set)                                    |        |       |
| F6  | Tap a kid's avatar                                                               | PIN keypad opens with kid's name ("Hi Iman — type your PIN.")                          |        |       |
| F7  | Type the right 4-digit PIN                                                       | Auto-advance through digits → "Checking…" → land on `/t/khan/dashboard`                |        |       |
| F8  | Open dev-tools → Application → localStorage                                      | `fh.kid.token` is set                                                                  |        |       |
| F9  | Type 4 wrong digits                                                              | "That PIN didn't match. Try again." in red; digits clear                               |        |       |
| F10 | Type a wrong PIN 5 times in a row                                                | Pane changes to "Too many tries. Wait 10 minutes…" (no live countdown today)           |        |       |
| F11 | Network throttle to Slow 3G → tap Aisha → 4 digits → tap Yusuf mid-flight        | When original request resolves: no `fh.kid.token` written; still on `/kid-login`       |        |       |
| F12 | Parent logs in → logs out via TopNav, then kid logs in, then parent logs back in | `fh.kid.token` cleared at parent log-out (currently broken — see **FHS-253**)          |        |       |
| F13 | Open `/t/khan/kid-login` for a family with zero kid PINs                         | "No kid logins are set up yet" pane (not 404 / not blank)                              |        |       |
| F14 | Open `/t/no-such-family/kid-login`                                               | "Family not found" pane with link back to parent log-in                                |        |       |

## G. Cross-cutting + responsive + a11y

| #   | Step                                  | Expected outcome                                                        | Result | Notes |
| --- | ------------------------------------- | ----------------------------------------------------------------------- | ------ | ----- |
| G1  | Resize dashboard to 375px (iPhone SE) | No horizontal scroll on Today/Meals/Calendar; tabs scroll or stack      |        |       |
| G2  | Resize to 768px (iPad portrait)       | Layout uses more breathing room; nothing breaks                         |        |       |
| G3  | Resize to 1280px (desktop)            | Full multi-column dashboard; no awkward whitespace                      |        |       |
| G4  | Tab through `/login` keyboard-only    | Reach every interactive control; yellow focus ring visible              |        |       |
| G5  | Turn on OS "Reduce motion" setting    | Marketing starfield stops animating; hover lifts → colour-only on cards |        |       |

---

## Summary (fill in as you go)

| Section | Total rows | Pass | Fail | Blocked | New bug docs filed |
| ------- | ---------: | ---: | ---: | ------: | ------------------ |
| A       |          7 |      |      |         |                    |
| B       |          3 |      |      |         |                    |
| C       |          7 |      |      |         |                    |
| D       |          6 |      |      |         |                    |
| E       |          3 |      |      |         |                    |
| F       |         14 |      |      |         |                    |
| G       |          5 |      |      |         |                    |
| **All** |     **45** |      |      |         |                    |

## Promoting to Jira

When the pass is complete, comment the summary table back on
**FHS-251** and transition it to Done. New bugs get their own FHS
tickets in Sprint 3 grooming.

## Known bugs already filed (confirm during the pass)

| Bug doc                                 | Jira    | Sections affected |
| --------------------------------------- | ------- | ----------------- |
| `google-oauth-skips-signup-form.md`     | _open_  | A7                |
| `onboarding-stepper-line-misaligned.md` | _open_  | B1                |
| `members-no-kid-pin-ui.md`              | FHS-252 | F (all rows)      |
| `kid-token-survives-parent-signout.md`  | FHS-253 | F12               |
