# Scenario names mirror the Signup acceptance criteria from FHS-26.
# CLAUDE.md "E2E" rule keeps them in lockstep.

Feature: Signup page

  As a coordinating parent who just decided to try Family Hub
  I want to register my family with my email
  so that I can be sent a magic link to start

  @critical
  Scenario: Signup page renders both panels and the form
    Given I open the Signup page
    Then I see the social proof heading on the left panel
    And I see the Create your family heading on the right panel
    And I see the family name, your name, and email fields
    And I see Continue with email and Continue with Google buttons

  @critical
  Scenario: Slug preview updates as the family name is typed
    Given I open the Signup page
    When I type "The Khan Family" into the family name field
    Then the slug preview shows "/t/the-khan-family"

  # FHS-225 — live debounced slug-availability check. Tagged @critical
  # because the slug check is in the core signup hot path; all four use
  # page.route() to mock /api/public/slug-available, so they're hermetic
  # and safe for PR CI.
  @critical
  Scenario: Live check shows the available indicator when the slug is free
    Given I open the Signup page
    And the slug-available endpoint returns "available" for any slug
    When I type "The Khan Family" into the family name field
    Then I see the slug-available indicator
    And the Continue with email button is enabled

  @critical
  Scenario: Live check shows suggestions and disables submit when the slug is taken
    Given I open the Signup page
    And the slug-available endpoint returns "taken" with suggestions "the-khan-family-2,khan-fam"
    When I type "The Khan Family" into the family name field
    Then I see the slug-taken indicator
    And I see suggestion "the-khan-family-2"
    And the Continue with email button is disabled

  @critical
  Scenario: Picking a suggestion overrides the slug and re-enables submit
    Given I open the Signup page
    And the slug-available endpoint returns "taken" with suggestions "the-khan-family-2" then "available"
    When I type "The Khan Family" into the family name field
    Then I see the slug-taken indicator
    When I click the suggestion "the-khan-family-2"
    Then the slug preview shows "/t/the-khan-family-2"
    And the Continue with email button is enabled

  @critical
  Scenario: Change link reveals an editable slug input
    Given I open the Signup page
    And the slug-available endpoint returns "available" for any slug
    When I type "The Khan Family" into the family name field
    And I click the Change link next to the slug preview
    Then I see the editable slug input
