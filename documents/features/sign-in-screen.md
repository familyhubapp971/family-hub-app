# Feature: Sign-in screen

**Jira:** [FHS-573](https://qualicion2.atlassian.net/browse/FHS-573) (design alignment),
[FHS-578](https://qualicion2.atlassian.net/browse/FHS-578) (email box to button gap),
[FHS-586](https://qualicion2.atlassian.net/browse/FHS-586) (email box colour + helper copy),
[FHS-360](https://qualicion2.atlassian.net/browse/FHS-360) (kid sign-in),
[FHS-237](https://qualicion2.atlassian.net/browse/FHS-237) (the card)
**Status:** shipped
**Owner:** product-manager
**Design:** Magic Patterns `kudjspxd3xxroueg5jw11o`, `pages/Login.tsx`

One card at `/login` with a Parent / Kid toggle. Parents get a passwordless
magic link or Google. Kids pick their face and type a PIN.

## User stories

### Story 1: A kid signs in without reading

**As a** child using the family tablet
**I want** to tap my own face and type my PIN
**so that** I can get into my world without an email address or a password.

#### Acceptance criteria

**Scenario: Picking a face opens that child's PIN**

- **Given** a kid opens the sign-in card and chooses "I'm a Kid"
- **When** they tap their face
- **Then** the row of faces is replaced by their avatar, their name and a PIN box
- **And** a "Back" control returns them to the faces

**Scenario: A sibling can take over**

- **Given** one child has started typing a PIN
- **When** a sibling presses Back and picks their own face
- **Then** the first child's part-finished attempt is discarded and cannot sign anyone in

### Story 2: The screen matches the design

**As the** founder
**I want** the shipped screen to match the Magic Patterns design
**so that** what I approve is what families see.

#### Acceptance criteria

**Scenario: Kid sign-in matches the design**

- **Given** a visitor picks "I'm a Kid"
- **When** the picker and the PIN step render
- **Then** they match the Magic Patterns design in layout, cards, avatar and PIN row

**Scenario: The transitions are there**

- **Given** a visitor moves between parent, kid picker and PIN entry
- **When** each step changes
- **Then** the arriving step slides in, and reduced-motion users get a plain swap

**Scenario: No accessibility regression**

- **Given** the ported screen
- **When** it is measured
- **Then** every control is at least 44px, focus rings are visible, and inputs keep their labels

## Behaviour as shipped

- **Two steps for kids.** Pick a face, then a focused view of that child:
  avatar disc, name, "Enter your PIN", and the PIN row, with a Back control
  above. The faces are replaced rather than left on screen underneath.
- **Coloured tiles.** Each face sits on a coloured tile with a white avatar
  disc inside it, matching the design.
- **The faces fill the card** (FHS-577). Two sit side by side at full width.
  Three squeeze into one row at a smaller size rather than leaving one
  stranded on its own line. One renders alone rather than half a grid.
- **Motion.** Panels and steps fade up on the way in and out, and the card
  itself eases to its new height rather than snapping between three
  differently sized views. `popLayout` takes the outgoing view out of flow at
  once, so the arriving one is never held waiting for it. Reduced motion gets
  an instant swap and no height animation.
- **The swap settles in one movement** (FHS-584). The arriving panel and the
  card's height both run for 260ms, so the content no longer lands before the
  card has stopped moving under it, and the leaving panel clears in 120ms so
  the two are not crossing for long.
- **Height measuring** uses a `ResizeObserver` on the live panel. Where that
  does not exist the card simply uses auto height rather than pinning itself
  to a stale measurement.
- **Parent side** stays passwordless: one email field, a magic link, or
  Continue with Google.
- **The email box reads as the thing to fill in, not as disabled**
  (FHS-586). It is white with a black border (the shared Input's `dark`
  variant), matching the design's boxes elsewhere on this card; the
  shared component's default gray-fill variant used elsewhere in the app
  is unchanged. The helper line above it reads "We will email you a link
  that signs you in. No password needed."
- **The button sits close under the email box** (FHS-578). The slot that
  reserves room for an error lives inside the field's own wrapper, so the
  form's stacking gap is counted once rather than above and below it. The
  space between the box and the button is 24px, and one line of error text
  fits the reserved slot exactly, so the button never moves when an error
  appears or clears.

## Deliberate deviations from the Magic Patterns design

| Deviation                                   | Why                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parent form has no password field           | The product is passwordless by decision (ADR 0011). MP's mock shows email + password and a "Forgot password?" link; building those would contradict how sign-in actually works |
| No "Teen, 14" line under each face          | The faces come from a public endpoint that needs no sign-in. Adding an age would publish a child's age to anyone who knows the family's web address                            |
| Kept the accessible label on the PIN inputs | MP's PIN boxes have no label; a screen reader would read four unnamed boxes                                                                                                    |
| Kids are fetched, not hard-coded            | MP lists two example children; the real screen loads the family's own                                                                                                          |

### The expired link screen (FHS-574 design, FHS-575 build)

A sign-in link lasts an hour and works once. A dead one used to land on the
loading screen's stalled state, saying "This is taking longer than usual."
with a progress bar still creeping along while nothing was loading.

- It has its own screen now, with no progress bar and no suggestion that
  anything is still happening.
- Expired, already used and malformed share one shape: the outcome is the
  same, so only the headline and the line beneath it change.
- Getting a new link happens on that screen. Where we already know the
  address we say it once rather than asking for it again, with "Use a
  different email" for when it is wrong.
- A confirmation follows, so nobody wonders whether it sent.
- A genuinely slow sign-in still shows the loading screen, because that one
  really is waiting.

The design already covers both states, so the two are not in conflict: the
editable box in the mock is the state where the address is unknown. What did
drift was the spacing. The reserved error line sat as its own band above the
button, putting it 32px below the address panel where the design has it
close. Nesting that line brings it to 24px (FHS-578).

## Out of scope

- Password sign-in. The product is passwordless by decision (ADR 0011).

## Known drift elsewhere

`documents/features/auth.md` still describes email + password sign-up and a
password reset. Those stories predate the move to magic links and need a pass
of their own; this doc covers the sign-in screen only.
