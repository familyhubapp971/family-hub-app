# FHS-638: the browser test FHS-637 shipped without.
#
# The My World board only offers "Close Week" from the week's last day onward,
# so a spec written against the ordinary seeded family passes on Sundays and
# fails the rest of the week. These use the seed variant that anchors the week
# so today IS its last day, whatever day that is.

Feature: Closing the week from the My World board

  As a parent finishing a week
  I want the same screen the rest of the app uses
  so that the last step does not look like a different product.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario: Close Week opens the approved chooser

    Given I am signed in as the admin of a family whose week ends today
    When I open my child's board and tap Close Week
    Then I see the chooser, with what the stickers are worth
    And every choice is there, each with a line of explanation

  @critical @authed-local
  Scenario: The header is readable

    Given I am signed in as the admin of a family whose week ends today
    When I open my child's board and tap Close Week
    Then the header is the deep purple from the design
    And nothing in the header is the same colour as what it sits on

  @critical @authed-local
  Scenario: The chooser is usable on a phone

    Given I am signed in as the admin of a family whose week ends today
    And I am on a phone-sized screen for closing the week
    When I open my child's board and tap Close Week
    Then the chooser fits the screen with no sideways scrolling
    And every choice is big enough to tap

  @critical @authed-local
  Scenario: The chooser is usable on a tablet

    Given I am signed in as the admin of a family whose week ends today
    And I am on a tablet-sized screen for closing the week
    When I open my child's board and tap Close Week
    Then the chooser fits the screen with no sideways scrolling
    And every choice is big enough to tap
