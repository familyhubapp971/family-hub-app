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
Family Hub — multi-tenant SaaS for families to coordinate habits, tasks, meals, school, savings, and rewards. One subdomain per family (<slug>.familyhub.app). Each family has multiple members (admin/adult/teen/child/guest). Primary persona: the coordinating parent (mum or dad) who owns the family mental load.

Stack: React 18 + Vite + Tailwind. Hono API. Postgres with row-level security per tenant. Supabase auth.

DESIGN SYSTEM (mandatory):
- Style: NEO-BRUTALIST. Hard 0px-radius offset shadows (1-6px black). 2px solid black borders on all cards/buttons/inputs. Sharp or rounded-md corners only — never rounded-2xl/3xl. Bold weights everywhere.
- Page background: kingdom purple #3d1065. Cards sit on top: white or pastel (yellow-100 #fef9c3, pink-100 #fce7f3, cyan-100 #cffafe, lime-100 #ecfccb).
- Headings: "Fredoka One" (Google Fonts). Body: "Nunito" weights 400/600/700/800/900.
- Shadow tokens: shadow-neo-xs (1px), shadow-neo-sm (2px), shadow-neo (3px), shadow-neo-md (4px), shadow-neo-lg (6px) — all "Npx Npx 0 0 rgba(0,0,0,1)".
- Components to mirror: Button (yellow-300 primary, black border, neo shadow, hover lift), Card (white or pastel, black border, neo shadow), Badge (small pill, black border), Input (white, black border, focus ring kingdom).
- Allowed accent palette: Tailwind slate, purple, pink, lime, cyan, yellow scales 100-700 only as accents — never as primary surfaces.

OUTPUT REQUIREMENTS:
- Realistic copy for a Muslim/global family. Real names (Yusuf, Sarah, Khan family). Real habit/meal names. Bilingual-friendly (English + Arabic comfortable).
- Mobile-first when the surface is parent-or-kid daily use. Web-first for admin and analytics surfaces.
- Every interactive element shows hover/active state.
- Empty states are designed, not blank.

WHAT I'M DESIGNING NOW: [REPLACE WITH SPECIFIC SCREEN — e.g. "the family member onboarding wizard step 3: invite members"]
```

---

## How to use

1. Copy the block above (paste into Magic Patterns prompt box).
2. Replace the **WHAT I'M DESIGNING NOW** placeholder with a specific
   screen request (e.g. "the family member onboarding wizard step 3:
   invite members" or "habit tracker week-grid mobile view").
3. Generate.
4. Review the output against the
   [persona screen mockups](personas/) for visual consistency.
5. To pull design back into the codebase: use the Magic Patterns MCP
   (`mcp__claude_ai_Magic_Patterns__create_design`) which can
   round-trip to a code artifact you commit under `documents/design/`
   or directly into `apps/web/src/components/`.

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
