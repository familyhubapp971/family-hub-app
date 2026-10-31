# Signup is auth-first since the duplicate-family-name fix: /signup
# collects email only (or kicks off Google OAuth). Family name + slug
# are captured post-auth on the CreateFamilyPanel rendered by
# LegacyDashboardRedirect, those scenarios live in dashboard.feature
# under the no-tenant cohort.

Feature: Signup page

  As a coordinating parent who just decided to try Family Hub
  I want to enter my email and get a magic link
  so that I can start setting up my family

  @critical
  Scenario: Signup page renders both panels and the email-only form
    Given I open the Signup page
    Then I see the social proof heading on the left panel
    And I see the Get started heading on the right panel
    And I see the email field
    And I see Continue with email and Continue with Google buttons
