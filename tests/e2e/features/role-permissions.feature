# FHS-625: the profile menu only offers doors the signed-in person can walk
# through. The unit tests prove the menu's rendering rule and the integration
# tests prove the server refuses; this is the only place that drives a real
# browser through login → menu → page as someone who is NOT an admin.
#
# Scenario names match documents/features/role-permissions.md (Story 6)
# character-for-character, which is the AC traceability contract.

Feature: Who sees each money and settings door

  As an adult in the family who is not the admin
  I want the menu to show me only the pages I can use
  so that I never open one and find every control closed to me.

  @critical @authed-local
  Scenario: A door only shows if it leads somewhere
    Given I am signed in as an adult who is not the admin
    When I open the profile menu on the dashboard
    Then I see the Kids money, Earning rules and Manage family doors
    And I do not see the Family settings door

  @critical @authed-local
  Scenario: A grown-up can still move a child's money
    Given I am signed in as an adult who is not the admin
    When I open Kids money
    Then the child's figures show

  @critical @authed-local
  Scenario: Someone who may not see a child's money is sent back
    Given I am signed in as a teen
    When I go to the Kids money address
    Then I land on the dashboard without ever seeing a child's money

  # FHS-645: the scenarios above demote the family's only admin, which leaves a
  # family with no admin at all. This one adds a REAL second adult alongside a
  # real admin, which is the arrangement an actual family is in.
  @critical @authed-local
  Scenario: The family's second grown-up still sees no Family settings door
    Given I am signed in as the family's second grown-up
    When I open the profile menu as the second grown-up
    Then I see the Kids money, Earning rules and Manage family doors
    And I do not see the Family settings door
