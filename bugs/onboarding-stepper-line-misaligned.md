---
status: open
date: 2026-05-03
found-by: oduniyi (manual exploration)
---

# Onboarding stepper — connector line not vertically centred on the circles

## What the user sees

On the `/t/:slug/onboarding` wizard's step header, the green
connector line that runs between the step circles sits **above the
horizontal centre** of the circles instead of cutting through their
middle. The line crosses the circles at roughly their top third,
which makes the whole strip look misaligned and slightly crooked.

## What should happen

The connector line should run through the **vertical centre** of every
circle, regardless of circle size, line thickness, or label position
underneath. The labels ("Welcome", "Members", …) sit below and should
not affect the line's vertical anchor.

## Suspected cause

In `packages/ui/src/StepperHeader.tsx` the line is positioned with a
fixed `top` offset (or via flex alignment that includes the label row)
rather than being absolutely centred to the circle row. As soon as the
label text wraps or the circle size changes, the line drifts.

Likely fixes (pick one during grooming):

- Wrap each step in a flex column where the **circle row** is its
  own child and the line is `position: absolute; top: 50%;
transform: translateY(-50%)` _anchored to the circle row_, not the
  whole step.
- Or render the line as the circle row's own `::before` pseudo-element
  using the circle's computed centre line.

## Blast radius

- Cosmetic only — wizard works end-to-end.
- Affects every onboarding screen and any other surface that uses
  `StepperHeader` (none today, but it's exported from `@familyhub/ui`).

## Notes for the fixing ticket

- Add a Vitest snapshot/visual assertion that the line's centre Y
  matches the circle's centre Y at the smallest (xs) breakpoint and
  the largest (xl).
- Eyeball-check at 375px / 768px / 1280px before merging — labels
  reflow, line should not move.
