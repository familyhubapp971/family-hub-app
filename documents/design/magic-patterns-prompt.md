# Magic Patterns prompt — Family Hub

A compact prompt to paste into the [Magic Patterns](https://magicpatterns.com)
text box. Captures product essence, design system, persona context, and
asks for a full end-to-end flow rather than a single screen.

Magic Patterns text box accepts ~2000 characters; the block below is ~1930.

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

1. Copy the block above into the Magic Patterns prompt box.
2. Replace the **E2E FLOW TO DESIGN** line with a specific user journey
   (clear start and end). Example flows:
   - `"family signup → email verify → onboarding wizard (4 steps) → empty dashboard → invite first member"`
   - `"habit tracker: kid opens app → marks habit done → earns sticker → checks wallet → redeems reward → parent approval push"`
   - `"meal planning: open this week → drag meals into slots → generate shopping list → check off items at store"`
   - `"school start of term: parent imports school iCal → conflict warning fires → resolve → child sees their term calendar"`
3. Generate.

## Per-persona prefix (optional)

When designing for a specific persona, prepend the matching one-liner to
the **E2E FLOW TO DESIGN** line:

- **Coordinating parent:** "User is the family admin who owns the mental load — surface must be efficient, scannable, calm. Mobile + web."
- **Community administrator:** "User runs an org with 20–500 families — surface must be data-dense, exportable, multi-admin-friendly. Web only."
- **Early-adopter dad:** "User is tech-fluent, will champion the tool publicly — surface must expose product transparency (roadmap, changelog, share)."
- **Invitee:** "User got an invite email and didn't sign up themselves — surface must be frictionless, mobile-first, no signup decision-fatigue. Names and family colour visible from screen 1."

## Char budget

The block is ~1930 chars; ~70 left for the **E2E FLOW TO DESIGN** line.
If you need more headroom per generation, trim the OUTPUT REQUIREMENTS
bullets first — the model can infer device frames and copy realism on
its own; the design-system block is what it cannot infer.
