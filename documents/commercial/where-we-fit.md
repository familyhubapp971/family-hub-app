# Where Family Hub fits

**Written:** 2026-08-08
**Status:** research complete, decisions proposed, none tested on real families

## The short answer

Sell Family Hub as **a kids' money and habits app that needs no bank card**.
Not a family calendar. Not a learning app. Those are included, and they are
good, but they are not why anyone would pay.

Lead in the **UK**, not the Gulf. Ages **6 to 11**. The buyer is a parent who
already runs pocket money by hand and is tired of it.

---

## Which market this is really in

Family Hub touches four markets. Only one of them will pay for it.

| Market                          | Size, most recent                              | Growth                                             | What it means for us                                                               |
| ------------------------------- | ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Kids' money and banking apps    | $1.8B (2024)                                   | 17.2% a year, to $7.2B by 2033                     | **This is the one.** Proven revenue, and our price already matches what people pay |
| Kids' learning apps             | $7.8B (2024) for educational kids' apps        | 13.7% a year                                       | Big, but mostly free at entry. A bad place to lead                                 |
| Family organisers and calendars | $717M to $1.93B (2026), depending whose report | 8% to 20% a year, wide spread means low confidence | Priced at $3 to $7 a month and competing with free. Leading here caps our price    |
| Chore and allowance apps        | No separate market report exists               | n/a                                                | Not a real separate market. It is a feature inside the kids' money apps            |

**Why the money category, in one line:** it is the only one where somebody has
proved a family will pay our price. Greenlight reported $228.5M of annual
revenue in 2024 across 6M+ users. Acorns Early (formerly GoHenry in the US)
charges $8 and $12 a month, which is almost exactly our $7.99 and $12.99.
Family organisers charge $3 to $7, so leading as an organiser invites people to
compare us at half our price, against free tools from Google and Apple.

---

## What nobody else does

Every competitor found, global and Gulf, ties earning to finishing a chore.
Where any of them offer investing, it is a real brokerage account whose value
moves with the stock market, disconnected from the child's behaviour once the
money is in.

**No competitor was found, anywhere, where an invested balance grows on the
days a habit is done and can lose value on the days it is missed.** An amount
whose return depends on your own consistency rather than the market appears to
be genuinely unbuilt.

That was checked across roughly twenty searches by two independent researchers.
It is not proof that no small app somewhere does it, but it is a real finding.

