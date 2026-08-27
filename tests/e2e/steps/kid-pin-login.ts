import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';
import { KidSignInPO } from '../support/pages/KidSignInPage.js';

// FHS-645: `kidFamily` deliberately injects NO grown-up session. The PIN
// screen is the way in, so signing in is part of what is under test.

const { Given, When, Then } = createBdd(test);

function personas(family: { personas?: { pin: string } }) {
  if (!family.personas) throw new Error('kid specs need a family seeded with personas');
  return family.personas;
}

Given("I open my family's kid sign-in", async ({ page, kidFamily }) => {
  const signIn = new KidSignInPO(page);
  await signIn.open(kidFamily.slug);
  await expect(signIn.avatars()).toBeVisible({ timeout: 15000 });
});

When('I tap my face and type my PIN', async ({ page, kidFamily }) => {
  const signIn = new KidSignInPO(page);
  await signIn.choose(kidFamily.personaNames.child);
  await expect(signIn.pinSection()).toBeVisible();
  await signIn.enterPin(personas(kidFamily).pin);
});

When('the teen taps their face and types their PIN', async ({ page, kidFamily }) => {
  const signIn = new KidSignInPO(page);
  await signIn.choose(kidFamily.personaNames.teen);
  await expect(signIn.pinSection()).toBeVisible();
  await signIn.enterPin(personas(kidFamily).pin);
});

When('I tap my face and type the wrong PIN', async ({ page, kidFamily }) => {
  const signIn = new KidSignInPO(page);
  await signIn.choose(kidFamily.personaNames.child);
  await expect(signIn.pinSection()).toBeVisible();
  await signIn.enterPin('9999');
});

Then('my world opens', async ({ page, kidFamily }) => {
  await page.waitForURL(`**/t/${kidFamily.slug}/dashboard`, { timeout: 15000 });
  await expect(page.getByTestId('kid-dashboard')).toBeVisible({ timeout: 15000 });
});

Then('I am told the PIN is wrong and I am still on the PIN screen', async ({ page }) => {
  await expect(page.getByTestId('kid-login-error')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('kid-login-pin-section')).toBeVisible();
  await expect(page.getByTestId('kid-dashboard')).toHaveCount(0);
});

When('I go straight to the family settings address', async ({ page, kidFamily }) => {
  await page.goto(`/t/${kidFamily.slug}/family-settings`);
});

Then('I never see family settings', async ({ page }) => {
  // The route admits grown-ups only, so a child is sent to the parent log-in
  // and the settings page must never have rendered on the way past.
  await page.waitForURL('**/login', { timeout: 15000 });
  await expect(page.getByTestId('family-settings-page')).toHaveCount(0);
  await expect(page.getByTestId('family-settings-ready')).toHaveCount(0);
});
