import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// FHS-638: the My World board's Close Week banner and the chooser it opens
// (FHS-637). Page object so the steps hold no raw locators.

export type ChooserRow = 'claim' | 'cash' | 'save' | 'invest' | 'withdraw';

export class CloseWeekPage {
  constructor(private readonly page: Page) {}

  async openBoard(slug: string, memberId: string): Promise<void> {
    await this.page.goto(`/t/${slug}/child/${memberId}`);
  }

  /** The banner only shows from the week's last day on, which is why the spec
   *  uses the seed variant that anchors the week to today. */
  async expectBannerVisible(): Promise<void> {
    await expect(this.page.getByTestId('my-world-close-week-banner')).toBeVisible({
      timeout: 15000,
    });
  }

  async tapCloseWeek(): Promise<void> {
    await this.page.getByTestId('my-world-close-week-banner-btn').click();
  }

  async expectChooserVisible(): Promise<void> {
    await expect(this.page.getByTestId('close-week-chooser')).toBeVisible({ timeout: 15000 });
  }

  chooserText(): Promise<string> {
    return this.page.getByTestId('close-week-chooser').innerText();
  }

  async expectRow(row: ChooserRow): Promise<void> {
    await expect(this.page.getByTestId(`close-week-chooser-${row}`)).toBeVisible();
  }

  async rowBox(row: ChooserRow): Promise<{ width: number; height: number }> {
    const box = await this.page.getByTestId(`close-week-chooser-${row}`).boundingBox();
    if (!box) throw new Error(`close-week-chooser-${row} has no bounding box`);
    return { width: box.width, height: box.height };
  }

  async finishBox(): Promise<{ width: number; height: number }> {
    const box = await this.page.getByTestId('close-week-chooser-finish').boundingBox();
    if (!box) throw new Error('close-week-chooser-finish has no bounding box');
    return { width: box.width, height: box.height };
  }

  /**
   * FHS-639: the colours the header actually paints with.
   *
   * A class name that does not exist in this app's Tailwind produces no rule
   * and no error, so the title kept its white colour on a background that
   * never turned purple and simply disappeared. Only a real browser can see
   * that, which is why this reads computed styles rather than class names.
   */
  async headerColours(): Promise<{ background: string; title: string; closeIcon: string }> {
    const header = this.page.getByTestId('money-actions-sheet-header');
    const background = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    const title = await header.locator('h2').evaluate((el) => getComputedStyle(el).color);
    const closeIcon = await this.page
      .getByTestId('money-actions-sheet-close')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    return { background, title, closeIcon };
  }

  /** How far the page can scroll sideways: anything over a pixel is a bug. */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
