# Scenario names here MUST match scenarios in docs/features/auth.md
# character-for-character. This is the Jira AC ↔ test traceability
# contract. See /CLAUDE.md "E2E — Playwright + playwright-bdd".

Feature: Auth

  As a prospective Family Hub member
  I want to create an account with my email and a password
  so that I can sign in and start using the app.

  # Demoted from @critical — calling staging Supabase from GH Actions
  # runners is unreliable (slow/hanging fetches to ap-south-1, no error
  # response). FHS-193 will replace this with a hermetic test that mocks
  # the supabase client OR uses a network-record/replay fixture, then
  # re-tag @critical. Until then, the scenario runs in the post-merge
  # full e2e matrix where flakiness doesn't gate PRs.
  Scenario: Visitor signs up with valid credentials
    Given I open the signup page
    When I enter a valid email and password
    And I submit the signup form
    Then I see a check-your-inbox confirmation message
