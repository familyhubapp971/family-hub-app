# FHS-645: the child's own way into Family Hub had no browser test. The
# integration tier proves the PIN endpoint answers correctly; this is the only
# place a child actually picks their face, types four digits, and lands in
# their world, on the screen they really use.

Feature: A child signs in with their PIN

  As a child using the family tablet
  I want to tap my face and type my PIN
  so that I get into my own world without needing a grown-up's password.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario: The right PIN opens the child's own world
    Given I open my family's kid sign-in
    When I tap my face and type my PIN
    Then my world opens

  @critical @authed-local
  Scenario: A wrong PIN says so and keeps the child out
    Given I open my family's kid sign-in
    When I tap my face and type the wrong PIN
    Then I am told the PIN is wrong and I am still on the PIN screen

  @critical @authed-local
  Scenario: A teen signs in the same way
    Given I open my family's kid sign-in
    When the teen taps their face and types their PIN
    Then my world opens

  @critical @authed-local
  Scenario: A signed-in child cannot open the grown-ups' family settings
    Given I open my family's kid sign-in
    When I tap my face and type my PIN
    And I go straight to the family settings address
    Then I never see family settings
