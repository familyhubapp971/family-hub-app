# Family Hub — QA Brief 2: Feature tour

**App:** https://frontend-staging-409d.up.railway.app · sign up free, no card. Test each
area phone-first (375px), then tablet, then laptop. Personas: Sarah (admin parent),
Yusuf (second adult), Amina (teen), younger kids (PIN login).

## 1. First contact & sign-up — _Sarah_

Welcome, Pricing, About and Legal pages → "Start free" → create the family with its
own web address (e.g. `/t/khan-family`) → sign in by email magic link or Google (no
passwords anywhere) → a short onboarding wizard: add members with roles and kids'
ages, timezone and currency auto-detected, starter habits pre-seeded.
**Explore:** typos in email, expired magic link, going back mid-wizard, tiny screens.

## 2. Parent dashboard — _Sarah, Yusuf_

Six tabs: **Today** (the day at a glance), **Meals** (week planner + snacks),
**Calendar** (events, recurring events, and a private subscribe link that feeds
Google/Apple/Outlook calendars), **Assignments**, **Noticeboard** (family notes with
emoji), **Tasks** (assign, filter by member, mark done).
**Explore:** member filters, week navigation arrows, long titles, empty tabs.

## 3. Family management — _Sarah (admin), Yusuf_

Manage Family splits Grown-ups (email sign-in) and Kids (PIN sign-in). Invite adults
by email, add kids without an email, set or reset 4-digit PINs, grant or remove admin
rights (the last admin is protected), remove members, change your own email safely.
**Explore:** what a non-admin like Yusuf can and cannot see; invite yourself twice.

## 4. Reward economy setup — _Sarah (admin)_

Reward settings: money value per sticker (per-child override possible), habit pay
boosts (2x/3x/5x), optional skip penalty, pocket money. Admin Panel: every child's
balances, week history, and quick actions (claim reward, cash out, save, invest,
withdraw). Reward shop items and kids' reward requests.
**Explore:** change the sticker rate mid-week; can a non-admin reach any of this?

## 5. Kid experience — _Amina, younger kids_

Kid login: tap your avatar, enter your PIN. My World: the week's habit tracker
(tap a day to mark it), stickers earned, weekly account (earned / saved / invested),
money-skills view, reward shop and requests, end-of-week recap. Wrong-PIN lockout
protects the account.
**Explore:** role-play an 8-year-old; is anything confusing, unreadable or reachable
that shouldn't be (parent settings must be impossible to reach)?

## 6. Learn (kid-only) — _kids; Sarah sees insights_

Logic (patterns, odd-one-out, if-then, sorting; three difficulties), Maths journey
(placement test, lessons, times-table practice, challenges, certificates), World
Flags (explore the map, flashcard study path, quizzes, certificates), plus a reading
log. Parents never play; they get a read-only Learning Insights tab per child.
**Explore:** quiz exits, certificates, difficulty jumps, a kid quitting mid-lesson.

## 7. Child World, per child — _Sarah, Yusuf_

From the account menu, open any child's world: their habits and rewards, meals,
calendar, journal and learning insights, plus the week-close flow (claim / cash out /
save / invest / withdraw dialogs with full audit trail).
**Explore:** close a week, reopen it, verify the money maths always adds up.

## 8. Cross-cutting checks — _everyone_

Phone-first layouts everywhere, tap targets big enough for fingers, no sideways
scrolling, browser back button, double-taps, two adults using the same family at
once, the beta feedback widget (bottom corner), sign out and back in.
**Not built yet, don't report:** payments/billing, community/white-label features,
custom subdomains, production domain.
