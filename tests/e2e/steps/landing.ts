import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LandingPage } from '../support/pages/LandingPage';

const { Given, Then } = createBdd();

Given('I open the landing page', async ({ page }) => {
  const landing = new LandingPage(page);
  await landing.open();
});

Then('I see the Family Hub heading', async ({ page }) => {
  const landing = new LandingPage(page);
  await expect(landing.heading()).toBeVisible();
});

Then('the hello message is shown', async ({ page }) => {
  const landing = new LandingPage(page);
  await expect(landing.helloMessage()).toBeVisible();
  await expect(landing.helloMessage()).not.toBeEmpty();
});

Then('the hello timestamp is shown', async ({ page }) => {
  const landing = new LandingPage(page);
  await expect(landing.helloTimestamp()).toBeVisible();
});
