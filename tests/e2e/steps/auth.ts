import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LoginPage } from '../support/pages/LoginPage';
import { MePage } from '../support/pages/MePage';
import { SignupPage } from '../support/pages/SignupPage';

const { Given, When, Then } = createBdd();

// Synthetic e2e account on Supabase staging. Created out-of-band via
// the Admin API (see PR #X / FHS-196 PR body). Credentials live in
// .env.local (local dev) and GH Actions secrets (CI). If either is
// missing the test throws a clear error instead of silently signing
// in as the empty string.
function e2eUser() {
  const email = process.env['E2E_USER_EMAIL'];
  const password = process.env['E2E_USER_PASSWORD'];
  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set ' +
        '(.env.local for local runs; GH Actions secrets for CI). ' +
        'See infra/supabase/README.md for how the e2e user is provisioned.',
    );
  }
  return { email, password };
}

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

// ─── FHS-196 ──────────────────────────────────────────────────────────
// "Sign in with the e2e account" → visit /me → see greeting.

Given('I am signed in with the e2e test account', async ({ page }) => {
  const { email, password } = e2eUser();
  const login = new LoginPage(page);
  await login.loginAndWaitForRedirect(email, password);
});

// Slash escaped — Cucumber Expressions treat `/` as alternation.
When('I navigate to \\/me', async ({ page }) => {
  const me = new MePage(page);
  await me.open();
});

Then('I see a greeting with my email', async ({ page }) => {
  const { email } = e2eUser();
  const me = new MePage(page);
  if (await me.errorMessage().isVisible()) {
    const text = await me.errorMessage().textContent();
    throw new Error(`/me errored: ${text ?? '(no message)'}`);
  }
  await expect(me.greeting()).toBeVisible({ timeout: 15_000 });
  await expect(me.greeting()).toHaveText(`Hello, ${email}`);
});

Then('my user id and account-creation timestamp are visible', async ({ page }) => {
  const me = new MePage(page);
  // Don't pin the exact id (it's the Supabase auth user id, stable
  // across runs but env-specific) or the timestamp (created when the
  // user was first provisioned). Just assert the elements are non-empty
  // — proves the mirror row was returned, not a placeholder.
  await expect(me.userId()).toBeVisible();
  await expect(me.userId()).not.toBeEmpty();
  await expect(me.createdAt()).toBeVisible();
  await expect(me.createdAt()).not.toBeEmpty();
});
