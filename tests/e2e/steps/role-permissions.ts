import { createBdd } from 'playwright-bdd';
import { and, eq } from 'drizzle-orm';
import { test, expect } from '../support/fixtures.js';
import { getE2eDb, schema } from '../support/auth/db.js';

// FHS-625: the authedFamily fixture always seeds its caller as the family's
// admin, which is the one role that sees everything. To drive the browser as
// somebody else, demote that member's role in the database before the first
// page load: the JWT carries only the user id, so the role comes from the
// members row on every request and nothing has to be re-minted.

const { Given, When, Then } = createBdd(test);

async function signInAs(role: string, tenantId: string, userId: string) {
  const db = getE2eDb();
  await db
    .update(schema.members)
    .set({ role, isChild: role === 'teen' || role === 'child' })
    .where(and(eq(schema.members.tenantId, tenantId), eq(schema.members.userId, userId)));
}

Given('I am signed in as an adult who is not the admin', async ({ authedFamily }) => {
  await signInAs('adult', authedFamily.tenantId, authedFamily.userId);
});

Given('I am signed in as a teen', async ({ authedFamily }) => {
  await signInAs('teen', authedFamily.tenantId, authedFamily.userId);
});

When('I open the profile menu on the dashboard', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/dashboard`);
  // The doors only render once /api/me has answered with the caller's role,
  // so wait for the family name (same response) before opening the menu.
  await expect(page.getByTestId('dashboard-family-name')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('dashboard-profile-pill').click();
  await expect(page.getByTestId('dashboard-profile-menu')).toBeVisible();
});

Then('I see the Kids money, Earning rules and Manage family doors', async ({ page }) => {
  await expect(page.getByTestId('dashboard-profile-kids-money')).toBeVisible();
  await expect(page.getByTestId('dashboard-profile-reward-settings')).toBeVisible();
  await expect(page.getByTestId('dashboard-profile-manage-members')).toBeVisible();
});

Then('I do not see the Family settings door', async ({ page }) => {
  await expect(page.getByTestId('dashboard-profile-family-settings')).toHaveCount(0);
});

When('I open Kids money', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/money`);
});

Then("the child's figures show", async ({ page }) => {
  await expect(page.getByTestId('kids-money-page')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('kids-money-figure-available')).toBeVisible({ timeout: 15000 });
});

When('I go to the Kids money address', async ({ page, authedFamily }) => {
  await page.goto(`/t/${authedFamily.slug}/money`);
});

Then(
  "I land on the dashboard without ever seeing a child's money",
  async ({ page, authedFamily }) => {
    await page.waitForURL(`**/t/${authedFamily.slug}/dashboard`, { timeout: 15000 });
    // The page is gated on being a grown-up, not merely on the role having
    // arrived, so the money view must never have rendered on the way past.
    await expect(page.getByTestId('kids-money-page')).toHaveCount(0);
    await expect(page.getByTestId('kids-money-total')).toHaveCount(0);
  },
);
