# Scenario names mirror documents/features/site-header-navigation.md
# character-for-character (FHS-555). That pairing is the Jira AC ↔ test
# traceability contract.

Feature: Public site header navigation

  As a visitor arriving on a phone
  I want to reach every part of the public site from the header
  so that I can read about the product before signing up

  @critical
  Scenario: Every link is reachable on a phone
    Given I open the Welcome page at phone width
    When I tap the header menu button
    Then the menu panel lists Features, About, Pricing and Legal
    And the menu offers both Log in and Start free
    And tapping Pricing in the menu opens the pricing page

  @critical
  Scenario: Nothing wraps or overflows
    Given I open the Welcome page at phone width
    Then the header sits on a single line
    And the public page has no horizontal scroll
    And the header menu button is visible

  @critical
  Scenario: Desktop keeps the full row
    Given I open the Welcome page at desktop width
    Then the header menu button is not shown
    And the header shows the inline links Features, About, Pricing and Legal

  Scenario: Escape closes the menu and restores focus
    Given I open the Welcome page at phone width
    When I tap the header menu button
    And I press Escape
    Then the menu panel is closed
    And the header menu button has focus

  @critical
  Scenario: Keyboard users can skip past the navigation
    Given I open the Welcome page at desktop width
    When I press Tab
    Then the skip to content link is focused
    And activating it moves focus to the main content
