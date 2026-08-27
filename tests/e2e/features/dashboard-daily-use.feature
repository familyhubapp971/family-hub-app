# FHS-645: the six areas of the parent dashboard are the app's daily driver and
# had no browser test at all. The integration tier proves each area's API
# answers; this is the only place that clicks the tabs a parent clicks and
# checks something real came back.

Feature: The family dashboard works every day

  As a parent opening Family Hub in the morning
  I want every area of the dashboard to open and show our family's things
  so that I can run the day without hitting a broken screen.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario Outline: Every dashboard area opens and shows what the family has
    Given I am signed in as the admin of a family with something in every area
    When I open the <area> area
    Then the <area> area shows our things without an error

    Examples:
      | area             |
      | Family Dashboard |
      | Meals            |
      | Calendar         |
      | Assignments      |
      | Noticeboard      |
      | Tasks            |

  @critical @authed-local
  Scenario: A brand new family is told an area is empty, not shown a broken one
    Given I am signed in as the admin of a family with nothing in it yet
    When I open the Assignments area
    Then the Assignments area says there is nothing there yet
    When I open the Noticeboard area
    Then the Noticeboard area says there is nothing there yet

  @critical @authed-local
  Scenario: Every dashboard area fits a phone
    Given I am signed in as the admin of a family with something in every area
    And I am on a phone-sized screen for the dashboard
    When I open every dashboard area in turn
    Then no area scrolls sideways
