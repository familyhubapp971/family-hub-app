# Feature: Sign-in screen

**Jira:** [FHS-573](https://qualicion2.atlassian.net/browse/FHS-573) (design alignment),
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
- **Motion.** The arriving panel or step slides in over 180ms. We do not wait
  for the outgoing one to leave: making a child watch a cross-fade before
  their PIN box appears is worse than no animation. Reduced motion gets an
  instant swap.
- **Parent side** stays passwordless: one email field, a magic link, or
  Continue with Google.

## Deliberate deviations from the Magic Patterns design

| Deviation                                   | Why                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parent form has no password field           | The product is passwordless by decision (ADR 0011). MP's mock shows email + password and a "Forgot password?" link; building those would contradict how sign-in actually works |
| No "Teen, 14" line under each face          | The faces come from a public endpoint that needs no sign-in. Adding an age would publish a child's age to anyone who knows the family's web address                            |
| Kept the accessible label on the PIN inputs | MP's PIN boxes have no label; a screen reader would read four unnamed boxes                                                                                                    |
| Kids are fetched, not hard-coded            | MP lists two example children; the real screen loads the family's own                                                                                                          |

## Out of scope

- The expired sign-in link screen, which borrows the loading screen today.
  Design in [FHS-574](https://qualicion2.atlassian.net/browse/FHS-574), fix in
  [FHS-575](https://qualicion2.atlassian.net/browse/FHS-575).

## Known drift elsewhere

`documents/features/auth.md` still describes email + password sign-up and a
password reset. Those stories predate the move to magic links and need a pass
of their own; this doc covers the sign-in screen only.
