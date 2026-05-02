import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { WelcomePagePO } from '../support/pages/WelcomePage';

const { Given, When, Then } = createBdd();

Given('I open the Welcome page', async ({ page }) => {
  await new WelcomePagePO(page).open();
});

Then('I see the FamilyHub brand in the header', async ({ page }) => {
  await expect(new WelcomePagePO(page).brand()).toBeVisible();
});

Then('I see the cycling hero headline', async ({ page }) => {
  // Headline cycles every 5s; assert visibility + non-empty text rather
  // than a specific string so the test isn't time-coupled.
  const heading = new WelcomePagePO(page).heroHeading();
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();
});

Then('I see four feature cards: Calendar, Tasks, Learn, Journal', async ({ page }) => {
  await new WelcomePagePO(page).assertAllFourFeatureCardsRender();
});

When('I click the Start free button in the header', async ({ page }) => {
  await new WelcomePagePO(page).startFreeButton().click();
});

When('I click the Pricing nav link', async ({ page }) => {
  await new WelcomePagePO(page).pricingNavLink().click();
});

Then('the URL contains {string}', async ({ page }, fragment: string) => {
  await expect(page).toHaveURL(new RegExp(fragment.replace('/', '\\/')));
});
