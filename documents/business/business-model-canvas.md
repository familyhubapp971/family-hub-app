---
title: FamilyHub Business Model Canvas
status: v1 (2026-05-06)
owner: founder
audience: investors, accelerators, grant programs (e.g. Standard Chartered Foundation), prospective acquirers
sources:
  - documents/strategy/saas-transformation.md
  - documents/strategy/positioning.md
  - documents/decisions/0004-stripe-billing.md
---

# FamilyHub Business Model Canvas

_The operating system for modern family life_

One-line summary: **Family Hub is the operating system for modern
family life — a multi-tenant SaaS that combines family admin,
beneficial screen time, a child-friendly sticker economy, and
cultural flexibility, built for households the rest of the
family-app market quietly assumed didn't exist.**

---

## 1. Customer Segments — _who we serve_

Three concentric rings, served by the same multi-tenant platform with
module toggles.

| Ring                  | Segment                                                                | Who they are                                                                                                                               | Why they buy                                                                   |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Core (B2C)**        | Tech-comfortable parents with 2+ children                              | One parent values structured screen time + educational habits; juggles meals / calendars / homework across apps                            | One dashboard replaces 5 apps; screen time that earns rewards through learning |
| **Underserved (B2C)** | Muslim, multi-faith, and culturally-rooted households                  | Currently stitch 5 tools because no single one fits; Western family apps ignore Ramadan, mosque integration, multi-generational households | Built-in cultural flexibility nobody else ships                                |
| **B2B / White-label** | Islamic schools, madrasahs, mosques, churches, homeschool co-ops, NGOs | 20–500+ families to coordinate; want a branded portal not a generic group chat                                                             | One-touch branded subdomain, member roles, reporting, bulk invites             |

**Launch geography (in order):** UAE / Saudi Arabia → US / Canada / UK → Indonesia / Pakistan.

## 2. Value Propositions — _why they choose us_

The **four-corner whitespace** no competitor occupies:

1. **Family admin** (calendars, meals, announcements, assignments, journal).
2. **Beneficial screen time** (maths, world flags, logic — kids earn stickers by learning).
3. **Sticker economy** (earn / save / invest / spend — children learn economics through real consequence).
4. **Cultural flexibility** (Ramadan journal, mosque / church integration, extended-family roles).

| Competitor            | Family admin | Education | Reward economy  | Cultural flex |
| --------------------- | ------------ | --------- | --------------- | ------------- |
| Cozi, FamilyWall      | ✅           | ❌        | ❌              | ❌            |
| Khan Academy, Prodigy | ❌           | ✅        | partial         | ❌            |
| GoHenry, RoosterMoney | partial      | ❌        | ✅ (money only) | ❌            |
| Muslim Pro, similar   | ❌           | ❌        | ❌              | partial       |
| **Family Hub**        | **✅**       | **✅**    | **✅**          | **✅**        |

Headline messages per audience:

- **Parents:** _"One dashboard replaces five apps — and the kids learn while they earn screen time."_
- **Schools / mosques:** _"Your families get a branded portal in minutes — coordinate, reward, retain."_
- **Investors:** _"The uncontested four-corner space + per-child AI learning data that compounds into a switching-cost moat."_

## 3. Channels — _how they find + reach us_

| Channel                         | Stage                   | Notes                                                                                        |
| ------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| **Organic / SEO**               | Awareness               | Long-tail "Muslim family planner", "homeschool family app", "kids reward chart"              |
| **Product Hunt**                | Launch                  | One big spike for early-adopter parents in tech-adjacent jobs                                |
| **Paid social (Meta, TikTok)**  | Acquisition             | UAE / Saudi / UK lookalike audiences; creative leans on the "5-apps-in-1" message            |
| **Community partnerships**      | Acquisition + trust     | Islamic schools, mosques, homeschool co-ops — feeds both B2C demos AND B2B white-label deals |
| **App stores (iOS, Android)**   | Acquisition             | PWA today; native wrappers in Sprint 6 cluster                                               |
| **Direct sales (enterprise)**   | Acquisition             | Outbound to schools / madrasahs / NGOs once self-serve hits 100 paid families                |
| **In-app referrals**            | Growth                  | "Invite another family — both get a month free"                                              |
| **Branded white-label portals** | Acquisition + retention | Each enterprise tenant becomes a marketing surface for its own member families               |

## 4. Customer Relationships — _how we keep them_

- **Self-serve SaaS** with in-app onboarding wizard (timezone, currency, family name, first members + emoji) — < 5 min from signup to first dashboard.
- **Lifecycle email**: welcome, 3-day nudge, 14-day "you've earned X stickers" recap, monthly streak reports.
- **In-product retention loops**: sticker streaks, weekly meal-planning prompts, child mastery progress.
- **Customer-success layer for enterprise** (manual today; tooling once 5+ paid org tenants land).
- **Open analytics** (PostHog) + product-led growth: behavioural triggers turn engaged free users into paid.

## 5. Revenue Streams — _how we monetise_

### Consumer (recurring subscription, Stripe)

| Tier                 | Price                    | Includes                                              |
| -------------------- | ------------------------ | ----------------------------------------------------- |
| **Household (Free)** | $0                       | Up to 3 members, limited features, no sticker economy |
| **Family**           | $7.99 / mo or $69 / yr   | Unlimited members, all core features, Maths module    |
| **Family Pro**       | $12.99 / mo or $109 / yr | + World Flags, Logic module, custom subdomain         |

### Enterprise / white-label (annual)

| Org size          | Annual price | Includes                        |
| ----------------- | ------------ | ------------------------------- |
| Up to 20 families | $299         | Branded subdomain + custom logo |
| 21–100 families   | $999         | + admin tools, member roles     |
| 101–500 families  | $1,999       | + reporting, bulk invites       |
| 501+ families     | $3,499       | + dedicated support, SSO        |

