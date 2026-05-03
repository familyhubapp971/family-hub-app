import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LoginPage } from '../support/pages/LoginPage';

const { Given, Then } = createBdd();

// FHS-224 — passwordless login UI assertions. The
// `Given I open the page "..."` and `Then I am redirected to the login page`
// steps are shared with tests/e2e/steps/tenant-routing.ts (don't redefine).

Given('I open the login page', async ({ page }) => {
  await new LoginPage(page).open();
});

Then('I see the login email field', async ({ page }) => {
  await expect(new LoginPage(page).emailInput()).toBeVisible();
});

Then('the login submit button is labelled Continue with email', async ({ page }) => {
  const button = new LoginPage(page).submitButton();
  await expect(button).toBeVisible();
  await expect(button).toContainText(/continue with email/i);
});

Then('I see the Continue with Google button on the login page', async ({ page }) => {
  await expect(new LoginPage(page).googleButton()).toBeVisible();
});

Then('no password field is visible on the login page', async ({ page }) => {
  await expect(page.getByTestId('login-password')).toHaveCount(0);
});
