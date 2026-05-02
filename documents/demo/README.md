# Demo

Living artefacts that show what Family Hub does **right now** — for
stakeholders, demos, retros, and "what's next" planning.

These docs are cumulative: they grow sprint over sprint, never reset.

## Current artefacts

- [`whats-shipped.html`](whats-shipped.html) — swimlane diagram of every
  capability landed so far, organised by phase (Bootstrap → Authentication
  → Tenant Foundation → ...) and by system column (USER / WEB / API /
  DATA / EXTERNAL). Updated at every sprint close per `CLAUDE.md`.

## Maintenance rule

After every sprint closes:

1. Append the new phase / steps to `whats-shipped.html`.
2. Post a "what's demoable" summary in the conversation: which user
   flows now work end-to-end, distinguished from shipped-but-not-yet-UI.

See `~/.claude/projects/.../memory/feedback_end_of_sprint_demo_doc.md`
for the full rule.

## Conventions

- Self-contained HTML, no build step (Tailwind CDN + Google Fonts only).
- Use only design tokens from `packages/ui/tailwind.preset.js` — no
  invented colours, fonts, or shadow values.
- Cross-reference Jira tickets (`FHS-XXX`) on every step card.
- Status badges: `MERGED` (green), `IN FLIGHT` (amber), `PENDING` (grey).
