# 0010 — Adopt framer-motion for frontend animations

**Status:** accepted
**Date:** 2026-05-02
**Jira:** FHS-220 (Marketing pages — Welcome + Pricing)

## Context

The Magic Patterns design (`kudjspxd3xxroueg5jw11o`) used as the source for
Slice 1 onwards leans heavily on `motion.div` and `AnimatePresence` from
`framer-motion`. Hero slides cross-fade, feature cards tilt on hover, the
register slug preview scales in, the verify-email mail icon bounces, the
onboarding wizard transitions step-to-step. Reproducing this with hand-rolled
CSS transitions or the existing `animate-shake` Tailwind keyframe would either
lose fidelity or require a custom mini-animation framework that nobody owns.

## Decision

Adopt `framer-motion` (v11) as the canonical animation library for the web
app. Add it as a direct dependency of `apps/web` and re-export common motion
primitives from `packages/ui` so future surfaces (mobile-web, admin) pick up
the same patterns without duplicating import paths.

## Consequences

- **Easier:** porting MP designs verbatim with `motion.<element>` props;
  page-transition orchestration via `AnimatePresence`; pre-baked easing curves
  match designer intent.
- **Harder:** bundle size increases by ~50 KB gzipped (one-time cost). All
  animated components need to be marked client components — already true since
  Vite builds the whole app client-side.
- **Follow-ups:**
  - File a Tech Debt sub-task to enforce `prefers-reduced-motion` across all
    `motion.*` usages (a11y).
  - Add a Vitest snapshot test pattern that strips `motion.div` to a plain
    `div` so snapshots stay deterministic.
  - Document the motion-design vocabulary (variants vs animate prop, layout
    animations, presence) in a short `documents/technical/frontend-animation.md`
    once the third surface lands.

## Alternatives considered

- **CSS transitions + Tailwind `animate-*` keyframes only** — rejected:
  cross-fades between slide content and step transitions are awkward without
  presence tracking; would re-implement a worse `AnimatePresence`.
- **`react-spring`** — rejected: more powerful for physics-based motion but
  the MP design uses tween-style transitions everywhere; framer-motion's
  declarative API matches better.
- **`@react-spring/parallax` + custom hooks** — rejected: high learning curve
  for the team and most MP animations are simple presence/layout shifts.
