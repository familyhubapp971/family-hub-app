# Magic Patterns prompt — Family Hub

A compact prompt to paste into the [Magic Patterns](https://magicpatterns.com)
text box when generating new screens. Captures product essence, design
system, and persona context so generated designs match the codebase
look-and-feel and can be fed back via the Magic Patterns MCP.

Magic Patterns text-box character limit is ~2000 chars; prompt below is
~1900 chars.

---

## Copy this into the Magic Patterns prompt box

```
Family Hub — multi-tenant SaaS for families to coordinate habits, tasks, meals, school, savings, rewards. One subdomain per family (<slug>.familyhub.app). Members: admin/adult/teen/child/guest. Primary user: coordinating parent who owns the family mental load.

Stack: React 18 + Vite + Tailwind. Hono API. Postgres + RLS per tenant. Supabase auth.

DESIGN SYSTEM (mandatory):
- NEO-BRUTALIST. Hard 0px offset shadows (1-6px black). 2px solid black borders on all cards/buttons/inputs. Sharp or rounded-md only — never rounded-2xl/3xl. Bold weights.
- Page bg: kingdom purple #3d1065. Cards: white or pastel (yellow-100 #fef9c3, pink-100 #fce7f3, cyan-100 #cffafe, lime-100 #ecfccb).
- Headings "Fredoka One". Body "Nunito" 400/600/700/800/900.
- Shadows: shadow-neo-xs/sm/md/lg = "Npx Npx 0 0 rgba(0,0,0,1)".
- Button: yellow-300 primary, black border, neo shadow, hover lifts. Card: white/pastel + black border + neo. Badge: small pill + black border. Input: white + black border + kingdom focus ring.
- Accents only from Tailwind slate/purple/pink/lime/cyan/yellow 100-700 — never as primary surfaces.

OUTPUT — DESIGN THE FULL END-TO-END FLOW (not a single screen):
- Output every screen in the user's journey from entry → success/exit, in order, connected by labelled arrows showing the user action that triggers each transition.
- Include the obvious branches: error states, empty states, loading skeletons, validation rejection, "no permission" fallback. Don't draw only the happy path.
- Mark each screen with the device frame it lives on (mobile 375w / tablet 768w / web 1024w+) and the persona seeing it.
- Realistic copy: Khan family, kids Yusuf + Aisha, real habits/meals/dates. English-first, Arabic-friendly.
- Every interactive element shows hover + active. Empty states are designed, not blank.

E2E FLOW TO DESIGN: [REPLACE — e.g. "family signup → onboarding wizard → first habit added → first week-close ritual"]
```

---

## How to use

1. Copy the block above and paste into the Magic Patterns prompt box.
2. Replace the **E2E FLOW TO DESIGN** line with a specific user journey.
   Pick a real flow with a clear start and end — e.g.:
   - `"family signup → email verify → onboarding wizard (4 steps) → empty dashboard → invite first member"`
   - `"habit tracker: kid opens app → marks habit done → earns sticker → checks wallet → redeems reward → parent approval push"`
   - `"meal planning: open this week → drag meals into slots → generate shopping list → check off items at store"`
   - `"school start of term: parent imports school iCal → conflict warning fires → resolve → child sees their term calendar"`
3. Generate. The output should be **multiple screens connected with
   arrows**, not a single screen.
4. Review against the existing [persona screen mockups](personas/) for
   visual consistency.
5. To pull the design back into the codebase: use the Magic Patterns MCP
   (`mcp__claude_ai_Magic_Patterns__create_design` →
   `mcp__claude_ai_Magic_Patterns__read_artifact_files`) and commit each
   screen as a React component under `apps/web/src/components/<feature>/`
   OR as an HTML mockup under `documents/design/personas/parent/features/`.

## Per-persona starter prompts

When designing for a specific persona, prepend one of these one-liners
to the **WHAT I'M DESIGNING** line:

- **Coordinating parent (mum/dad):** "User is the family admin who owns the mental load — design surface should be efficient, scannable, calm. Mobile + web."
- **Community administrator (mosque/co-op/NGO):** "User runs an org with 20–500 families — design surface should be data-dense, exportable, multi-admin-friendly. Web only."
- **Early-adopter dad:** "User is tech-fluent, will champion the tool publicly if the roadmap is real — design surface should expose product transparency (roadmap, changelog, share)."
- **Invitee (spouse/kid/grandparent):** "User got an invite email and didn't sign up themselves — design surface must be frictionless, mobile-first, no signup decision-fatigue. Names and family colour visible from screen 1."

## Iteration loop with the codebase

1. Generate in Magic Patterns → save the design URL.
2. Use the MCP to pull the artifact (`mcp__claude_ai_Magic_Patterns__get_artifact`).
3. If it matches the design system: commit the JSX/HTML to
   `apps/web/src/components/<feature>/` (real React) or
   `documents/design/personas/parent/features/<feature>.html` (review artefact).
4. If it drifts from the design system: iterate the prompt and regen.
5. Update [`whats-shipped.html`](../demo/whats-shipped.html) when the
   feature lands.

## Token budget for the prompt

The included prompt block is ~1900 characters — leaves ~100 chars headroom
for the WHAT I'M DESIGNING NOW line. If you need to add more context per
generation, trim the OUTPUT REQUIREMENTS section first (those are the
most easily inferred by the model).
