Feature: Kid interactive habits

  A logged-in kid reads their OWN weekly habits + stickers and may place a
  sticker on today only — never a sibling's habits, never a past/finalized
  week (FHS-363). Real kid token against real Postgres.

  Background:
    Given a family with kid "Iman" (habit "Read a book"), sibling "Yusuf" (habit "Tidy room"), and a finalized past week for Iman

  Scenario: a kid reads only their own habits for the current week
    When the kid GETs /api/kid/habits with their token
    Then the kid habits response status is 200
    And the kid habits include "Read a book"
    And the kid habits do not include "Tidy room"

  Scenario: a kid places a sticker on today
    When the kid places a "gold-star" sticker on today
    Then the place-sticker response status is 200
    And the kid habits then show a sticker today

  Scenario: a kid cannot sticker a finalized week
    When the kid places a "heart" sticker on day 0 of the finalized week
    Then the place-sticker response status is 403
