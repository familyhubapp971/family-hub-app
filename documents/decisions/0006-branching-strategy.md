# 0006 — Branching strategy

**Status:** accepted
**Date:** 2026-04-24
**Jira:** [FHS-174](https://qualicion2.atlassian.net/browse/FHS-174)

## Context

We need a branching model that supports a Jira-driven sprint
workflow, plays cleanly with the Jira ↔ GitHub auto-link integration
(commit / branch / PR all keyed to FHS-XXX), keeps `main` deployable
to production, and degrades gracefully whether we have one
contributor or several.

## Decision

**`main` (production) ← `staging` (pre-production) ← `feature/*` (work).**

All work happens on a feature branch named per the convention in
[`/CLAUDE.md` "Branch & PR naming"](../../CLAUDE.md#branch--pr-naming-jira-auto-link):

```
<type>/FHS-XXX-short-slug
```

where `<type>` is a Conventional Commits prefix (`feat`, `fix`,
`docs`, `chore`, `test`, `refactor`, `perf`).

PRs target `staging`. `staging` periodically promotes to `main` via a
PR. **Direct pushes to `main` and `staging` are forbidden** — branch
protection enforces it.

### Merge policy (conditional)

| Team size                                 | Merge style                                                     | Rationale                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Solo / 1 active contributor** (current) | **squash-merge** feature → staging; merge-commit staging → main | WIP intermediate commits in features collapse to one canonical commit per ticket. PR title becomes the history entry. Linear, scannable history. |
| **≥2 active contributors** (future)       | **merge-commit (`--no-ff`)** at every level                     | Preserves individual commit attribution and makes bisect-within-a-feature feasible when concurrent feature branches start interleaving.          |

**Trigger to switch:** the second active contributor opens their first
PR. Switching is a one-line policy change in CLAUDE.md and a
re-tick of the GitHub repo "Allow merge commits" / "Allow squash
merging" defaults; no history rewrite.

### Bootstrap-phase exception

While the staging-only merge policy is in effect (see [`/CLAUDE.md`
"Pull requests"](../../CLAUDE.md#pull-requests) and the
[`project_staging_only_merges` memory](../../README.md)), all PRs land
on `staging` only. `main` is held static and the `staging → main`
promotion PR is deferred until the W1 vertical slice (FHS-179)
completes. Revisit per [FHS-200](https://qualicion2.atlassian.net/browse/FHS-200).

### Commit messages

Commit messages follow the Conventional Commits + Jira-key convention
documented in [`/CLAUDE.md` "Commits"](../../CLAUDE.md#commits):

- subject: `<type>(FHS-XXX): short summary`
- body: free-form description of the _why_
- footer: `Refs FHS-XXX` or `Closes FHS-XXX` to drive the
  `branch created → In Progress` and post-merge close workflow rules.

## Consequences

**Easier:** every commit, branch, and PR auto-links to a Jira ticket;
`main` is always production-deployable; the policy is uniform
regardless of who picks up a ticket; switching merge styles later is
a configuration change, not a migration.

**Harder:** PR-based workflow has more friction than push-to-main for
trivial fixes (acceptable cost); branch protection occasionally
blocks legitimate emergency hotfix patterns — admins may bypass
sparingly, with a follow-up audit comment.

## Alternatives considered

- **Trunk-based development (push directly to `main`)** — rejected:
  loses the staging integration buffer and the Jira link relies on
  PR / branch metadata.
- **Git Flow (`develop` + `release/*` + `hotfix/*`)** — rejected:
  more branches than the team needs at this stage, and the long-lived
  `develop` branch duplicates `staging`.
- **Always merge-commits, never squash** — rejected for solo phase
  per discussion above; revisit at trigger.

## References

- [ADR 0005 — Monorepo structure](0005-monorepo-structure.md)
- [`/CLAUDE.md` Pull requests / Branch & PR naming / Commits](../../CLAUDE.md#pull-requests)
