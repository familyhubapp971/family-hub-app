import { createBdd } from 'playwright-bdd';
import { test, expect } from '../support/fixtures.js';
import {
  DASHBOARD_AREAS,
  FamilyDashboardPO,
  type DashboardAreaLabel,
} from '../support/pages/FamilyDashboardPage.js';

// FHS-645: two families on purpose. `populatedFamily` has one real row behind
// every tab, so "the area loaded" means something; `authedFamily` is the
// minimal seed, which is what a family looks like on day one.

const { Given, When, Then } = createBdd(test);

const AREA_LABELS = Object.keys(DASHBOARD_AREAS) as DashboardAreaLabel[];

Given(
  'I am signed in as the admin of a family with something in every area',
  async ({ page, populatedFamily }) => {
    const dashboard = new FamilyDashboardPO(page);
    await dashboard.open(populatedFamily.slug);
    await expect(dashboard.familyName()).toBeVisible({ timeout: 15000 });
  },
);

Given(
  'I am signed in as the admin of a family with nothing in it yet',
  async ({ page, authedFamily }) => {
    const dashboard = new FamilyDashboardPO(page);
    await dashboard.open(authedFamily.slug);
    await expect(dashboard.familyName()).toBeVisible({ timeout: 15000 });
  },
);

Given('I am on a phone-sized screen for the dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
});

When(/^I open the (.+) area$/, async ({ page }, area: string) => {
  await new FamilyDashboardPO(page).openArea(area as DashboardAreaLabel);
});

Then(/^the (.+) area shows our things without an error$/, async ({ page }, area: string) => {
  const dashboard = new FamilyDashboardPO(page);
  const label = area as DashboardAreaLabel;
  await expect(dashboard.panelReady(label)).toBeVisible({ timeout: 15000 });
  await expect(dashboard.panelError(label)).toHaveCount(0);
});

Then(/^the (.+) area says there is nothing there yet$/, async ({ page }, area: string) => {
  const dashboard = new FamilyDashboardPO(page);
  const label = area as DashboardAreaLabel;
  await expect(dashboard.panelEmpty(label)).toBeVisible({ timeout: 15000 });
  await expect(dashboard.panelError(label)).toHaveCount(0);
});

When('I open every dashboard area in turn', async ({ page }) => {
  const dashboard = new FamilyDashboardPO(page);
  for (const label of AREA_LABELS) {
    await dashboard.openArea(label);
    await expect(dashboard.panelReady(label)).toBeVisible({ timeout: 15000 });
  }
});

Then('no area scrolls sideways', async ({ page }) => {
  const dashboard = new FamilyDashboardPO(page);
  for (const label of AREA_LABELS) {
    await dashboard.openArea(label);
    await expect(dashboard.panelReady(label)).toBeVisible({ timeout: 15000 });
    // 1px of slack: sub-pixel rounding, not a layout that runs off the screen.
    expect(
      await dashboard.horizontalOverflowPx(),
      `${label} overflows sideways`,
    ).toBeLessThanOrEqual(1);
  }
});
