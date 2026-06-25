# FHS-385 — parent "Learning Insights" dashboard tab E2E scenarios.
# Parents see per-child subject progress, certificates, and highlighted gaps.

Feature: Learning Insights

  As a parent
  I want to see each child's learning progress in one place
  so that I can spot gaps and offer help where it is needed.

  @critical
  Scenario: parent sees per-child progress
    Given I am a logged-in parent on the Learning Insights tab
    Then I see the child switcher with at least one child
    And I see at least one subject card with a progress percentage

  @critical
  Scenario: spotting a gap
    Given I am a logged-in parent on the Learning Insights tab with a child who needs help
    Then I see a needs-help indicator on at least one subject card
    And I see the where-they-are-stuck panel with a parent tip

  Scenario: responsive layout on mobile
    Given I am a logged-in parent on the Learning Insights tab on a mobile viewport
    Then the subject cards stack in a single column
