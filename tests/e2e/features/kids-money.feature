# FHS-622: Kids money must fit a phone and a tablet with no sideways
# scrolling, per the repo's responsive merge gate. Reuses the authed
# harness proven by authed-smoke.feature.

Feature: Kids money fits every screen

  As an admin on a phone
  I want the child's figures and week history to stack and fit my screen
  so that nothing scrolls sideways or gets cut off.

  @critical @authed-local
  Scenario: Kids money fits a phone and a tablet
    Given I am signed in as the admin of a seeded family for kids money
    When I open Kids money at phone width
    Then the figures and week history show without sideways scrolling
    When the viewport grows to tablet width
    Then Kids money still fits without sideways scrolling

  @critical @authed-local
  Scenario: Opening a week's detail fits a phone
    Given I am signed in as the admin of a seeded family for kids money
    When I open Kids money at phone width
    And I open the seeded child's finished week
    Then the week's detail fits the phone without sideways scrolling
