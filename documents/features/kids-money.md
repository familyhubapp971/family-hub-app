# Feature: Kids money

**Jira:** [FHS-620](https://qualicion2.atlassian.net/browse/FHS-620) (epic), [FHS-621](https://qualicion2.atlassian.net/browse/FHS-621) (route split), [FHS-622](https://qualicion2.atlassian.net/browse/FHS-622) (this page's body), [FHS-623](https://qualicion2.atlassian.net/browse/FHS-623) (the action sheet), [FHS-627](https://qualicion2.atlassian.net/browse/FHS-627) (documents the endpoints this page reads)
**Status:** shipped
**Owner:** product-manager
**Design:** Magic Patterns editor `kudjspxd3xxroueg5jw11o`, `pages/KidsMoney.tsx` + `components/MoneyActions.tsx`

One-line: one screen per child showing what they have (ready to spend, in
savings, growing, and the total), what a parent can do with it, and a
week-by-week record of what happened, replacing the old Admin Panel's three
look-alike Balance/Savings/History tabs. Every one of the five action
buttons (FHS-623) actually saves to the server: nothing is a no-op or
discarded on close.

## User stories

### Story 1: See one child's money as one story

**As an** admin
**I want** to pick a child and see everything about their money on one
screen
**so that** I don't have to guess which of three tabs holds what I'm
looking for

#### Acceptance criteria

**Scenario: One child's money reads as one story**

- **Given** a parent opens Kids money and picks a child
- **When** the page renders
- **Then** they see what that child can spend, has saved and has growing,
  and a total, without changing tab

**Scenario: A family with one child skips the picker**

- **Given** a family with exactly one child
- **When** the page renders
- **Then** there is no picker to use, just that child

**Scenario: A fresh child does not look broken**

- **Given** a child with no stickers and no finished weeks
- **When** the page renders
- **Then** it says their stickers will show up here once they finish a
  habit, and no figure looks like an error

**Scenario: A failed load says so**

- **Given** the figures cannot be fetched
- **When** the page renders
- **Then** it says nothing is shown rather than something wrong, confirms
  nothing changed, and offers to try again

### Story 2: See what happened week by week

**As an** admin
**I want** a collapsible, newest-first list of a child's weeks
**so that** I can check what a specific week earned, saved and spent
without leaving the page

#### Acceptance criteria

**Scenario: A closed week's breakdown**

- **Given** a child has at least one closed (finalized) week
- **When** I open that week's row
- **Then** I see what it earned, what moved to savings, and what was spent
  on rewards, sourced from that week's real action log

**Scenario: The open week never shows fake zeroes**

- **Given** a child's current week is still open
- **When** I open that week's row
- **Then** it says the week is still open, so nothing has moved to savings
  yet, rather than showing 0 as if the week were finished

### Story 3: Do something with the money, for real (FHS-623)

**As an** admin
**I want** each of the five action buttons to actually save
**so that** a save reflects on the child's figures immediately, and again
after the page reloads, not something the design only pretended to do

#### Acceptance criteria

**Scenario: An action actually saves**

- **Given** a parent moves 5 stickers into savings
- **When** they confirm
- **Then** the child's spendable figure drops by 5, their savings rise by
  5, and both survive a reload

**Scenario: Investing carries the choices**

- **Given** a parent invests behind a habit at 3x with a skipped day taking
  value off
- **When** they confirm
- **Then** the investment is created with that multiplier and that rule,
  not with the defaults

**Scenario: Part of an investment can come out**

- **Given** an investment holding 20 stickers
- **When** a parent takes out 8
- **Then** 8 move to savings and 12 keep growing

**Scenario: The rewards are the family's own**

- **Given** a family that has set up its own reward shop
- **When** a parent opens Claim a reward
- **Then** they see their own rewards, and one costing more than the child
  has cannot be chosen

**Scenario: A failure changes nothing**

- **Given** the save does not reach the server
- **When** it fails
- **Then** the sheet says nothing changed and the figures are untouched

## Where the figures come from

Every number on this page is a real API response; nothing is computed from
invented data. `formatMoney` (`packages/shared/src/money.ts`) turns every
sticker count into money using the child's own currency and sticker rate;
no screen builds a money string by hand.

| Figure                    | Source                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who counts as a child     | `GET /api/members`, filtered with `isKidRole`                                                                                                                                               |
| Ready to spend            | `GET /api/mw/weeks/current` for the week id, then `GET /api/mw/weeks/:id/stats` → `unallocatedStickers`                                                                                     |
| In savings                | `GET /api/mw/financial/savings` → `savedStickers`                                                                                                                                           |
| Growing                   | `GET /api/mw/financial/investments` → sum of `currentValueStickers`                                                                                                                         |
| Currency + sticker rate   | `GET /api/mw/financial/savings` → `currency`, `stickerRate` (the child's own, not a hardcoded 0.5)                                                                                          |
| Week list                 | `GET /api/mw/weeks` (reversed client-side to read newest first)                                                                                                                             |
| A week's "earned" figure  | `GET /api/mw/weeks/:id/stats` → `totalStickers`, fetched for the visible slice (6 weeks), and for older ones only once "show older weeks" is used                                           |
| A closed week's breakdown | `GET /api/mw/weeks/:id/actions`, summarised by `summariseWeekActions` (`packages/shared/src/week-actions.ts`, the same helper the parent My World board's finished-week recap already uses) |

## Deviations from the Magic Patterns design

| In the mock                                                                                        | What shipped, and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/kidsMoney.ts` invented per-week `earned`/`saved`/`spent` numbers                             | Replaced with the real endpoints above. Nothing on this page is mock data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Week-list header showed a running lifetime total of stickers earned                                | Dropped. Computing a true lifetime total means fetching every week's `/stats`, unbounded for a family with a long history. The header keeps the free part (the week count) and drops the invented total.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Each child had a fixed `color` field                                                               | The API has no colour field for a member. The avatar tile colour is derived deterministically from the child's id instead, so it's still stable across visits, and shows the child's real `avatarEmoji` when one is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `bg-kingdom` on the page background                                                                | That utility class doesn't exist in the real Tailwind preset (no `DEFAULT` shade on the `kingdom` token). Used the real class, `bg-kingdom-bg`, which renders the same purple the mock intended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Back button read `from=child` / `child=` query params to retrace a ChildWorld → Kids money journey | Nothing in the app sets those params today (`ChildWorldPage`'s "Kids money" menu link is a plain, un-scoped navigation). Simplified Back to always return to the dashboard rather than build a return path with no caller. The `?child=` param is still honoured if present, so a future deep link can pre-select a child.                                                                                                                                                                                                                                                                                                                                              |
| "Do something with it" opened `components/MoneyActions.tsx`, a full action sheet                   | Built in FHS-623 as `apps/web/src/pages/tenant/money/MoneyActionsSheet.tsx` plus one flow component per action. Every field, preview sentence and confirm button was authored against the ticket's own spec (the Jira "What to cover" table + acceptance criteria), not a literal port of the mock: this agent's toolset for FHS-623 did not include the Magic Patterns MCP tools, so the design itself could not be opened. The result reuses the app's real design-system components (`Dialog`, `ChoiceRow`, `ResultBanner`, `Button`, the new `StickerAmountPicker`) and meets every hard requirement in the ticket (real saves, clamped amounts, a11y, responsive). |
| Week detail only ever showed "moved to savings" and "spent on rewards"                             | Kept both, and additionally show "Invested" and "Cashed out" when they're non-zero, mirroring the same real action outcomes the parent My World board's finished-week recap (FHS-608) already surfaces, so a week that invested or cashed out doesn't read as if nothing happened to that money.                                                                                                                                                                                                                                                                                                                                                                        |
| Claim a reward hardcoded six rewards                                                               | Reads the family's real shop, `GET /api/rewards?memberId=`. A reward costing more than the child's real balance (the server's own `stickerBalance`, not a client guess) cannot be picked: its row is disabled with a "needs N more stickers" note.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Invest and grow never asked for a multiplier or a skipped-day rule                                 | Both are now real fields (`coefficient` 1/2/3/5, `deductible` on/off) and both are sent on `POST /api/mw/financial/investments`, which the server has always accepted but this app had never sent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Take money out of an investment always took the whole thing                                        | Now a `StickerAmountPicker` defaults to the full current value but lets a parent dial it down; whatever is chosen is sent as an explicit `stickers` amount on `POST /investments/:id/withdraw`, never omitted.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| The design's "close the week" chooser, reachable from the same `MoneyActions.tsx`                  | Not built. Closing a week already exists (`CloseWeekDialog.tsx`, `apps/web/src/pages/tenant/child/`), and nothing in the shipped Kids money page reaches that chooser: the five buttons this ticket wires up never lead to it.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Invest and grow's sticker ceiling                                                                  | The server's true ceiling also counts money already saved as cash, converted at the child's rate. The page's own snapshot only tracks spendable stickers + saved stickers (not saved cash), so the picker's ceiling (`available + saved`) is a conservative lower bound: it can under-offer by a few stickers for a family that saves cash rather than stickers, never over-offer. The server stays the final word either way.                                                                                                                                                                                                                                          |

## What the five actions do

| Action                          | Endpoint                                              | Notes                                                                                    |
| ------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Claim a reward                  | `POST /api/rewards/{id}/redeem`                       | Reward list from `GET /api/rewards?memberId=`; unaffordable rewards are disabled         |
| Cash out                        | `POST /api/mw/financial/savings/cashout`              | Draws from savings only; amount picked in stickers, sent to the server as cash           |
| Move to savings                 | `POST /api/mw/financial/savings` (`type: "stickers"`) | Draws from this week's spendable stickers only                                           |
| Invest and grow                 | `POST /api/mw/financial/investments`                  | Sends `coefficient` + `deductible`; habits already invested are excluded from the picker |
| Take money out of an investment | `POST /api/mw/financial/investments/{id}/withdraw`    | Always sends an explicit `stickers` amount, so a partial withdrawal is always available  |

Every confirm is a real POST; a failure shows a plain-words error inline
and leaves the sheet open with nothing changed. On success the sheet shows
a "done" screen with what happened, and the Kids money page re-fetches its
figures in the background (`refreshAfterAction` in `KidsMoneyPage.tsx`), so
the numbers on the page move immediately and still show correctly after a
full reload, since they always come from the same real endpoints.

### Design-system additions

- `packages/ui/src/StickerAmountPicker.tsx`: a whole-number +/- stepper for
  picking a count of stickers, paired with a money preview line. Sibling to
  `AmountPicker`, which works in minor currency units instead.
- `packages/ui/src/Dialog.tsx` gained a real focus trap (Tab/Shift+Tab
  cycle inside the dialog, focus returns to whatever opened it on close)
  and an `align="bottom-sheet"` variant (pinned to the bottom edge on a
  phone, a centred panel from `sm:` up). Both are additive: every existing
  `Dialog`/`ConfirmDialog` consumer keeps its current behaviour unless it
  opts into the new variant.
- `packages/ui/src/ChoiceRow.tsx` gained an optional `disabled` prop, used
  by the reward and habit pickers to grey out an option that cannot be
  chosen.

## Who can see this page

Kids money keeps the same admin-only gate the Admin Panel it replaces had:
a non-admin caller is redirected to the dashboard. FHS-620 (the epic) flags
that the server actually lets an "adult" (not just "admin") move money, and
that the front end has never reflected that split. FHS-622 does not resolve
that: it's an open question the epic still owns.

## Out of scope

- The design's "close the week" chooser (see the deviations table above):
  closing a week already has its own dialog and this ticket doesn't touch it.
- Any change to who is allowed to see or use this page (flagged, not
  decided, by FHS-620).
- The reward shop's catalogue management (unchanged; still reached from
  the child's own world / Earning rules).
- Editing an already-running investment's rule after it's created
  (`POST /investments/:id/settings` exists server-side but nothing in this
  sheet calls it: only new investments set `coefficient`/`deductible`).

## Open questions

- Should "adult" (not just "admin") be able to open Kids money, matching
  what the server already allows for some money actions? Tracked on
  FHS-620.

## Success metrics

- A parent can read a child's full money picture (spend / save / grow /
  total) without switching tabs.
- No support question of the shape "where did the Balance tab go".
- Every one of the five action buttons results in a real, persisted change,
  not a screen that resets itself on close.
