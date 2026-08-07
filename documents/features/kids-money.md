# Feature: Kids money

**Jira:** [FHS-620](https://qualicion2.atlassian.net/browse/FHS-620) (epic), [FHS-621](https://qualicion2.atlassian.net/browse/FHS-621) (route split), [FHS-622](https://qualicion2.atlassian.net/browse/FHS-622) (this page's body), [FHS-627](https://qualicion2.atlassian.net/browse/FHS-627) (documents the endpoints this page reads)
**Status:** shipped (actions pending FHS-623)
**Owner:** product-manager
**Design:** Magic Patterns editor `kudjspxd3xxroueg5jw11o`, `pages/KidsMoney.tsx`

One-line: one screen per child showing what they have (ready to spend, in
savings, growing, and the total), what a parent can do with it, and a
week-by-week record of what happened, replacing the old Admin Panel's three
look-alike Balance/Savings/History tabs.

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

| In the mock                                                                                        | What shipped, and why                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/kidsMoney.ts` invented per-week `earned`/`saved`/`spent` numbers                             | Replaced with the real endpoints above. Nothing on this page is mock data.                                                                                                                                                                                                                                                 |
| Week-list header showed a running lifetime total of stickers earned                                | Dropped. Computing a true lifetime total means fetching every week's `/stats`, unbounded for a family with a long history. The header keeps the free part (the week count) and drops the invented total.                                                                                                                   |
| Each child had a fixed `color` field                                                               | The API has no colour field for a member. The avatar tile colour is derived deterministically from the child's id instead, so it's still stable across visits, and shows the child's real `avatarEmoji` when one is set.                                                                                                   |
| `bg-kingdom` on the page background                                                                | That utility class doesn't exist in the real Tailwind preset (no `DEFAULT` shade on the `kingdom` token). Used the real class, `bg-kingdom-bg`, which renders the same purple the mock intended.                                                                                                                           |
| Back button read `from=child` / `child=` query params to retrace a ChildWorld → Kids money journey | Nothing in the app sets those params today (`ChildWorldPage`'s "Kids money" menu link is a plain, un-scoped navigation). Simplified Back to always return to the dashboard rather than build a return path with no caller. The `?child=` param is still honoured if present, so a future deep link can pre-select a child. |
| "Do something with it" opened `components/MoneyActions.tsx`, a full action sheet                   | Out of scope for FHS-622 (see below). The buttons render and call an `onMoneyAction` prop; FHS-623 builds the sheet.                                                                                                                                                                                                       |
| Week detail only ever showed "moved to savings" and "spent on rewards"                             | Kept both, and additionally show "Invested" and "Cashed out" when they're non-zero, mirroring the same real action outcomes the parent My World board's finished-week recap (FHS-608) already surfaces, so a week that invested or cashed out doesn't read as if nothing happened to that money.                           |

## Known gap: the action buttons don't do anything yet

`Do something with it` renders the same five buttons the design specifies
(Claim a reward, Cash out, Move to savings, Invest and grow, and, only when
the child has something invested, Take money out of an investment). Tapping
one calls `onMoneyAction(action, child)`, a prop `KidsMoneyPage` doesn't
receive a value for yet. **FHS-623 builds the action sheet these buttons
open.** Until that ships, tapping a button is a documented no-op, not a
silent regression: this is the seam that ticket attaches to.

## Who can see this page

Kids money keeps the same admin-only gate the Admin Panel it replaces had:
a non-admin caller is redirected to the dashboard. FHS-620 (the epic) flags
that the server actually lets an "adult" (not just "admin") move money, and
that the front end has never reflected that split. FHS-622 does not resolve
that: it's an open question the epic still owns.

## Out of scope

- The action sheet itself (FHS-623).
- Any change to who is allowed to see or use this page (flagged, not
  decided, by FHS-620).
- The reward shop (unchanged; still reached from the child's own world).

## Open questions

- Should "adult" (not just "admin") be able to open Kids money, matching
  what the server already allows for some money actions? Tracked on
  FHS-620.

## Success metrics

- A parent can read a child's full money picture (spend / save / grow /
  total) without switching tabs.
- No support question of the shape "where did the Balance tab go".
