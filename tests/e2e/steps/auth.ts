import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { SignupPage } from '../support/pages/SignupPage';

const { Given, When, Then } = createBdd();

// Use a per-run unique address so reruns don't collide with the same
// auth.users row in the staging Supabase project. The "Check your
// inbox" copy is what we assert; we never click the email link here
// — that's FHS-193 territory.
function uniqueEmail(): string {
  return `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@familyhub.test`;
}

let lastEmail = '';

Given('I open the signup page', async ({ page }) => {
  const signup = new SignupPage(page);
  await signup.open();
});

When('I enter a valid email and password', async ({ page }) => {
  const signup = new SignupPage(page);
  lastEmail = uniqueEmail();
  await signup.fillCredentials(lastEmail, 'CorrectHorseBattery42!');
});

When('I submit the signup form', async ({ page }) => {
  const signup = new SignupPage(page);
  await signup.submit();
});

Then('I see a check-your-inbox confirmation message', async ({ page }) => {
  const signup = new SignupPage(page);
  // If Supabase rejects, surface its error in the assertion message
  // instead of waiting out the full timeout on the success locator.
  if (await signup.errorMessage().isVisible()) {
    const text = await signup.errorMessage().textContent();
    throw new Error(`signup failed for ${lastEmail}: ${text ?? '(no message)'}`);
  }
  await expect(signup.successMessage()).toBeVisible({ timeout: 15_000 });
});
