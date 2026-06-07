import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { SignupPage } from '../support/pages/SignupPage';

// Signup is email-only — family name + slug moved post-auth to the
// CreateFamilyPanel (`tests/e2e/steps/dashboard.ts` covers those).

const { Given, Then } = createBdd();

Given('I open the Signup page', async ({ page }) => {
  await new SignupPage(page).open();
});

Then('I see the social proof heading on the left panel', async ({ page }) => {
  // The aside is hidden on mobile via `md:flex`, so resize before
  // asserting visibility.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(new SignupPage(page).socialProofHeading()).toBeVisible();
});

Then('I see the Get started heading on the right panel', async ({ page }) => {
  await expect(new SignupPage(page).heading()).toBeVisible();
});

Then('I see the email field', async ({ page }) => {
  await expect(new SignupPage(page).emailInput()).toBeVisible();
});

Then('I see Continue with email and Continue with Google buttons', async ({ page }) => {
  const po = new SignupPage(page);
  await expect(po.submitButton()).toBeVisible();
  await expect(po.googleButton()).toBeVisible();
});
