import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { LearningInsightsPage } from '../support/pages/LearningInsightsPage';
import { LoginPage } from '../support/pages/LoginPage';

// FHS-385 — Learning Insights E2E step definitions.
// These tests run against the live staging environment and rely on the
// FHS-196 synthetic parent account having at least one child member.

const { Given, Then } = createBdd();

const E2E_EMAIL = process.env['E2E_PARENT_EMAIL'] ?? 'e2e-parent@fhapp.co';
const E2E_PASS = process.env['E2E_PARENT_PASSWORD'] ?? '';
const E2E_SLUG = process.env['E2E_TENANT_SLUG'] ?? 'e2e-family';

async function openTab(page: import('@playwright/test').Page) {
  if (E2E_PASS) {
    await new LoginPage(page).loginAndWaitForRedirect(E2E_EMAIL, E2E_PASS);
  }
  await page.goto(`/t/${E2E_SLUG}/dashboard?tab=learning-insights`);
  await page.waitForSelector('[data-testid="learning-insights-panel"]', { timeout: 15_000 });
}

Given('I am a logged-in parent on the Learning Insights tab', async ({ page }) => {
  await openTab(page);
});

Given(
  'I am a logged-in parent on the Learning Insights tab with a child who needs help',
  async ({ page }) => {
    // Same setup — the e2e fixture child has at least one needsHelp subject.
    await openTab(page);
  },
);

Given(
  'I am a logged-in parent on the Learning Insights tab on a mobile viewport',
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTab(page);
  },
);

Then('I see the child switcher with at least one child', async ({ page }) => {
  const li = new LearningInsightsPage(page);
  await expect(li.childSwitcher()).toBeVisible();
  await expect(li.childPills().first()).toBeVisible();
});

Then('I see at least one subject card with a progress percentage', async ({ page }) => {
  const li = new LearningInsightsPage(page);
  // Wait for the grid — may need a child to be selected first
  await expect(li.subjectCardsGrid()).toBeVisible({ timeout: 10_000 });
  await expect(li.subjectCards().first()).toBeVisible();
  // At least one progress ring must carry an aria-label with "%"
  const ring = page.locator('[data-testid="progress-ring"]').first();
  const label = await ring.getAttribute('aria-label');
  expect(label).toMatch(/%/);
});

Then('I see a needs-help indicator on at least one subject card', async ({ page }) => {
  const li = new LearningInsightsPage(page);
  await expect(li.needsHelpChips().first()).toBeVisible({ timeout: 10_000 });
});

Then('I see the where-they-are-stuck panel with a parent tip', async ({ page }) => {
  const li = new LearningInsightsPage(page);
  await expect(li.weakestPanel()).toBeVisible({ timeout: 10_000 });
  await expect(li.weakestTip()).not.toBeEmpty();
});

Then('the subject cards stack in a single column', async ({ page }) => {
  const li = new LearningInsightsPage(page);
  await expect(li.subjectCardsGrid()).toBeVisible({ timeout: 10_000 });
  const cards = li.subjectCards();
  const count = await cards.count();
  if (count < 2) return; // nothing to compare
  const box0 = await cards.nth(0).boundingBox();
  const box1 = await cards.nth(1).boundingBox();
  // In a single-column layout each card starts at x≈0 and stacks vertically.
  expect(box0).not.toBeNull();
  expect(box1).not.toBeNull();
  // Cards are stacked: second card starts below the first (y > box0.y).
  expect(box1!.y).toBeGreaterThan(box0!.y);
  // And they share the same left x position (single column, same left edge).
  expect(Math.abs(box1!.x - box0!.x)).toBeLessThan(10);
});
