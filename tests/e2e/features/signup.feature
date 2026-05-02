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
