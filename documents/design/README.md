# Design

Visual artefacts for reviewing the product's shape — user journeys,
flow diagrams, IA maps, design-system reference pages.

These are **review documents**, not source code. They render in a
browser using the Family Hub design tokens (`packages/ui/tailwind.preset.js`)
so they look like a living extension of the app and stay honest about
visual decisions already made.

## Current artefacts

- [`user-journeys.html`](user-journeys.html) — end-to-end journeys for the
  4 personas (coordinating parent, community administrator, early-adopter
  dad, invitee) across 10 lifecycle stages, each cross-referenced to FHS
  epic/ticket IDs and flagging backlog gaps.

## Conventions

- Self-contained HTML (no build step). Web fonts + Tailwind CDN are the
  only external deps.
- Use only design tokens defined in `@familyhub/ui` — no new colours,
  fonts, or shadow values.
- Cross-reference Jira tickets (`FHS-XXX`) so the doc stays a live map
  of design intent vs backlog reality.
