# 0004 — Billing provider: Stripe

**Status:** accepted
**Date:** 2026-04-24
**Jira:** [FHS-173](https://qualicion2.atlassian.net/browse/FHS-173)

## Context

We need subscription billing with tiered plans + metered usage,
hosted checkout, customer portal, dunning, tax, and webhook-driven
entitlement updates. Each tenant maps 1-to-1 with a billing customer.
Self-serve and bespoke enterprise contracts must coexist. Building
any of this in-house is months of work with regulatory exposure for a
small team.

## Decision

**Use Stripe as the billing provider** with Stripe-hosted Checkout for
new subscriptions and Stripe Customer Portal for self-service plan
changes / payment-method updates / cancellation.

Specifics:

- Each tenant has a `stripe_customer_id` on the `tenants` table.
- Subscription state is mirrored to a `tenant_subscriptions` table
  via Stripe webhooks (idempotent on `event.id`).
- Entitlement decisions read from the local mirror, not Stripe — keeps
  hot-path requests off the network and tolerates Stripe outages.
- Metered usage is reported via `subscription_item.usage_records` at
  the end of each tenant's billing period (batched job).
- Dunning, invoicing, tax (Stripe Tax), and proration handled by
  Stripe natively — we do not build any of it.

### Required Stripe products

Four base products, each with monthly + annual prices:

| Product | Notes |
| --- | --- |
| **Starter** | seat-capped entry tier, no metered overage |
| **Growth** | typical paid tier, seat-capped |
| **Scale** | higher seat cap + metered overage above included quota |
| **Enterprise** | usage-priced, custom flags, sales-led (not self-serve checkout) |

Plus metered prices attached to Scale / Enterprise for overage
dimensions (defined in FHS-78).

## Consequences

**Easier:** PCI scope shrinks to SAQ A (we never touch a card);
plan changes, prorations, dunning configured in dashboard not code;
tax (VAT, US sales tax) handled by Stripe Tax; one billing partner
across self-serve and enterprise.

**Harder:** webhook handling is critical-path and must be idempotent
(FHS-78); Stripe lock-in (migration would re-import customers,
recreate schedules, reconcile periods); metered usage job must not
fail silently — needs alerting; test vs live API keys never to be
crossed (separate Railway env vars per environment).

## Alternatives considered

- **Paddle** — Merchant-of-Record handling is appealing, but metered
  primitives are less mature and DX trails Stripe. Re-evaluate if MOR
  obligations bite.
- **Lemon Squeezy** — too lean for metered + enterprise.
- **Bank rails (Plaid + Stripe Connect)** — adds complexity Stripe
  Subscriptions already solves.

## Re-evaluate when

- Stripe fees materially change our margin calculus at scale.
- We sell into a market where a Merchant-of-Record provider becomes
  the default expectation.
- Stripe pricing or terms change unfavourably enough to justify the
  migration cost.

## References

- [FHS-68 — Stripe Schema and Products Setup epic](https://qualicion2.atlassian.net/browse/FHS-68)
- [FHS-73 — Checkout, Trial, and Billing Portal epic](https://qualicion2.atlassian.net/browse/FHS-73)
- [FHS-78 — Webhooks, Entitlements, and Usage Metering epic](https://qualicion2.atlassian.net/browse/FHS-78)
