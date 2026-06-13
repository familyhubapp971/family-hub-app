---
status: in-jira: FHS-281
sprint: 717 (Sprint 4 — Redesign + Kids)
type: manual-test-pass
---

# Manual E2E test pass — Sprint 4 (Redesign + Kids)

Founder demo test pass. Tick each row **Pass / Fail / Blocked** and add notes.
File a bug doc in `bugs/<slug>.md` for every Fail, then promote it to a Jira
Bug and link it back here.

## Section A — Kid login + kid-only dashboard (FHS-257)

| #   | Step                                                                            | Expected outcome                                                      | Result | Notes |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ | ----- |
| A1  | As a parent, set a child's PIN, then open the kid login and enter that PIN      | Kid dashboard loads — kid-only view, no parent/admin controls visible |        |       |
| A2  | Enter the wrong PIN 3 times in a row                                            | Locked out with a friendly "too many tries" message (rate-limited)    |        |       |
| A3  | While logged in as a kid, try to open a parent-only screen (Members / Settings) | Blocked — the kid token can't reach parent routes                     |        |       |

## Section B — Assignments + Noticeboard redesign (FHS-266)

| #   | Step                                                            | Expected outcome                                                                        | Result | Notes |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ | ----- |
| B1  | Dashboard → Assignments tab                                     | Filter pills (All + one per member); each row shows a coloured avatar dot + name badge  |        |       |
| B2  | Add an assignment (title + member + due date)                   | It appears in the list with the member badge and red due-date                           |        |       |
| B3  | Tick an assignment's circle                                     | Row dims + title strikes through; untick restores it                                    |        |       |
| B4  | Filter to a member who has no assignments                       | Shows "No assignments for this person yet." and the pill stays selected                 |        |       |
| B5  | Noticeboard tab → post a note with an emoji icon + "pin to top" | Note appears as a coloured post-it with the icon, a pin marker, and "From &lt;name&gt;" |        |       |
| B6  | Delete a note via the X                                         | Note removed; a child role sees a friendly "only admins/adults can delete" message      |        |       |

## Section C — Tasks tab: shared family board (FHS-267)

| #   | Step                                              | Expected outcome                                                 | Result | Notes |
| --- | ------------------------------------------------- | ---------------------------------------------------------------- | ------ | ----- |
| C1  | Open the Tasks tab                                | Shows the whole family's tasks (shared board), not just your own |        |       |
| C2  | Add a task assigned to a member, then complete it | The task and its completion are visible to every family member   |        |       |

## Section D — ChildWorld: My World (habits + rewards) (FHS-268)

| #   | Step                                                     | Expected outcome                                                            | Result | Notes |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------- | ------ | ----- |
| D1  | Dashboard → profile dropdown → "View World" on a child   | ChildWorld opens with five tabs (My World, Meals, Calendar, Journal, Learn) |        |       |
| D2  | On My World, tick a habit for a day                      | The sticker balance rises by 1; unticking drops it by 1                     |        |       |
| D3  | In the Rewards shop, find a reward you can't afford      | Its Buy button is disabled                                                  |        |       |
| D4  | Redeem an affordable reward                              | Balance drops by the reward's cost and the redemption is recorded           |        |       |
| D5  | Tap Buy twice quickly on a reward you can exactly afford | Only one purchase goes through — no double-spend / negative balance         |        |       |

## Section E — ChildWorld: Meals + Calendar (read-only) (FHS-269)

| #   | Step                                  | Expected outcome                                                                            | Result | Notes |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------- | ------ | ----- |
| E1  | Open the Meals tab in a child's world | Shows this child's meals + whole-family meals, grouped by day; no add/edit/delete           |        |       |
| E2  | Open the Calendar tab                 | Shows this child's + whole-family events by day with time / place / what-to-wear; read-only |        |       |
| E3  | Open a child who has no meals/events  | Friendly empty states ("No meals planned…", "Nothing on your calendar yet")                 |        |       |

## Section F — ChildWorld: Journal + Learn (FHS-270)

| #   | Step                                        | Expected outcome                                                                                    | Result | Notes |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ | ----- |
| F1  | On the Journal tab, write and save an entry | Entry appears newest-first; refreshing the page keeps it                                            |        |       |
| F2  | Open a different child's world              | That child does NOT see the first child's journal entries (privacy)                                 |        |       |
| F3  | Open the Learn tab                          | Six subject cards (Maths, Reading, World Flags, Logic, Science, Creative), each with a progress bar |        |       |

## Section G — Responsive sweep (all of the above)

| #   | Step                                                    | Expected outcome                                             | Result | Notes |
| --- | ------------------------------------------------------- | ------------------------------------------------------------ | ------ | ----- |
| G1  | View the kid dashboard + ChildWorld on a phone (≤640px) | Single-column, tap targets ≥44px, no horizontal scroll       |        |       |
| G2  | View on a tablet and desktop                            | Multi-column grids fill the width; nothing overlaps or clips |        |       |

## Summary

| Metric             | Count |
| ------------------ | ----- |
| Total steps        | 24    |
| Pass               |       |
| Fail               |       |
| Blocked            |       |
| New bug docs filed |       |

## Known bugs already filed

| Bug doc    | Affects rows |
| ---------- | ------------ |
| (none yet) |              |
