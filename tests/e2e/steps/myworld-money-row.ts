import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';

// FHS-606: the money row at phone and tablet widths. The seeded family's
// child has a current week, so the parent board renders the row.

const { Given, When, Then } = createBdd(test);

Given(
  'I am signed in as the admin of a seeded family for the money row',
  async ({ authedFamily }) => {
    expect(authedFamily.childMemberId).toBeTruthy();
  },
);

When("I open the child's world at phone width", async ({ page, authedFamily }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/t/${authedFamily.slug}/child/${authedFamily.childMemberId}`);
  await expect(page.getByTestId('money-row')).toBeVisible({ timeout: 15000 });
});

Then('the money row shows its three cards without sideways scrolling', async ({ page }) => {
  const row = page.getByTestId('money-row');
  await expect(row.getByTestId('your-savings')).toBeVisible();
  await expect(row.getByTestId('active-investments')).toBeVisible();
  await expect(row.getByTestId('bankable-week')).toBeVisible();
  // The page must not scroll sideways at phone width (1px slack for
  // subpixel rounding).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

When('the viewport grows to tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByTestId('money-row')).toBeVisible();
});

Then('the money row still fits without sideways scrolling', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
