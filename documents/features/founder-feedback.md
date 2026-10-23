# Feature: Founder feedback page

**Jira:** [FHS-672](https://qualicion2.atlassian.net/browse/FHS-672), [FHS-674](https://qualicion2.atlassian.net/browse/FHS-674), [FHS-675](https://qualicion2.atlassian.net/browse/FHS-675) (epic FHS-417, Beta program and feedback)
**Status:** shipped
**Related:** [Feedback on each screen](screen-feedback.md) (FHS-670, FHS-671)

A private page at **/admin** where the founder reads every family's feedback.
It covers the per-screen form, the in-app survey and the homepage survey.

## How it works

| Part            | What it does                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passcode        | One box and an Open button, centred on the screen. The passcode is a server setting (`FOUNDER_PASSCODE`), never in the code.                                                         |
| Server secret   | `FOUNDER_TOKEN_SECRET`, a long random value, signs the 8-hour pass. Without it on a deployed server the page stays off.                                                              |
| Lockout         | Five wrong tries lock the page for 15 minutes for everyone, whatever address they come from.                                                                                         |
| Staying in      | The page keeps an 8-hour pass in this browser tab. Lock ends it.                                                                                                                     |
| Filters         | Where from, family and screen. Every section below follows them.                                                                                                                     |
| At a glance     | Tiles: answers, people, families, and the average "would recommend" score out of 10.                                                                                                 |
| How it is going | Bars for solves a real problem, easy to use and will keep using it (out of 5: green 4+, yellow 3+, red below). A split bar of very, somewhat or not disappointed without Family Hub. |
| By screen       | One card per screen: answers, people, three mini bars, and the parts mentioned with counts.                                                                                          |
| In their words  | Every written answer as a quote card, sorted into Wishes, What is hard and Other comments, with who, where and when.                                                                 |
| Each person     | A folding card per person (first three open), grouped by visit, with rating dots and labelled quotes.                                                                                |
| Download        | The filtered answers as a spreadsheet. Text that looks like a formula is made safe.                                                                                                  |

## Acceptance criteria

**Scenario: Founder sees the headline numbers first**

- **Given** feedback from two people
- **When** the founder opens /admin
- **Then** tiles show answers, people, families and the average recommend score

**Scenario: Wishes are easy to scan**

- **Given** answers with a wished-for feature
- **Then** each wish shows as a quote card with who said it

**Scenario: Filters still apply**

- **Given** the founder filters to one source
- **Then** every tile, bar and list reflects only that source

**Scenario: Founder opens the feedback page**

- **Given** a family has given feedback on the Meals screen
- **When** I open the founder page and enter the passcode
- **Then** I see "Weekly Meals" in the summary by screen
- **And** I see that family's answer

**Scenario: Wrong passcode is refused**

- **When** I open the founder page and enter a wrong passcode
- **Then** the founder page says the passcode is wrong

**Scenario: Repeated guesses are locked out**

- **Given** five wrong passcodes in a row
- **When** anyone tries again, even with the right passcode
- **Then** they are told to wait (server answers 429)

**Scenario: A burst of parallel guesses cannot skip the lockout**

- **When** someone fires 20 wrong passcodes at once
- **Then** at most 5 of them are checked

**Scenario: The founder page works on a phone**

- **Given** a phone-sized screen
- **Then** the filters stack, the table scrolls inside its box, and the page does not scroll sideways

## How it is tested

The founder chose unit tests for the screen and light server tests (2026-10-23).
There are no browser tests for this page, so the phone layout was checked by
screenshot, not by an automated test.

- **Unit:** the passcode form, every error message, filters, empty states, grouping, the spreadsheet and the pass.
- **Server (real database):** opening the page, the lockout, a parallel burst, no pass, and that only the reader crosses families.

## Decisions

- **Reading across families.** Each family's data is locked to that family. This page reads past that lock through one read-only database reader (`app_founder_feedback`). The founder approved this on 2026-10-23.
- **One shared lockout, not per address.** Someone guessing can change their address but not the shared count. The cost: a stranger guessing can lock the founder out for 15 minutes. A redeploy resets the count.
- **Lock only clears this browser.** A copied pass keeps working until it expires (8 hours).
- **The reader is open to the app's database role.** A database-injection bug anywhere in the api could use it. This matches the existing readers; a narrower role is a possible follow-up.
- **The page sits at /admin.** The server routes are `/api/founder/*`, because `/api/admin` already serves the family settings.

## Out of scope

- Separate logins per team member. Everyone shares the one passcode.
- Replying to feedback from the page.
