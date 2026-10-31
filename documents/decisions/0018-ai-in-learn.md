# 0018: AI Learn lessons via Anthropic Claude (Haiku tier)

**Status:** accepted
**Date:** 2026-06-24
**Jira:** FHS-389

## Context

The kid Learn tab has a static Maths question bank (fixed questions per
difficulty tier). To make the experience richer, we want AI-generated
lessons that explain concepts with kid-safe pedagogy (Feynman Method + NLP
anchors) and generate unique practice questions on every request.

Anthropic's Claude Haiku model is already used in the legacy app for this
purpose and is the cheapest tier, appropriate for low-volume, per-session
calls from a kid doing maths practice.

The feature must not break local dev or existing tests when no API key is
present, and must ship with zero chance of inadvertently calling Anthropic
without operator intent.

## Decision

Use Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for AI-generated
Maths lessons, behind a double-gated feature flag:

- `LEARN_AI_ENABLED` (env var, boolean, default `false`), operator
  intent toggle. Off means the endpoint returns `{ enabled: false }` and
  no Anthropic call is ever made.
- `ANTHROPIC_API_KEY` (env var, string, default `''`), the actual
  credential. Empty means the flag guard short-circuits even if
  `LEARN_AI_ENABLED=true` (defence-in-depth).

The lesson JSON is **server-validated** against a Zod schema before it
reaches the kid UI, malformed AI output is surfaced as a friendly error,
not raw data to the browser.

No child PII is sent to Anthropic. Prompts contain only the operation
(addition/subtraction/multiplication/division) and difficulty/table settings.

When the flag is off, the static Maths question bank remains the complete
experience, the AI panel toggle is invisible.

## Consequences

**Easier:**

- Unique, contextually appropriate Maths lessons on every request.
- The flag-off path is a clean 200 `{ enabled: false }`: no 503, no
  broken UI, no test noise.
- Server-side Zod validation means the kid UI can trust the lesson shape.

**Harder:**

- Anthropic API calls add ~2–5 s latency per lesson (loading state required).
- Per-call cost (Haiku tier) accumulates with usage, monitor via Anthropic
  dashboard once enabled on staging.
- Key rotation must happen via Railway dashboard variables, not the repo.

**Follow-ups:**

- Set `LEARN_AI_ENABLED=true` and add `ANTHROPIC_API_KEY` in Railway
  staging variables once the feature is validated in review.
- Add a k6 smoke scenario covering the AI lesson endpoint latency SLO
  (p95 < 8 s, AI calls are slower than DB reads).
- Consider a per-family daily call cap (e.g. 20 lessons/day) once usage
  patterns are known.

## Alternatives considered

- **Build lessons in the static question bank**, rejected: lessons need
  unique content on each request; a static bank would repeat quickly.
- **Use OpenAI GPT-4o-mini**, rejected: the legacy app already uses
  Anthropic Haiku and the model + system prompts are proven; switching
  adds migration risk with no upside for this use case.
- **Generate lessons client-side (no server call)**, rejected: the API
  key would leak to the browser bundle; server-side validation would be
  impossible; a compromised kid device could prompt Anthropic arbitrarily.
