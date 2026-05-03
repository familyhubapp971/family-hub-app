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

// FHS-225 — slug-availability live check.

Given(
  'the slug-available endpoint returns {string} for any slug',
  async ({ page }, kind: string) => {
    await page.route('**/api/public/slug-available**', async (route) => {
      const available = kind === 'available';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available, suggestions: [] }),
      });
    });
  },
);

Given(
  'the slug-available endpoint returns {string} with suggestions {string}',
  async ({ page }, kind: string, suggestionsCsv: string) => {
    const suggestions = suggestionsCsv.split(',').map((s) => s.trim());
    await page.route('**/api/public/slug-available**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: kind === 'available', suggestions }),
      });
    });
  },
);

Given(
  'the slug-available endpoint returns {string} with suggestions {string} then {string}',
  async ({ page }, firstKind: string, suggestionsCsv: string, secondKind: string) => {
    const suggestions = suggestionsCsv.split(',').map((s) => s.trim());
    let calls = 0;
    await page.route('**/api/public/slug-available**', async (route) => {
      calls += 1;
      const kind = calls === 1 ? firstKind : secondKind;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: kind === 'available',
          suggestions: kind === 'available' ? [] : suggestions,
        }),
      });
    });
  },
);

Then('I see the slug-available indicator', async ({ page }) => {
  await expect(new SignupPage(page).slugAvailable()).toBeVisible();
});

Then('I see the slug-taken indicator', async ({ page }) => {
  await expect(new SignupPage(page).slugTaken()).toBeVisible();
});

Then('I see suggestion {string}', async ({ page }, suggestion: string) => {
  await expect(new SignupPage(page).slugSuggestions()).toContainText(suggestion);
});

Then('the Continue with email button is enabled', async ({ page }) => {
  await expect(new SignupPage(page).submitButton()).toBeEnabled();
});

Then('the Continue with email button is disabled', async ({ page }) => {
  await expect(new SignupPage(page).submitButton()).toBeDisabled();
});

When('I click the suggestion {string}', async ({ page }, suggestion: string) => {
  await new SignupPage(page).slugSuggestions().getByRole('button', { name: suggestion }).click();
});

When('I click the Change link next to the slug preview', async ({ page }) => {
  await new SignupPage(page).changeSlugLink().click();
});

Then('I see the editable slug input', async ({ page }) => {
  await expect(new SignupPage(page).slugInput()).toBeVisible();
});
