# Scenario names here MUST match scenarios in docs/features/<slug>.md
# character-for-character. This is the Jira AC ↔ test traceability
# contract. See /CLAUDE.md "E2E — Playwright + playwright-bdd".

Feature: Landing page

  As a visitor
  I want to load the Family Hub landing page
  so that I can see the API is alive end-to-end

  @critical
  Scenario: Health page renders the /hello payload
    Given I open the landing page
    Then I see the Family Hub heading
    And the hello message is shown
    And the hello timestamp is shown
