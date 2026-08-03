# Family Hub — QA Brief 1: What you're testing

**For:** external QA tester · **Owner:** founder · **Date:** August 2026 · **App:** https://frontend-staging-409d.up.railway.app

## The idea in one paragraph

Family Hub is a private online space for one family. Parents run the household in it
(shared calendar, meals, tasks, assignments, notices), and kids log in with their own
PIN to earn stickers for good habits, then save, spend or invest those stickers, so
chores quietly teach money skills. Kids also get "beneficial screen time": built-in
learning games (logic, maths, world flags). Each family's space is fully private and
the product is built for real families: big families, blended families, twins,
grandparents, and culturally rooted households.

## The family you're role-playing (our reference personas)

- **Sarah Khan — the coordinating parent (admin).** Runs the family's mental load on
  her phone. Sets up the family, invites people, configures the reward economy. If
  something takes her more than a few taps between school runs, it's a fail.
- **Yusuf Khan — the second adult.** Joins by email invite. Uses the everyday screens
  (tasks, calendar, meals) but not admin settings. Tech-fluent, notices rough edges.
- **Amina Khan — the teen.** Signs in with a PIN, manages her own habits and money,
  too old for anything that feels babyish.
- **The younger kids (ages 5-11).** PIN login on a shared tablet or parent's phone.
  Everything they see must be tappable, readable and safe. They can never reach
  parent settings.
- **(Future, not in this beta):** community administrators, e.g. a weekend school
  running Family Hub for many families. Billing is also not live yet: everything is
  free on staging, no card anywhere.

## What we need from you

1. **Usability gaps.** Where would Sarah get stuck, hesitate, or mis-tap? Test
   phone-first (most of our users are on phones), then tablet, then laptop.
2. **Product validation.** Does the idea land? Which features feel valuable, which
   feel confusing or pointless? Would you pay $7.99/month as a parent?
3. **Functional gaps.** Broken flows, dead ends, wrong data, things that work on
   desktop but not mobile, empty states, double-taps, browser back button, expired
   sign-in links, wrong PINs.

## How to report

One line per finding: **screen → what you did → what you expected → what happened**,
plus a screenshot and your device/browser. Rate severity: blocker / annoying / polish.
Send as a shared doc or spreadsheet; we triage together weekly.
