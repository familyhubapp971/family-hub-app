# Product-market fit: the case, and how to test it in 90 days

**Written:** 2026-08-08
**Status:** no paying customers, no live billing, no evidence from a real family yet

## Where we actually stand

Say this plainly before anything else: **there is no evidence of a real user
anywhere in this project.** Every persona and pain point in the strategy
documents is the founder's own judgement, not something observed. That is normal
at this stage. It also means the entire case currently rests on one person's
instinct, which is the most common way early products misread their market.

Nothing below is a claim that Family Hub has fit. It is a plan to find out.

---

## The wedge

**One job, one household shape, one age band:**

> Turning a paper chore chart and hand-counted pocket money into a system where
> a child aged roughly 6 to 11 earns, sees, and decides what to do with their
> own money, for a parent who already does this by hand and is tired of it.

### Why this and not the current pitch

The strategy leads with "the operating system for modern family life" and a
household defined by size and culture. That is broader and weaker, for a reason
visible in the repository itself:

- The habit-to-money loop has had **a dozen or more refinement tickets**: money
  row layout, investment tags, contrast, the value-over-time maths, the action
  sheets. That is where the product has a real opinion.
- Meals, calendar, noticeboard and assignments have **no feature document at
  all**. They are competent, and undifferentiated.

The product already voted with its effort. The positioning should follow it.

### What this gives up, deliberately

The large and multicultural family story as the lead. The organisation and
white-label ambition. The personalised-learning narrative. The "replaces five
apps" pitch. All become later, not never.

### Stated so it can be proved wrong

> Among parents of a 6 to 11 year old who currently run pocket money by hand,
> at least **40% of households that activate** will, in a second consecutive
> week, have the child both complete a habit **and** take a money action, and
> will describe it unprompted as better than what they did before.

If that is false, the money layer is decoration on a sticker chart.

---

## The one bet that decides everything

The invest mechanic, where a balance grows on days a habit is kept and can
shrink on days it is missed, is **the only genuinely unbuilt thing in the
product**. Two independent researchers looked hard and found nobody doing it.

That cuts both ways, and the second way is rarely said out loud:

| Reading         | The case for it                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| It is a moat    | Three ideas proven separately (loss aversion, money staked on consistency, kids investing) that nobody has assembled for families, plausibly because the kids' money companies were all consumed by card and banking regulation                                                                                                                                                         |
| It is a mistake | **No data exists anywhere** on whether shrinking a child's tracked value for a missed habit improves the habit, or just produces resentment and a deleted app. Rooster Money markets "no risk of debt" as a feature, the opposite instinct. A penalty applied to a child's money can read badly out of context, in a review or a journalist's paragraph, however safe it is technically |

**This must be tested on real children before it becomes the headline.** It is
the first thing to learn, not the first thing to advertise.

---

## What would count as proof

**Activation has to mean two people, not one.** A grown-up finishes signup, adds
a child, sets a habit, **and** the child signs in with their own PIN and
completes a habit, within seven days. A harder bar than most consumer apps, and
the right one, because the product does not work if only the adult shows up.

| Measure                             | Green, keep going | Amber, keep fixing | Red, stop |
| ----------------------------------- | ----------------- | ------------------ | --------- |
| Signup to activation, within 7 days | 50%+              | 25 to 50%          | under 15% |
| Week 2 return with a habit done     | 40%+              | 20 to 40%          | under 20% |
| Week 4 return with a habit done     | 25%+              | 15 to 25%          | under 10% |
| A money action after week 1         | 30%+ of activated | 15 to 30%          | under 10% |

**Track the last two separately, never blended.** "Earns again in week 2" only
proves we beat a paper chart, which plenty of chore apps already do. "Takes a
money action after week 1" is the only one that tests the thing we are actually
selling. If the first is healthy and the second is not, we have built a nicer
sticker chart.

**What tells the founder to stop:** activation under 15% after one honest
attempt at fixing onboarding; week 4 retention under 10%; no money action ever
happening past week 1 for 80%+ of activated families; or three or more separate
families saying some version of "cute, but my child just wants the sticker, not
the money screen". Any one of those is a stop signal, not a reason to market
harder.

---

## The riskiest assumptions, in order

| #   | The assumption                                                                   | Why it is this high                                                           | The cheapest way to test it                                                                                    |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Both a grown-up and a child have to turn up, or nothing happens                  | It is the precondition for every other number                                 | Personally onboard 15 to 20 families over a call, and watch whether the child's first session actually happens |
| 2   | The pain is bad enough that a parent finishes setup                              | If the paper chart is tolerable, nobody switches, however good the loop is    | 15 to 20 interviews **before** showing the app: how do you do this today, how much does it annoy you           |
| 3   | Parents actually hand over the real money the app says they owe                  | We move no money and issue no card. This is entirely trust and follow-through | One line a week to each pilot family: did anything get cashed out, did you actually pay it                     |
| 4   | An eight-year-old understands "invest", rather than an adult finding it charming | If only the parent gets it, it is a parent feature in a child's costume       | Five minutes with 5 to 8 children: show the screen, ask them to explain it back                                |
| 5   | "It can lose value" does not alarm the parent                                    | A perception risk, independent of whether it is technically safe              | Ask directly in the same interviews how that language reads                                                    |
| 6   | Families want one app rather than the best of each                               | Decides whether the six grown-up tabs earn their place                        | Ask which tool they would actually stop using, and which they would keep                                       |
| 7   | Parents set a sensible sticker rate and stick to the penalty                     | Lower stakes, and visible in the data anyway                                  | No test needed, watch the pilot's own settings                                                                 |
| 8   | Even 15 to 20 families can be recruited for free                                 | Real risk, but should not block product testing                               | Personal network plus one parenting group post                                                                 |

