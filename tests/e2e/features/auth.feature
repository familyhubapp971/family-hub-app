# Scenario names here MUST match scenarios in docs/features/auth.md
# character-for-character. This is the Jira AC ↔ test traceability
# contract. See /CLAUDE.md "E2E — Playwright + playwright-bdd".

Feature: Auth

  As a prospective Family Hub member
  I want to create an account with my email and a password
  so that I can sign in and start using the app.

  @critical
  Scenario: Visitor signs up with valid credentials
    Given I open the signup page
    When I enter a valid email and password
    And I submit the signup form
    Then I see a check-your-inbox confirmation message
