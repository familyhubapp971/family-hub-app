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

// FHS-607: the seeded family carries one active investment, so the card shows
// a real row. Opening it must not push the page sideways on a phone.
When("I open the seeded investment's row", async ({ page }) => {
  const row = page.getByTestId(/^investment-row-/).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
});

Then('its detail fits the phone without sideways scrolling', async ({ page }) => {
  await expect(page.getByText('each day it is done.')).toBeVisible();
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

// FHS-608: the finished-week recap (banner, Habits that week, Final summary).
// The seeded family's week is open, so the spec walks back one week: the
// board creates the previous week on demand and shows it as a record.
When('I move back to the finished week', async ({ page }) => {
  await page.getByTestId('habit-tracker-week-prev-btn').click();
  await expect(page.getByTestId('finalized-week-banner')).toBeVisible({ timeout: 15000 });
});

Then("the finished week's recap fits without sideways scrolling", async ({ page }) => {
  await expect(page.getByTestId('finalized-week-banner')).toContainText('This week is finished');
  await expect(page.getByTestId('finalized-week-summary')).toBeVisible();
  // The seeded finished week banked 3 stickers and had no habit days done, so
  // the card is checked against real figures, not just for being on screen.
  await expect(page.getByTestId('finalized-saved-stars')).toContainText('3 stickers');
  await expect(page.getByTestId('finalized-days-done')).toContainText('0 of 7');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
