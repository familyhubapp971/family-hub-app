import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { WelcomePagePO } from '../support/pages/WelcomePage';

const { Given, When, Then } = createBdd();

Given('I open the Welcome page at phone width', async ({ page }) => {
  await new WelcomePagePO(page).openAtWidth(375);
});

Given('I open the Welcome page at desktop width', async ({ page }) => {
  await new WelcomePagePO(page).openAtWidth(1280, 900);
});

When('I tap the header menu button', async ({ page }) => {
  await new WelcomePagePO(page).burgerButton().click();
});

When('I press Escape', async ({ page }) => {
  await page.keyboard.press('Escape');
});

Then('the menu panel lists Features, About, Pricing and Legal', async ({ page }) => {
  const po = new WelcomePagePO(page);
  await expect(po.menuPanel()).toBeVisible();
  for (const label of ['Features', 'About', 'Pricing', 'Legal', 'Log in']) {
    await expect(po.menuLink(label)).toBeVisible();
  }
});

Then('tapping Pricing in the menu opens the pricing page', async ({ page }) => {
  await new WelcomePagePO(page).menuLink('Pricing').click();
  await expect(page).toHaveURL(/\/pricing$/);
});

Then('the header sits on a single line', async ({ page }) => {
  expect(await new WelcomePagePO(page).headerIsSingleLine()).toBe(true);
});

Then('the public page has no horizontal scroll', async ({ page }) => {
  expect(await new WelcomePagePO(page).horizontalOverflowPx()).toBeLessThanOrEqual(0);
});

Then('the Start free button is visible', async ({ page }) => {
  await expect(new WelcomePagePO(page).startFreeButton()).toBeVisible();
});

Then('the header menu button is not shown', async ({ page }) => {
  await expect(new WelcomePagePO(page).burgerButton()).toBeHidden();
});

Then('the header shows the inline links Features, About, Pricing and Legal', async ({ page }) => {
  const nav = new WelcomePagePO(page).desktopNav();
  for (const label of ['Features', 'About', 'Pricing', 'Legal']) {
    await expect(nav.getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
  }
});

Then('the menu panel is closed', async ({ page }) => {
  await expect(new WelcomePagePO(page).menuPanel()).toHaveCount(0);
});

Then('the header menu button has focus', async ({ page }) => {
  expect(await new WelcomePagePO(page).burgerHasFocus()).toBe(true);
});