**The honest other reading:** it may be unbuilt because it does not work. There
is **no data anywhere** on whether shrinking a child's tracked value for a
missed habit improves the habit or just breeds resentment. Rooster Money
actively markets "no risk of debt" as a selling point, which is the opposite
instinct. This is the single biggest bet in the product and it is unproven. See
[product-market-fit.md](product-market-fit.md#the-one-bet-that-decides-everything).

---

## Who else is in the market

### The card issuers, who own the words "teach kids about money"

| Who                        | Price                                         | Scale                             | Their weakness                                                                                                              |
| -------------------------- | --------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Greenlight                 | $4.99 to $14.98/mo, up to 5 kids and 2 adults | 6M+ users, $228.5M revenue (2024) | Caps at **2 adults**. Peak valuation $2.3B in 2021, a secondary-market estimate now puts it near $601M, a fall of about 74% |
| Acorns Early (was GoHenry) | $8 or $12/mo                                  | 2M+ accounts                      | Caps at **4 children**. Mid-rebrand, brand confusion                                                                        |
| Rooster Money              | £1.99/mo, free for NatWest customers          | Not disclosed                     | Tied to a UK bank account. Does not travel                                                                                  |
| Spriggy                    | AUD $5 to $9/mo                               | Australia only                    | Australia only                                                                                                              |

They all earn twice: a subscription plus a cut of every card swipe. That second
income quietly rewards a child spending more, which sits awkwardly beside
"teach saving". It also costs them a sponsor bank, KYC and anti-money-laundering
work, and card dispute handling, roughly 3 to 6 months minimum to set up.

### The family organisers, who own breadth

Cozi (20M+ users, now owned by a media company and described by reviewers as
maintained rather than built), FamilyWall, Skylight (9.3M users but hardware at
$300 to $679), and Google Family, which is free and already on every Android
phone. None has a money layer. Picniic had the features and the press and died
anyway in 2024, which is worth remembering.

### In the Gulf specifically

Verity, Leap, Cashee, Edfundo and Savii all already run kids' money products in
the UAE and Saudi. **GEMS and Visa run a live card programme across 200,000+
students in the UAE's largest school network.** The Gulf kids' money space is
not empty, and the institutional route there is already taken by a card network
with school relationships we cannot match.

---

## The launch market question

**The current strategy says Gulf first. The research says UK first.** Three
reasons, and they are not close.

| Reason                                                 | Detail                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The UK pool is about five times bigger                 | ~8.1M UK families with dependent children, against ~1.6M UAE households with children. Both are calculations chaining official statistics, so treat them as orders of magnitude, not exact                                                                                                                             |
| Our price is proven in the UK and untested in the Gulf | $7.99 and $12.99 sit exactly on Acorns Early's $8 and $12 and ClassDojo's $7.99. In the Gulf, Verity and Edfundo do not publish prices, and Edfundo's own marketing says "less than the price of a coffee", which implies $3 to $5. We would be launching at an untested price into the market with the least evidence |
| The words need more care there                         | The mechanic grows a balance over time. That is close enough to interest to need careful language in a Muslim-majority market, even though ours is effort-linked rather than time-linked, which is materially different. This is a copy and product-language issue, not a reason to avoid the market                   |

**Also practical:** the founder is in the UK time zone, so the personal network
that supplies the first twenty families is most likely British. The first
families have to come from somewhere warm.

**What would change this call:** a Gulf pilot showing families paying at or
near $7.99. If that happens, the argument flips, because Gulf smartphone use
and cashless sentiment genuinely run ahead of the UK, and education and
lifestyle apps in the region convert over 40% of free trials to paid, against
about 19% for games.

**This is reversible.** Nothing in the product is UK-specific: currency is
already per family and localised.

---

## What we can honestly claim today

This matters because a sharp prospect, or a journalist, will check.

### The claim to drop

[`positioning.md`](../strategy/positioning.md) leads with being "the first
family app to ask about twins, step-children, grandma". **The database has no
field for twins, birth order, or step-relationships.** `birth_rank` and
`multiple_birth_group_id` appear in a feature document and an architecture
decision record, and nowhere in the shipped schema. A grandparent, a nanny and a
step-parent are all just "adult" today.

Leading with a claim the product cannot demonstrate is the fastest way to lose
a credible buyer. Drop it until it is built.

### The claim to keep, because it is real and checkable

**Any number of grown-ups, any number of children, one family space.** Verified
in the code: five roles (admin, adult, teen, child, guest), no member cap
anywhere, and a sticker rate that can be set per child.

That matters because the incumbents genuinely break here:

- Greenlight caps at **2 adults**. Two parents plus a grandparent does not fit.
- Google Family caps at **6 people total**. Four children and two parents fills
  it exactly, and a grandparent breaks it.
- Acorns Early caps at **4 children**.
- OurFamilyWizard, the app blended families actually use, charges **per parent**
  at $110 to $300 a year each. Two birth parents and a step-parent pay $330 to
  $900 a year, for custody messaging alone, with no calendar, no money, no
  chores.

So the honest version of the story is not "we understand twins". It is **"we do
not charge you per adult, and we do not run out of seats."**

---

## The second buyer

The strategy treats schools, co-ops and clubs as a revenue line. The evidence
says they are a **distribution channel that pays almost nothing directly**.

- Homeschool co-op software charges about **$9.95 per family per year**, capped
  at $1,995 for a large co-op. Our consumer price is $96 to $156 per family per
  year. No organisation is going to pay ten times what its own admin software
  costs.
- School software is bought through procurement, with tenders, year-long
  contracts and IT approval. That is a long, hard sale for a solo founder.
- **ClassDojo is the proven pattern:** free for the school, which is why it
  reached roughly 95% of US schools, and then families pay $7.99 a month
  individually.

**Recommendation: freeze the paid organisation tier.** Keep the multi-tenant
architecture, since it is already built and costs nothing to keep. Use
organisations later as a cheap way to reach many paying families at once, on
the normal consumer subscription. In the UAE specifically, the institutional
route is already held by GEMS and Visa at 200,000+ students.

---

## Where the moat actually is, ranked

| Rank | Thing                                                     | How long would it take a funded incumbent to copy                                                                                                                                                           |
| ---- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Years of hardening on tenant isolation, roles and invites | The design copies in a quarter. The trust that it never leaks between families does not                                                                                                                     |
| 2    | The habit-investment mechanic                             | A sprint for Greenlight or Duolingo to build. Harder for a **card issuer**, who would have to defend shrinking a child's real money to a regulator. That defence gap is the actual protection, not the idea |
| 3    | Breadth: calendar, meals, learning and money in one login | Cozi could add a sticker economy tomorrow. Breadth is not a moat                                                                                                                                            |
| 4    | The organisation tier                                     | Weakest. Already lost in the UAE to GEMS and Visa                                                                                                                                                           |
| 5    | The role model on its own                                 | Table stakes. Everyone has parent and child roles                                                                                                                                                           |

---

## The position, in the words to actually use

> **Pocket money that teaches saving, not just spending. No card, no bank, no
> risk.**

What it means: a child earns stickers by keeping habits. The family decides
what a sticker is worth. The child can spend them in the family's own reward
shop, put them safe in savings, or put them behind a habit and watch the value
grow while they keep it up. No card is issued. No real money moves through us.
The parent pays their child themselves, the way they always have.

**The honest limit to state out loud:** this works for roughly ages 5 to 12,
where the lesson is behavioural, seeing a number move, waiting, choosing. For
teenagers who need to actually hold and spend a balance, a real card wins, and
we should not pretend otherwise. Saying so is more credible than claiming the
whole age range.

---

## Sources

Market sizing, pricing and household figures were gathered 2026-08-08 and are
cited inline in the research they came from: CBUAE Rulebook (stored value
facilities), ONS Families and Households 2024, GASTAT Saudi household data 2024,
Global Media Insight UAE population 2025, getlatka and Contrary Research on
Greenlight, Acorns Early published pricing, Rooster Money published pricing,
Spriggy published pricing, Homeschool-Life published pricing, nationgraph K-12
procurement analysis 2026, and the Middle East App Growth Report, Fall 2025.

Figures marked as calculations chain two separate official sources and are
order-of-magnitude estimates, not published numbers.
