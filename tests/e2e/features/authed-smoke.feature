# FHS-516: proves the authed e2e harness (tests/e2e/support/fixtures.ts +
# support/auth/*) actually works end to end: a test-minted JWT the running
# api verifies via E2E_TEST_JWKS, a real seeded family in Postgres, and a
# supabase-js session injected into localStorage so the browser never has
# to drive a real login. This is the ONE smoke spec proving the harness:
# future specs needing a signed-in `/t/:slug/*` page reuse the same
# `authedFamily` fixture instead of re-solving auth.

Feature: Authed family pages (E2E auth harness)

  As a Family Hub engineer
  I want a reusable way to drive authenticated /t/:slug pages in Playwright
  so that future specs can test signed-in flows without a real login round trip.

  # @authed-local: this scenario needs the LOCAL api booted with the
  # E2E_TEST_JWKS override (it trusts test-minted tokens). The full matrix
  # (playwright.config.ts) points the web app at the real staging api for the
  # legacy real-login auth.feature spec, so authed-local specs run ONLY in the
  # critical config (which points web at the local api). See playwright.config.ts.
  @critical @authed-local
  Scenario: A signed-in family admin sees their own family on the Manage Family page
    Given I am signed in as the admin of a freshly seeded family
    When I open the Manage Family page for that family
    Then I see that family's name in the page header
    And the member summary shows 2 members and 0 waiting to join
