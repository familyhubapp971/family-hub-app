import { createBdd } from 'playwright-bdd';
import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures.js';
import { GetStartedPage } from '../support/pages/GetStartedPage.js';

// FHS-634: the dashboard setup guide, driven through a real browser.
//
// The seeded family (support/auth/seed.ts) has one child who owns a habit but
// has no PIN, and has never chosen a sticker rate. So exactly two of the four
// steps are genuinely done, and the guide has to say so: the browser-stored
// version said "0 of 4 done" no matter how set up the family was.
//
// "I am signed in as the admin of a freshly seeded family" is defined once, in
// authed-smoke.ts; step definitions are global, so it is reused here.

const { Given, When, Then } = createBdd(test);

const EXPECTED_DONE = 2;
const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };

// The second browser's page, handed from the When step to the Then that reads
// it. Module scope is per worker, and a worker runs one scenario at a time.
let freshPage: Page | null = null;
let closeFresh: (() => Promise<void>) | null = null;

Given('I have hidden the setup guide on the family dashboard', async ({ page, authedFamily }) => {
  const guide = new GetStartedPage(page);
  await page.goto(`/t/${authedFamily.slug}/dashboard`);
  await guide.expectVisible();
  await guide.dismiss();
  await guide.expectHidden();
});

Given('I am on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize(PHONE);
});

Given('I am on a tablet-sized screen', async ({ page }) => {
  await page.setViewportSize(TABLET);
});

When('I open the family dashboard', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/dashboard`);
});

When('I open the family dashboard in a different browser', async ({ browser, authedFamily }) => {
  // A brand-new context: separate cookie jar and separate localStorage, so the
  // only thing carried over is who is signed in.
  const context = await browser.newContext();
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, authedFamily.sessionEntry);
  freshPage = await context.newPage();
  closeFresh = () => context.close();
  await freshPage.goto(`/t/${authedFamily.slug}/dashboard`);
});

Then('the setup guide counts the steps my family has already done', async ({ page }) => {
  const guide = new GetStartedPage(page);
  await guide.expectVisible();
  await guide.expectCount(EXPECTED_DONE, 4);
});

Then('the steps my family has done are ticked off', async ({ page }) => {
  const guide = new GetStartedPage(page);
  // The seeded child exists and owns a habit; nobody has a PIN and no sticker
  // rate was ever chosen.
  await guide.expectStepDone('kids');
  await guide.expectStepDone('habits');
  await guide.expectStepNotDone('pins');
  await guide.expectStepNotDone('rate');
});

Then('the setup guide does not appear', async () => {
  const page = freshPage;
  if (!page) throw new Error('no second browser page: the When step did not run');
  try {
    await new GetStartedPage(page).expectHidden();
  } finally {
    await closeFresh?.();
    freshPage = null;
    closeFresh = null;
  }
});

Then('the setup guide fits the screen with no sideways scrolling', async ({ page }) => {
  await new GetStartedPage(page).expectVisible();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

Then('its button is big enough to tap', async ({ page }) => {
  // 'pins' is the first step the seeded family has not done, so it is the one
  // carrying the button.
  const box = await new GetStartedPage(page).nextCtaBox('pins');
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});

Then('each step sits on one row', async ({ page }) => {
  // Each step is flex-col on a phone and sm:flex-row from 640px up. At tablet
  // width the icon, the text and the button share a line, so the row is far
  // shorter than the stacked version.
  const height = await new GetStartedPage(page).stepHeight('pins');
  expect(height).toBeLessThan(100);
});
