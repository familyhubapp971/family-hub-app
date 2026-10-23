# FHS-670: per-screen feedback. Scenario names match
# documents/features/screen-feedback.md character for character.

Feature: Feedback on each screen

  As a parent trying Family Hub
  I want to give feedback about the screen I am on
  so that the team knows exactly which part my comment is about.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario: Parent gives feedback on the Meals screen

    Given I am signed in as the admin of a freshly seeded family
    When I open the Meals screen
    And I open Feedback on this screen
    Then the form asks "How easy is Weekly Meals to use?"
    When I tap "Add meal", rate ease of use 4 and send it
    Then I see the thank-you message

  @critical @authed-local
  Scenario: The feedback button works on a phone

    Given I am signed in as the admin of a freshly seeded family
    And I am on a phone-sized screen
    When I open the Meals screen
    Then the feedback button is big enough to tap
    And the page has no sideways scrolling
    And the feedback button does not cover the end of the page
    When I open Feedback on this screen
    Then the feedback form fits the screen

  @critical @authed-local
  Scenario: The feedback button works on a tablet

    Given I am signed in as the admin of a freshly seeded family
    And I am on a tablet-sized screen
    When I open the Meals screen
    Then the feedback button is big enough to tap
    And the page has no sideways scrolling
    When I open Feedback on this screen
    Then the feedback form fits the screen

  @critical @authed-local
  Scenario: A bubble reminds parents they can give feedback on each screen

    Given I am signed in as the admin of a freshly seeded family
    When I open the Meals screen
    Then a bubble says I can give feedback on "Weekly Meals"
    When I switch to the Calendar tab
    Then a bubble says I can give feedback on "the Calendar"
