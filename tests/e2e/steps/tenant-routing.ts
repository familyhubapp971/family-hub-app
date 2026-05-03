import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

// FHS-249 — verify the SPA understands /t/:slug/* paths and that
// auth-protected children behave the same as the legacy unprefixed
// routes (anonymous bounce to /login).

Given('I open the page {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

Then('I am redirected to the login page', async ({ page }) => {
  await page.waitForURL(/\/login(\?|$)/);
  await expect(page).toHaveURL(/\/login(\?|$)/);
});
