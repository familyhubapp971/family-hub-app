# Scenario names mirror the FHS-548 acceptance criteria (responsive sweep).

Feature: Responsive tap targets

  As a parent on a phone
  I want every control to be big enough to tap
  so that I can use Family Hub one-handed without mis-taps

  @critical
  Scenario: Legal pill navigation meets the 44px tap floor on a phone
    Given I open the Privacy Policy page at phone width
    Then every legal pill nav link is at least 44px tall
    And the page has no horizontal scroll

  @critical
  Scenario: Public site header fits a narrow phone without horizontal scroll
    Given I open the Privacy Policy page at width 360
    Then the page has no horizontal scroll