Maps 1:1 to the Stripe billing model in ADR 0004 (Starter / Growth / Scale / Enterprise + metered usage on the top two).

### 24-month revenue target

5,000+ paid families + 30+ enterprise tenants → **$720k+ ARR**.
At an 8–12× multiple → **$5.7M–$8.6M acquisition band**.

## 6. Key Resources — _what we need to deliver_

- **Multi-tenant SaaS platform** (Hono API + React/Vite web + Postgres with RLS + Supabase Auth + Stripe billing). Architecture pinned in ADRs 0001–0011.
- **Per-child AI learning data** (the moat — see section 9 on the flywheel).
- **Proprietary curriculum content** for Maths, Logic, World Flags modules (built in the legacy app, now ported).
- **Brand + design system** (purple kingdom palette, neo-brutalist UI, ported from Magic Patterns Welcome / Pricing / Login pages — FHS-220–245).
- **Founder + small product/engineering team** (currently solo founder + AI-augmented; first hire likely on customer success or content production).
- **Capital** — 12-month runway to clear the $1k MRR enterprise + 100 paid families thresholds.

## 7. Key Activities — _what we do every day_

| Activity                                                                       | Owner                                            | Cadence                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------- |
| Product development (epics + sprints)                                          | Founder + AI agents                              | Continuous; 2-week sprints |
| Content + curriculum production (Maths problems, logic puzzles, flag dataset)  | Founder + freelance educators                    | Per module release         |
| Customer acquisition (SEO, paid social, partnerships)                          | Founder, scales to marketer                      | Continuous post-launch     |
| Customer support + success                                                     | Founder, scales to CS hire at 100+ paid families | Daily                      |
| AI / ML pipeline maintenance (per-child placement model)                       | Founder + AI infra partner                       | Per module release         |
| Community + partnership outreach (Islamic schools, mosques, homeschool co-ops) | Founder                                          | Weekly                     |
| Financial operations (Stripe reconciliation, VAT/GST, accounting)              | Founder + bookkeeper                             | Monthly                    |

## 8. Key Partnerships — _whose shoulders we stand on_

| Partner                                              | Role                                                              | Why it matters                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Supabase**                                         | Auth + managed Postgres                                           | Replaces a 6-month identity build; magic-link + Google OAuth out of the box |
| **Stripe**                                           | Subscription billing + Customer Portal + webhooks + metered usage | The only realistic billing infra for a global SaaS launch                   |
| **Railway**                                          | App + DB hosting (staging + production)                           | Cheap, fast, zero-DevOps until ~100 paid families                           |
| **OpenAI / Anthropic**                               | LLM inference for the maths + logic per-child personalization     | Speeds time-to-launch on the AI moat                                        |
| **Sentry + PostHog**                                 | Observability + product analytics                                 | Founder visibility from day 1                                               |
| **Islamic schools, mosques, homeschool co-ops**      | Distribution + white-label tenants                                | The B2B / B2B2C channel that doubles as a B2C acquisition surface           |
| **Standard Chartered Foundation** (this application) | Non-dilutive capital + ecosystem network                          | Bridges the 12-month runway to the first 100 paid families                  |
| **Apple / Google app stores**                        | Native distribution (Sprint 6 cluster)                            | Conversion uplift + app-store SEO                                           |

## 9. Cost Structure — _what we spend on_

| Cost line                             | Type     | Notes                                                                                     |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| **Hosting (Railway)**                 | Variable | ~$20/mo at staging; grows linearly with paid families                                     |
| **Supabase Auth + DB**                | Variable | Free tier today; upgrades to Pro at scale (ADR 0008)                                      |
| **Stripe processing fees**            | Variable | 2.9% + 30¢ per transaction; baked into pricing                                            |
| **AI inference (OpenAI / Anthropic)** | Variable | Cap per-child via batching + caching; <$0.50 / child / month target                       |
| **Payroll**                           | Fixed    | Founder + first hire (CS / content) once 100 paid families hit                            |
| **Marketing (paid + content)**        | Variable | Held to CAC < 6× monthly ARPU                                                             |
| **Compliance + legal**                | Fixed    | GDPR + child-data compliance (COPPA, UK age-appropriate design code), Stripe entity setup |
| **Domain + SSL**                      | Fixed    | `familyhub.app` + wildcard SSL                                                            |

**Cost moat:** the multi-tenant architecture means marginal cost per new family is near-zero — same Postgres rows, same containers, same code. Unit economics improve with every paying family.

---

## 10. AI Moat — _the defensibility flywheel_

(Not a standard BMC block, but central to the equity story — kept here so the canvas tells the whole pitch.)

1. Each family's children generate **per-child learning data** (maths problem patterns, time-of-day performance, error fingerprints).
2. The Maths / Logic / World Flags engines **personalize lessons per child** using that data — not generic placement, but the next problem _this specific child_ needs to grow.
3. Outcomes (mastery rate, streak retention, sticker earn rate) **compound over months**.
4. **Switching cost** is brutal — a child 6 months in has a personalized curriculum no competitor can clone overnight; going to a generic app means cold-start placement, a felt regression.

Per-child data is the moat, not the algorithm.

---

## Footer

| Field               | Value                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Vision              | The operating system for modern family life                                                        |
| Stage               | Sprint 2 complete on staging (signup, dashboard, members, invitations, kid auth). Sprint 3 queued. |
| ARR today           | $0 (pre-revenue)                                                                                   |
| 24-month ARR target | $720k+                                                                                             |
| Founding team       | Solo founder (Babatunde "Tunde" Oduniyi), AI-augmented                                             |
| Live demo           | https://frontend-staging-409d.up.railway.app/                                                      |
