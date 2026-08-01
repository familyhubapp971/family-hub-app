# Feature docs

Product requirements per feature, owned by the **`product-manager`**
subagent (`~/.claude/agents/08-business-product/product-manager`).

## When to add a doc

Create a new file here whenever a feature is scoped, before
implementation begins. Update the existing doc when scope changes or
new acceptance criteria are agreed.

## Naming

`<feature-slug>.md` — kebab-case, no prefixes, no dates. Examples:

- `tenants.md`
- `billing.md`
- `auth.md`
- `onboarding-wizard.md`

One file per feature. If a feature gets large, link out to a subfolder
(`<feature-slug>/index.md` + supporting files) rather than splitting the
top-level list.

## Required structure

Every feature doc uses **user stories** with **Gherkin (Given/When/Then)**
acceptance criteria. Full template lives in
[`/CLAUDE.md`](../../CLAUDE.md#user-story-format-required) — copy from there.

Minimum sections:

- Frontmatter: Jira key, status, owner
- One or more **user stories** in `As a … I want … so that …` format
- **Acceptance criteria** as Gherkin scenarios (`Given / When / Then`)
- **Out of scope**
- **Open questions**
- **Success metrics**

## Test traceability

Test names (Vitest unit, Playwright E2E) **mirror** the Gherkin scenario
names so traceability between this folder and the test suite is automatic.

## Index

Drafted / scoped:

- [family-members.md](family-members.md) — member model + the Manage Family page (FHS-513/485/486/514/520/521)
- [role-permissions.md](role-permissions.md) — role matrix + invite roles/admin-grant + invite default (FHS-485/486/524; ADR 0019)
- [reward-economy.md](reward-economy.md) — sticker rate, habit boosts, skip penalty (FHS-512/488/489; ADR 0020)
- [child-world.md](child-world.md) — per-child screen + its header/nav (FHS-268/401/523)
- [getting-started.md](getting-started.md) — first-run setup guide card on the dashboard (FHS-511)
- [onboarding-wizard.md](onboarding-wizard.md) — the 4-step signup wizard, incl. optional child age capture (FHS-36/37/38/39/274/275/432/487)

Placeholder docs (to be filled as the corresponding features are scoped):

- [tenants.md](tenants.md)
- [billing.md](billing.md)
- [auth.md](auth.md)
