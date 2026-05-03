# FHS-223 — /verify-email page (post-signup magic-link confirmation).

Feature: Verify-email page

  As a user who just submitted the signup form
  I want a clear "check your inbox" page with my email and a way to retry
  so that I know what to do next without staring at a blank screen

  @critical
  Scenario: Verify-email page renders with the email from the query param
    Given I open the page "/verify-email?email=sarah@example.com"
    Then I see the verify-email heading
    And I see the email "sarah@example.com" on the verify-email page
    And the Open Gmail link points at mail.google.com

  @critical
  Scenario: Back link returns to the signup page
    Given I open the page "/verify-email?email=sarah@example.com"
    When I click the verify-email back link
    Then I am on the signup page
