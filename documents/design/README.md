# Design

Visual artefacts for reviewing the product's shape — user journeys,
flow diagrams, IA maps, design-system reference pages.

These are **review documents**, not source code. They render in a
browser using the Family Hub design tokens (`packages/ui/tailwind.preset.js`)
so they look like a living extension of the app and stay honest about
visual decisions already made.

## Current artefacts

- [`index.html`](index.html) — entry point. Links to the 4 persona
  journey boards.
- [`personas/<name>/journey.html`](personas/) — for each persona
  (coordinating parent, community administrator, early-adopter dad,
  invitee), a Figma-style flow board of high-fidelity screen mockups
  across the 10 lifecycle stages, cross-referenced to FHS tickets and
  flagging backlog gaps.
- [`personas/parent/features/`](personas/parent/features/) — the
  coordinating parent has 6 critical-feature deep-dives (habit tracker,
  weekly meals, family calendar, announcements, rewards/sticker shop,
  assignments + admin) showing what the SaaS UI looks like for each.
  See [`personas/parent/features/index.html`](personas/parent/features/index.html)
  for the hub.

## Conventions

- Self-contained HTML (no build step). Web fonts + Tailwind CDN are the
  only external deps.
- Use only design tokens defined in `@familyhub/ui` — no new colours,
  fonts, or shadow values.
- Cross-reference Jira tickets (`FHS-XXX`) so the doc stays a live map
  of design intent vs backlog reality.
