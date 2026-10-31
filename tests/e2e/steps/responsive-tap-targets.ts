import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LegalPagePO } from '../support/pages/LegalPage';

const { Given, Then } = createBdd();

Given('I open the Privacy Policy page at phone width', async ({ page }) => {
  await new LegalPagePO(page).openPrivacyAtPhoneWidth();
});

Given('I open the Privacy Policy page at width {int}', async ({ page }, width: number) => {
  await new LegalPagePO(page).openPrivacyAtPhoneWidth(width);
});

Then('every legal pill nav link is at least 44px tall', async ({ page }) => {
  const pills = new LegalPagePO(page).pillNavLinks();
  await expect(pills).toHaveCount(4);
  for (const pill of await pills.all()) {
    const box = await pill.boundingBox();
    expect(box, 'pill nav link should be visible').not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

Then('the page has no horizontal scroll', async ({ page }) => {
  expect(await new LegalPagePO(page).horizontalOverflowPx()).toBeLessThanOrEqual(0);
});
