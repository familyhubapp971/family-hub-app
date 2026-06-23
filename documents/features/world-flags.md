# Feature: World Flags

**Jira:** FHS-363 (parent World Flags feature epic), FHS-373 (kid-scoped endpoints)
**Status:** in-progress
**Owner:** engineering

## Overview

The World Flags game lets kids explore and learn about country flags.
There are two phases:

- **Phase 2a — Explore:** The kid taps a flashcard to reveal a flag.
  The server records which country codes they have seen.
- **Phase 2b — Learn path:** Flags are grouped into sets of 5 per continent.
  When a kid scores 100% on a set's quiz, the app marks that set complete.
  The next set in the continent unlocks.

Both parent (admin) routes and kid-scoped routes exist.
The parent routes (`/api/world-flags`) require a `memberId` param and standard
adult auth. The kid routes (`/api/kid/world-flags`) use the kid session token —
the kid can only ever access their own data.

---

## User stories

### Story 1: Kid explores a country flag

**As a** child using the World Flags game
**I want** the app to remember which flags I have already revealed
**so that** I can pick up where I left off without re-exploring everything.

#### Acceptance criteria

**Scenario: a kid explores a flag and sees it back**

- **Given** a kid is logged in with a valid kid session
- **When** they POST `/api/kid/world-flags/explore` with `{ countryCode: "GB" }`
- **Then** the response is `{ explored: true }`
- **And** a subsequent GET `/api/kid/world-flags` includes `"GB"` in the `explored` array

**Scenario: exploring the same flag twice is idempotent**

- **Given** a kid has already explored `"US"`
- **When** they POST `/api/kid/world-flags/explore` with `{ countryCode: "US" }` again
- **Then** the response is still `{ explored: true }`
- **And** `"US"` appears exactly once in their explored list

**Scenario: a kid only sees their own flags**

- **Given** kid "Amira" has explored `"JP"`
- **When** sibling "Zayd" GETs `/api/kid/world-flags`
- **Then** Zayd's explored list is empty — he cannot see Amira's flags

---

### Story 2: Kid completes a learn-path set

**As a** child using the World Flags learn path
**I want** the app to track which continent sets I have mastered
**so that** the next set unlocks and I can progress through every continent.

#### Acceptance criteria

**Scenario: a kid completes a learn-path set and sees it back**

- **Given** a kid is logged in
- **When** they POST `/api/kid/world-flags/learn-complete` with `{ continent: "Africa", chunkIndex: 0 }`
- **Then** the response is `{ completed: true }`
- **And** GET `/api/kid/world-flags/learn` returns `{ progress: { Africa: [0] } }`

**Scenario: completing the same set twice is idempotent**

- **Given** a kid has already completed set `1` of `"Europe"`
- **When** they POST the same body again
- **Then** `Europe` still has exactly `[1]` — no duplicate

**Scenario: a kid only sees their own learn progress**

- **Given** kid "Amira" has completed set `0` of `"Asia"`
- **When** sibling "Zayd" GETs `/api/kid/world-flags/learn`
- **Then** Zayd's progress is empty

---

## API endpoints (kid-scoped)

All endpoints require a valid kid session token (`Authorization: Bearer <kid-token>`).
The kid's identity (tenant + member) comes from the token — no `memberId` param.

| Method | Path                                  | Body                                                  | Response                                    |
| ------ | ------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| GET    | `/api/kid/world-flags`                | —                                                     | `{ explored: string[] }`                    |
| POST   | `/api/kid/world-flags/explore`        | `{ countryCode: string(2-3) }`                        | `{ explored: true }`                        |
| GET    | `/api/kid/world-flags/learn`          | —                                                     | `{ progress: Record<continent, number[]> }` |
| POST   | `/api/kid/world-flags/learn-complete` | `{ continent: ContinentEnum, chunkIndex: int(0-60) }` | `{ completed: true }`                       |

Valid continent values: `Africa`, `Asia`, `Europe`, `North America`, `South America`, `Oceania`.

## Out of scope

- Timed-quiz best scores (stay client-side in localStorage, matching legacy behaviour).
- Flag image hosting (served from the web app's static assets).

## Open questions

- None at this time.

## Success metrics

- A kid who exits mid-session returns to the same state (explored flags persisted).
- No cross-kid data leakage (verified by tenant-isolation integration tests).
