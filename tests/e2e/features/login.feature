# FHS-224 — passwordless login (magic-link + Google).
# The /login UI was rewritten to drop the password field per ADR 0011.

Feature: Login page

  As a returning Family Hub user
  I want to sign in with a magic link or Google (no password)
  so that I never have to remember credentials.

  @critical
  Scenario: Login page renders the magic-link form (no password field)
    Given I open the login page
    Then I see the login email field
    And the login submit button is labelled Continue with email
    And I see the Continue with Google button on the login page
    And no password field is visible on the login page

  @critical
  Scenario: /auth/reset-request redirects to /login (passwords retired)
    Given I open the page "/auth/reset-request"
    Then I am redirected to the login page