---

## The honest case against

Written as strongly as it deserves.

- **Too broad, for one person.** Six grown-up tabs, a child's world, learning
  games, an intricate money engine, and a roadmap adding billing, invites,
  white-label and three new countries, all before a single person has paid.
  Deep in one place, thin everywhere else, priced and pitched as a whole
  operating system.
- **The headline claim does not survive a check.** Positioning leads with
  understanding twins and step-children. The database has no field for either.
- **The financial projections are imaginary.** Billing is an empty placeholder
  file, and the strategy projects $720k of annual revenue and a multi-million
  acquisition band inside 24 months. That is building the sales machinery before
  proving one family will pay.
- **Money plus children is a category with no second impression.** "Invest" and
  "can lose value" applied to a child read badly out of context, whatever the
  technical reality.
- **The wedge is not empty water.** Greenlight, Acorns Early, Rooster Money and
  BusyKid already own "kids plus chores plus money", several with real cards and
  years of trust. Our version has no real spending power. It is a weaker
  instance of that job, wrapped inside a broader app those competitors chose not
  to become.
- **The no-card ceiling is real.** Credible for ages 5 to 12. Weak for teenagers,
  who need to actually hold a balance. Every card issuer targets exactly that
  graduation moment.

---

## The 90-day plan

Built for one person with a working app on staging and no paying users.

### Days 0 to 30: does anyone turn up, and is the pain real

- Recruit 15 to 20 families through warm channels only. Skew hard to a child
  aged 6 to 11.
- **Interview before demoing.** How do you handle chores and pocket money now,
  and how much does it bother you.
- Onboard every family personally, so a broken signup flow does not muddy the
  numbers.
- One line of check-in per family per week.

**Gate:** at least 8 of them activate, and at least 5 come back in week 2 with a
habit done. Below roughly 40% and 25%, fix onboarding before recruiting anyone
else. Do not pour people into a leaking funnel.

### Days 31 to 60: does the money loop land, and would anyone pay

- Grow to 40 to 60 families, by referral from the first group. That doubles as a
  free test of whether families invite other families.
- **Run the child think-aloud** on the invest screen with 5 to 8 children. This
  is the bet from the top of this document, and this is where it gets tested.
- Ask the first group directly whether they would pay $7.99 a month. Count real
  replies, not politeness.

**Gate:** week 4 retention at 15 to 20%+, a money action after week 1 in 30%+ of
activated families, and real payment interest from 15 to 20% of those asked.

### Days 61 to 90: does anyone actually pay

- Turn on billing for a small founding-families pilot. **Charge 10 to 15 of the
  most engaged families for real**, even at a discount. Money changing hands is
  the strongest signal available before scale.
- In parallel, run a stripped signup, habit tracker and money loop only, on 10
  to 15 brand new families, and see whether the narrow pitch beats the broad one.

**Decision:** 3 to 5 genuinely paying families plus retention holding on the
narrow pitch is a green light to spend a small amount on one paid channel.
Near-zero payment and week 4 retention still under 15% means going back to
discovery, possibly with a different age band or a different job entirely.

---

## What to cut to sharpen the wedge

Unsentimental, and about the **pitch and the default onboarding**, not about
deleting working code.

| Feature                                   | Verdict                                             | Why                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Habit tracker and earning stickers        | Keep, it is the core                                | Everything depends on it                                                                                                |
| Kids money: save, invest, spend, cash out | Keep, make it the hero of every demo                | Where the depth and the difference live                                                                                 |
| Child PIN sign-in and their own world     | Keep                                                | Required for the wedge to work at all                                                                                   |
| Reward shop                               | Keep                                                | The other half of earning                                                                                               |
| Calendar                                  | Keep, but reframe as "this week's habits"           | Not sold as a Cozi replacement                                                                                          |
| Journal                                   | Keep, unproven                                      | Watch whether the pilot uses it                                                                                         |
| Meals                                     | Take out of the pitch, hide from default onboarding | A commodity job that AnyList and Mealime already own, with no link to the wedge                                         |
| Noticeboard                               | Take out of the pitch                               | WhatsApp wins this, and inside one family there is nobody to broadcast to                                               |
| Assignments and Tasks, two separate tabs  | Merge or hide one                                   | Same job, and two tabs invites exactly the "which one has what" confusion the money redesign just fixed elsewhere       |
| Learning games                            | Keep shipped, take out of the wedge pitch           | A third product, competing with Khan Academy, with no evidence it drives money retention                                |
| Organisation and white-label tier         | Freeze                                              | Chasing a second buyer before the first has any retention data. See [where-we-fit.md](where-we-fit.md#the-second-buyer) |
| The personalised-learning narrative       | Drop from the pitch                                 | It assumes months of data from a paying group that does not exist                                                       |
