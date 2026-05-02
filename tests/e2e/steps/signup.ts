import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { SignupPage } from '../support/pages/SignupPage';

const { Given, When, Then } = createBdd();

Given('I open the Signup page', async ({ page }) => {
  await new SignupPage(page).open();
});

Then('I see the social proof heading on the left panel', async ({ page }) => {
  // The aside is hidden on mobile via `md:flex`, so resize before
  // asserting visibility.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(new SignupPage(page).socialProofHeading()).toBeVisible();
});

Then('I see the Create your family heading on the right panel', async ({ page }) => {
  await expect(new SignupPage(page).heading()).toBeVisible();
});

Then('I see the family name, your name, and email fields', async ({ page }) => {
  const po = new SignupPage(page);
  await expect(po.familyNameInput()).toBeVisible();
  await expect(po.displayNameInput()).toBeVisible();
  await expect(po.emailInput()).toBeVisible();
});

Then('I see Continue with email and Continue with Google buttons', async ({ page }) => {
  const po = new SignupPage(page);
  await expect(po.submitButton()).toBeVisible();
  await expect(po.googleButton()).toBeVisible();
});

When('I type {string} into the family name field', async ({ page }, value: string) => {
  await new SignupPage(page).familyNameInput().fill(value);
});

Then('the slug preview shows {string}', async ({ page }, expected: string) => {
  await expect(new SignupPage(page).slugPreview()).toContainText(expected);
});
