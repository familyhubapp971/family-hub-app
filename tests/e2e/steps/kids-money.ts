import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';

// FHS-622: Kids money at phone and tablet widths. The seeded family's one
// child has a live week and a finished week, so both rows in "Week by week"
// render for real (not just the empty state).

const { Given, When, Then } = createBdd(test);

Given('I am signed in as the admin of a seeded family for kids money', async ({ authedFamily }) => {
  expect(authedFamily.childMemberId).toBeTruthy();
});

When('I open Kids money at phone width', async ({ page, authedFamily }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${authedFamily.slug}/money`);
  await expect(page.getByTestId('kids-money-page')).toBeVisible({ timeout: 15000 });
  // The seeded family has exactly one child: no picker, just its card.
  await expect(page.getByTestId('kids-money-child-single')).toBeVisible();
});

Then('the figures and week history show without sideways scrolling', async ({ page }) => {
  await expect(page.getByTestId('kids-money-figure-available')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('kids-money-figure-saved')).toBeVisible();
  await expect(page.getByTestId('kids-money-figure-invested')).toBeVisible();
  await expect(page.getByTestId(/^kids-money-week-/).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

// "the viewport grows to tablet width" is already defined in
// steps/myworld-money-row.ts and reused here verbatim (playwright-bdd
// matches steps by text across every file, so redefining it collides).

Then('Kids money still fits without sideways scrolling', async ({ page }) => {
  await expect(page.getByTestId('kids-money-figure-available')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

// The seed inserts a finished week (Week 1, one banked action) before the
// live one (Week 2), so "Week 1" is always the closed row.
When("I open the seeded child's finished week", async ({ page }) => {
  const row = page
    .locator('[data-testid^="kids-money-week-"]')
    .filter({ hasText: 'Week 1' })
    .first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
});

Then("the week's detail fits the phone without sideways scrolling", async ({ page }) => {
  await expect(page.getByText('Moved to savings')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
