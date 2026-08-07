# FHS-606: the parent My World board's money row (Your Savings, Active
# Investments, This Week) must fit a phone and a tablet with no sideways
# scrolling, per the repo's responsive merge gate. Reuses the authed
# harness proven by authed-smoke.feature.

Feature: My World money row fits every screen

  As a parent on a phone
  I want the money cards to stack and wrap to my screen
  so that nothing scrolls sideways or gets cut off.

  @critical @authed-local
  Scenario: The money row fits a phone and a tablet
    Given I am signed in as the admin of a seeded family for the money row
    When I open the child's world at phone width
    Then the money row shows its three cards without sideways scrolling
    When the viewport grows to tablet width
    Then the money row still fits without sideways scrolling

  @critical @authed-local
  Scenario: An open investment row fits a phone
    Given I am signed in as the admin of a seeded family for the money row
    When I open the child's world at phone width
    And I open the seeded investment's row
    Then its detail fits the phone without sideways scrolling
