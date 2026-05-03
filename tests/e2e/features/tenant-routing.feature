# FHS-249 — path-based tenant routing (interim until custom domain).
# The SPA must serve /t/<slug>/... so any family can be reached via a
# path prefix while we wait on real subdomains. Auth-protected pages
# stay protected — anonymous /t/<slug>/dashboard bounces to /login like
# the legacy /dashboard does.

Feature: Path-based tenant routing

  As a Family Hub user without a custom domain
  I want to reach my family's pages via /t/<slug>/...
  so that I can use the app on the shared Railway URL

  @critical
  Scenario: Anonymous visit to /t/<slug>/dashboard redirects to /login
    Given I open the page "/t/khans/dashboard"
    Then I am redirected to the login page
