# Scenario names mirror the Pricing page acceptance criteria from
# FHS-222 / FHS-220. CLAUDE.md "E2E" rule keeps them in lockstep.

Feature: Pricing page

  As a visitor on the pricing page
  I want to see every tier with its features and price
  so that I can choose the right plan and start

  @critical
  Scenario: Pricing page renders three tier cards in correct order
    Given I open the Pricing page
    Then I see the page heading "Simple, honest pricing"
    And I see three tier cards: Household, Family, Family Pro
    And the Family tier shows the Most popular badge

  @critical
  Scenario: Every tier CTA routes to the signup page
    Given I open the Pricing page
    When I click the first tier CTA
    Then the URL contains "/signup"
