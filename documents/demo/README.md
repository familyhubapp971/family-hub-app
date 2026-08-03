# Demo

Living artefacts that show what Family Hub does **right now** — for
stakeholders, demos, retros, and "what's next" planning.

These docs are cumulative: they grow merge over merge, never reset.
Docs folders are **PDF-only** (founder request, FHS-552): the committed
artefact here is the PDF; the editable source lives under
`scripts/demo-src/`.

## Current artefacts

- [`whats-shipped.pdf`](whats-shipped.pdf) — one card per shipped
  capability, grouped by area (Getting started → Parent dashboard →
  Family management → Reward economy → Kid world → Per-child view),
  with persona chips and the FHS ticket that shipped it.

## Updating (required on every user-visible merge — see CLAUDE.md)

1. Edit the source: `scripts/demo-src/whats-shipped.src.html`
   (add/update the capability card, bump the "Last updated" stamp and
   the "current through FHS-XXX" marker).
2. Render: `node scripts/render-demo-pdf.mjs`
3. Commit source + PDF together in the same PR.

At sprint close, additionally post a "what's demoable" summary in the
conversation: which user flows now work end-to-end, distinguished from
shipped-but-not-yet-UI.

## Conventions

- Source is self-contained HTML, no build step (Google Fonts only).
- Kingdom design language: `#3d1065` bg, `#fde047` accent, Fredoka One
  and Nunito fonts, black borders, hard offset shadows (matches
  `packages/ui/tailwind.preset.js` tokens).
- Cross-reference Jira tickets (`FHS-XXX`) on every capability card.
