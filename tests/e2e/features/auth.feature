# Scenario names here MUST match scenarios in docs/features/auth.md
# character-for-character. This is the Jira AC ↔ test traceability
# contract. See /CLAUDE.md "E2E — Playwright + playwright-bdd".
#
# Every Supabase request is intercepted by the supabase-mock fixture
# (tests/e2e/support/fixtures/supabase-mock.ts) so these scenarios are
# hermetic — no calls leak to the staging Supabase project. That's why
# they're tagged @critical: they're deterministic and fast enough to
# gate every PR.

Feature: Auth

  As a Family Hub user
  I want sign-up, log-in, and protected-route flows to behave correctly
  so that I can access my account and trust the app's session boundary.

  @critical
  Scenario: Visitor signs up with valid credentials
    Given Supabase signup is mocked to succeed
    And I open the signup page
    When I enter a valid email and password
    And I submit the signup form
    Then I see a check-your-inbox confirmation message

  @critical
  Scenario: Signed-out visitor is redirected to login
    Given I have no Supabase session
    When I navigate to the dashboard
    Then I am redirected to the login page

  @critical
  Scenario: Signed-in user sees the dashboard
    Given I have a valid Supabase session
    When I navigate to the dashboard
    Then I see my email and a logout button

  @critical
  Scenario: User logs out from the dashboard
    Given I have a valid Supabase session
    And I am on the dashboard
    When I click "Log out"
    Then the session is cleared
    And I am redirected to the public landing
