import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { SignupPage } from '../support/pages/SignupPage';
import { DashboardPage } from '../support/pages/DashboardPage';
import { installSignupMocks, installAuthenticatedSession } from '../support/fixtures/supabase-mock';

const { Given, When, Then } = createBdd();

// Per-run unique address. Even with mocked Supabase, the email is
// rendered into the success page — keeping it unique makes the trace
// for a failed test point at the exact run.
function uniqueEmail(): string {
  return `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@familyhub.test`;
}

let lastEmail = '';

// --- signup flow -----------------------------------------------------

Given('Supabase signup is mocked to succeed', async ({ page }) => {
  await installSignupMocks(page);
});

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
  if (await signup.errorMessage().isVisible()) {
    const text = await signup.errorMessage().textContent();
    throw new Error(`signup failed for ${lastEmail}: ${text ?? '(no message)'}`);
  }
  await expect(signup.successMessage()).toBeVisible({ timeout: 10_000 });
});

// --- protected route + dashboard -------------------------------------

Given('I have no Supabase session', async ({ page }) => {
  // No session seed — just clear localStorage so a previous scenario in
  // the same worker doesn't leave a session behind. The supabase client
  // will start with `session: null`.
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore — we only care about the auth-token entry not existing
    }
  });
});

Given('I have a valid Supabase session', async ({ page }) => {
  await installAuthenticatedSession(page);
});

Given('I am on the dashboard', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await expect(dashboard.email()).toBeVisible({ timeout: 10_000 });
});

When('I navigate to the dashboard', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();
});

Then('I am redirected to the login page', async ({ page }) => {
  await page.waitForURL('**/login', { timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe('/login');
});

Then('I see my email and a logout button', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await expect(dashboard.email()).toBeVisible({ timeout: 10_000 });
  await expect(dashboard.email()).toHaveText('mock@familyhub.test');
  await expect(dashboard.logoutButton()).toBeVisible();
});

When('I click "Log out"', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.logout();
});

Then('the session is cleared', async ({ page }) => {
  // The dashboard's onLogout handler awaits supabase.auth.signOut() and
  // then navigates — so by the time the URL flips, the storage should
  // already be empty. Polling here would mask a regression where signOut
  // races with navigate; assert the post-condition directly.
  const remaining = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        keys.push(key);
      }
    }
    return keys;
  });
  expect(remaining).toEqual([]);
});

Then('I am redirected to the public landing', async ({ page }) => {
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe('/');
});
