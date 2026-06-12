---
status: in-jira: pending
sprint: 442 (Sprint 3 — Modules & Gating)
type: manual-test-pass
---

# Manual E2E test pass — Sprint 3 (Modules & Gating) close

Founder demo checklist on staging (`https://fhapp.up.railway.app`).
Mark Result as Pass / Fail / Blocked; add Notes. File a bug doc in
`bugs/` for every Fail.

## Section A — Post-login redesign (epic FHS-260, steps 1–5)

| #   | Step                                                | Expected outcome                                                                                         | Result | Notes |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ | ----- |
| A1  | Log in, land on the dashboard                       | Top bar: family-name hero, profile pill, red Logout button, tab row with icons                           |        |       |
| A2  | Look at the Today tab                               | 4-up member cards; kids show habit bar + week streak + "View World"; adults show newest open task        |        |       |
| A3  | Check Today's Snapshot + sidebar                    | 3 round stat tiles (X/Y ratios); purple Family Goals card with Kids' Star Balances; Recent Activity      |        |       |
| A4  | Open Meals                                          | Day cards with Breakfast/Lunch/Dinner/Snack columns, colour-coded per person, Weekly pills, filter pills |        |       |
| A5  | Add a family meal + a per-kid meal in the SAME slot | Both save and show; Today's "Meals planned" counts the slot once                                         |        |       |
| A6  | Open Calendar                                       | School / Home sub-tabs (opens on School); day list with When/Where/Wear; add an activity                 |        |       |
| A7  | On a phone (or narrow window) open the Welcome page | Pricing link visible and tappable                                                                        |        |       |

## Section B — Onboarding & membership (epic FHS-272)

| #   | Step                                           | Expected outcome                                                                   | Result | Notes |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------ | ----- |
| B1  | Fresh signup with a new email                  | Sign-in email arrives from FamilyHub <noreply@fhapp.co>                            |        |       |
| B2  | Create the family                              | "Your name" is asked; you appear as "<your name> — Admin" (no guessed name)        |        |       |
| B3  | Wizard members step                            | You're pinned as "You · Admin"; add the other parent WITH their email; add a child |        |       |
| B4  | Finish setup → dashboard                       | No duplicate of you; invited parent's card shows "Pending — hasn't signed up"      |        |       |
| B5  | Open the invite email (other parent) → sign in | They land on YOUR family's dashboard; pending chip clears                          |        |       |
| B6  | Profile menu → Manage members                  | Card grid; Invite Parent + Add Child buttons; pending box with Resend              |        |       |
| B7  | Make the (now active) other parent admin       | Role flips to Admin; your own "Remove admin" is blocked (last-admin / self rules)  |        |       |
| B8  | Add a child with an age                        | Card shows "Child (6)"-style badge; Set PIN available                              |        |       |

## Section C — Fixes verified this sprint

| #   | Step                                     | Expected outcome                                                                         | Result | Notes |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ----- |
| C1  | Pending parent's card → Make admin       | Button visible but greyed out, tooltip "Available once they finish signing up" (FHS-278) |        |       |
| C2  | Log in with an email that has no account | Plain message: "No account found for this email - create an account first…" (FHS-279)    |        |       |
| C3  | Parent member cards on Today             | Show task names (e.g. "Grocery run & Bills"), never "0/5 habits" (FHS-273)               |        |       |

## Summary

| Result             | Count |
| ------------------ | ----- |
| Pass               |       |
| Fail               |       |
| Blocked            |       |
| New bug docs filed |       |

## Known bugs already filed

| Bug                         | Affects rows |
| --------------------------- | ------------ |
| (none open at sprint close) |              |
