import { createBdd } from 'playwright-bdd';
import { and, eq } from 'drizzle-orm';
import { test, expect } from '../support/fixtures.js';
import { getE2eDb, schema } from '../support/auth/db.js';
import { CloseWeekPage } from '../support/pages/CloseWeekPage.js';

// FHS-646: the point of these specs is that the SCREEN and the LEDGER agree.
// Asserting only the message would pass on a screen that lies; asserting only
// the rows would pass on a screen that never updates.

const { Given, When, Then } = createBdd(test);

/**
 * The saves recorded against the child's OPEN week. Scoped to that week on
 * purpose: the seed's finished week already carries a save of its own, so an
 * unscoped count would never be 1.
 */
async function savedActions(tenantId: string, memberId: string, weekId: string) {
  return getE2eDb()
    .select({
      stickersUsed: schema.mwWeekActions.stickersUsed,
    })
    .from(schema.mwWeekActions)
    .where(
      and(
        eq(schema.mwWeekActions.tenantId, tenantId),
        eq(schema.mwWeekActions.memberId, memberId),
        eq(schema.mwWeekActions.weekId, weekId),
        eq(schema.mwWeekActions.actionType, 'save'),
      ),
    );
}

Given('my child has 7 stickers ready to spend', async ({ page, savingsFamily }) => {
  const board = new CloseWeekPage(page);
  await board.openBoard(savingsFamily.slug, savingsFamily.childMemberId);
  await board.expectBannerVisible();
  await board.tapCloseWeek();
  await board.expectChooserVisible();
  await board.chooseAction('save');
  // The ceiling the picker opens on IS the child's spendable total, so this
  // both proves the seed landed and pins what the later maths is relative to.
  expect(await board.saveAmountShown()).toBe(7);
});

When('I move 5 of them into savings and confirm once', async ({ page }) => {
  const board = new CloseWeekPage(page);
  await board.setSaveAmount(5);
  await board.confirmSave();
  await board.expectDoneVisible();
});

When('I move 5 into savings and tap confirm twice', async ({ page }) => {
  const board = new CloseWeekPage(page);
  await board.setSaveAmount(5);
  await board.confirmSaveTwice();
  await board.expectDoneVisible();
});

When('I try to move more stickers than my child has', async ({ page }) => {
  await new CloseWeekPage(page).setSaveAmount(50);
});

Then('the app tells me 5 moved and 2 are still ready to spend', async ({ page }) => {
  const message = await new CloseWeekPage(page).doneText();
  expect(message).toContain('5 stickers into savings');
  expect(message).toContain('2 still ready to spend');
});

Then('exactly one save of 5 stickers is recorded', async ({ savingsFamily }) => {
  const saves = await savedActions(
    savingsFamily.tenantId,
    savingsFamily.childMemberId,
    savingsFamily.liveWeekId,
  );
  expect(saves).toEqual([{ stickersUsed: 5 }]);
});

Then('the amount is held at 7', async ({ page }) => {
  expect(await new CloseWeekPage(page).saveAmountShown()).toBe(7);
});
