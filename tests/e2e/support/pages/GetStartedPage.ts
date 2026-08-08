import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// FHS-634: the dashboard "Getting started" guide. Page object so the steps
// never hold raw locators (see the E2E conventions in CLAUDE.md).

export type StepKey = 'kids' | 'pins' | 'rate' | 'habits';

export class GetStartedPage {
  constructor(private readonly page: Page) {}

  private get card() {
    return this.page.getByTestId('get-started');
  }

  async expectVisible(): Promise<void> {
    await expect(this.card).toBeVisible();
  }

  async expectHidden(): Promise<void> {
    // The dashboard has to have finished loading before "not there" means
    // anything, so wait for the page's own content first.
    await expect(this.page.getByTestId('get-started-celebrate')).toHaveCount(0);
    await expect(this.card).toHaveCount(0);
  }

  async expectCount(done: number, total: number): Promise<void> {
    await expect(this.page.getByTestId('get-started-count')).toContainText(
      `${done} of ${total} done`,
    );
  }

  async expectStepDone(key: StepKey): Promise<void> {
    await expect(this.page.getByTestId(`get-started-done-${key}`)).toBeVisible();
  }

  async expectStepNotDone(key: StepKey): Promise<void> {
    await expect(this.page.getByTestId(`get-started-done-${key}`)).toHaveCount(0);
  }

  /** The tappable control on whichever step is next, plus its size. */
  async nextCtaBox(key: StepKey): Promise<{ width: number; height: number }> {
    const box = await this.page.getByTestId(`get-started-cta-${key}`).boundingBox();
    if (!box) throw new Error(`get-started-cta-${key} has no bounding box`);
    return { width: box.width, height: box.height };
  }

  /** Rendered height of one step row, used to tell stacked from side-by-side. */
  async stepHeight(key: StepKey): Promise<number> {
    const box = await this.page.getByTestId(`get-started-step-${key}`).boundingBox();
    if (!box) throw new Error(`get-started-step-${key} has no bounding box`);
    return box.height;
  }

  async dismiss(): Promise<void> {
    await this.page.getByTestId('get-started-dismiss').click();
  }
}
