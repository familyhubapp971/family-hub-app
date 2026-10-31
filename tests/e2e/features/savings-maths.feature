# FHS-646: the money side is the heart of the app and had no browser test. The
# integration tier proves the save endpoint's arithmetic; this is the only
# place a grown-up moves a child's stickers on the real screen and the figures
# AND the audit trail are checked together afterwards.
#
# Scenario names match documents/features/kids-money.md (Story: savings maths),
# which is the AC traceability contract.

Feature: A child's savings maths adds up

  As a parent moving my child's stickers into savings
  I want the figures to move by exactly what I moved
  so that I can trust the money side of the app.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario: Moving stickers to savings adds up
    Given my child has 7 stickers ready to spend
    When I move 5 of them into savings and confirm once
    Then the app tells me 5 moved and 2 are still ready to spend
    And exactly one save of 5 stickers is recorded

  @critical @authed-local
  Scenario: Confirming twice still only saves once
    Given my child has 7 stickers ready to spend
    When I move 5 into savings and tap confirm twice
    Then exactly one save of 5 stickers is recorded

  @critical @authed-local
  Scenario: A child cannot save more than they have
    Given my child has 7 stickers ready to spend
    When I try to move more stickers than my child has
    Then the amount is held at 7
