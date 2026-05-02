# Scenario names here mirror the Welcome page acceptance criteria
# from FHS-221 / FHS-220. CLAUDE.md "E2E" rule keeps them in lockstep.

Feature: Welcome marketing page

  As a visitor landing on the Family Hub homepage
  I want to see what the product does and how to start
  so that I can decide whether to sign up

  @critical
  Scenario: Welcome page renders hero brand and the four feature cards
    Given I open the Welcome page
    Then I see the FamilyHub brand in the header
    And I see the cycling hero headline
    And I see four feature cards: Calendar, Tasks, Learn, Journal

  @critical
  Scenario: Start free CTA navigates to the signup page
    Given I open the Welcome page
    When I click the Start free button in the header
    Then the URL contains "/signup"

  @critical
  Scenario: Pricing nav link routes to the pricing page
    Given I open the Welcome page
    When I click the Pricing nav link
    Then the URL contains "/pricing"
