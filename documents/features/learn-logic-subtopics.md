# Feature: Logic sub-topics in Learn lessons

**Jira:** FHS-371
**Status:** in-progress
**Owner:** backend-developer

## User stories

### Story 1: A kid browses Logic questions by sub-topic

**As a** kid using the Learn tab
**I want** to filter Logic lesson questions by sub-topic (Patterns, Odd One Out, If…Then, Sorting)
**so that** I can practise one skill at a time

#### Acceptance criteria

**Scenario: a kid explores Logic sub-topics**

- **Given** a kid is logged in with a valid session
- **When** the kid fetches `GET /api/kid/learn/Logic/questions?difficulty=easy&subtopic=patterns`
- **Then** the response status is 200
- **And** all returned questions have `subtopic: "patterns"`

**Scenario: no subtopic returns all Logic questions for that difficulty**

- **Given** a kid is logged in
- **When** the kid fetches `GET /api/kid/learn/Logic/questions?difficulty=easy` (no subtopic)
- **Then** the response includes questions from all four sub-topics

**Scenario: invalid subtopic is rejected**

- **Given** a kid is logged in
- **When** the kid fetches `GET /api/kid/learn/Logic/questions?subtopic=nonsense`
- **Then** the response status is 400
- **And** the error detail mentions the valid values

### Story 2: A parent views Logic sub-topic questions for their child

**As a** parent
**I want** to fetch Logic questions filtered by sub-topic for my child
**so that** I can see what content is available per skill area

#### Acceptance criteria

**Scenario: parent fetches Logic questions by sub-topic**

- **Given** an authenticated parent with manage access to a child member
- **When** the parent fetches `GET /api/learn/Logic/questions?memberId=<id>&subtopic=if-then`
- **Then** the response status is 200
- **And** all returned questions have `subtopic: "if-then"`

## Sub-topic catalogue

| Slug          | Label       | Description                                       |
| ------------- | ----------- | ------------------------------------------------- |
| `patterns`    | Patterns    | Number/shape sequences — "what comes next?"       |
| `odd-one-out` | Odd One Out | Which item doesn't belong in the group?           |
| `if-then`     | If…Then     | Simple conditional reasoning                      |
| `sorting`     | Sorting     | Ordering/grouping (smallest→largest, which group) |

Every (subtopic × difficulty) pair has at least 2 questions. Total Logic bank: ≥ 24 questions (4 subtopics × 3 difficulties × ≥ 2).

## API contract

Both endpoints (kid and parent) accept an optional `?subtopic=` query param:

```
GET /api/kid/learn/Logic/questions?difficulty=easy&subtopic=patterns
GET /api/learn/Logic/questions?memberId=<uuid>&difficulty=easy&subtopic=patterns
```

- Valid values: `patterns`, `odd-one-out`, `if-then`, `sorting`
- Invalid value → 400 `{ error: "invalid request", detail: "subtopic must be patterns|odd-one-out|if-then|sorting" }`
- Omitted → all Logic questions for that difficulty (back-compat)
- Non-Logic subject → subtopic param is silently ignored

Response questions carry the `subtopic` field when present:

```json
{
  "id": "log-pat-e1",
  "prompt": "Next in the pattern: 2, 4, 6, …?",
  "choices": ["7", "8", "9", "10"],
  "subtopic": "patterns"
}
```

## Out of scope

- Subtopic-level progress tracking (single `Logic` progress bar unchanged)
- Sub-topic labels in the UI navigation (frontend wires to the slugs in `LOGIC_SUBTOPICS`)

## Open questions

- None — slug list confirmed by frontend team.
