# FHS-634: the dashboard setup guide used to keep its state in the browser, so
# it greeted a fully set-up family with "0 of 4 done" on every new browser.
# These are the scenarios that need a real browser: the counter has to read the
# family, and hiding it has to survive changing browser.

Feature: Getting started (first-run setup guide)

  As a parent who just created a family
  I want the setup guide to know what I have already done
  so that it stops asking me to redo it every time I sign in somewhere new.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario: Steps tick when the family really has them

    Given I am signed in as the admin of a freshly seeded family
    When I open the family dashboard
    Then the setup guide counts the steps my family has already done
    And the steps my family has done are ticked off

  @critical @authed-local
  Scenario: Hiding the guide follows the parent to another browser

    Given I am signed in as the admin of a freshly seeded family
    And I have hidden the setup guide on the family dashboard
    When I open the family dashboard in a different browser
    Then the setup guide does not appear

  @critical @authed-local
  Scenario: The guide is usable on a phone

    Given I am signed in as the admin of a freshly seeded family
    And I am on a phone-sized screen
    When I open the family dashboard
    Then the setup guide fits the screen with no sideways scrolling
    And its button is big enough to tap
