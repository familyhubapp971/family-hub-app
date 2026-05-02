import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { PricingPagePO } from '../support/pages/PricingPage';

const { Given, When, Then } = createBdd();

Given('I open the Pricing page', async ({ page }) => {
  await new PricingPagePO(page).open();
});

Then('I see the page heading {string}', async ({ page }, expected: string) => {
  await expect(new PricingPagePO(page).pageHeading()).toContainText(expected);
});

Then('I see three tier cards: Household, Family, Family Pro', async ({ page }) => {
  await new PricingPagePO(page).assertAllThreeTiersRender();
});

Then('the Family tier shows the Most popular badge', async ({ page }) => {
  await expect(new PricingPagePO(page).mostPopularBadge()).toBeVisible();
});

When('I click the first tier CTA', async ({ page }) => {
  await new PricingPagePO(page).ctas().first().click();
});
