import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// FHS-670: the per-screen feedback button and its form.

export class ScreenFeedbackPage {
  constructor(private readonly page: Page) {}

  private get button() {
    return this.page.getByTestId('screen-feedback-button');
  }

  private get dialog() {
    return this.page.getByTestId('screen-feedback-dialog');
  }

  async open(): Promise<void> {
    await this.button.click();
    await expect(this.dialog).toBeVisible();
  }

  async expectQuestion(text: string): Promise<void> {
    await expect(this.dialog.getByText(text)).toBeVisible();
  }

  async tapFeature(name: string): Promise<void> {
    await this.dialog.getByRole('button', { name }).click();
  }

  async rateEase(n: number): Promise<void> {
    await this.page.getByTestId(`screen-feedback-ease-${n}`).click();
  }

  async send(): Promise<void> {
    await this.page.getByTestId('screen-feedback-submit').click();
  }

  async expectThanks(): Promise<void> {
    await expect(this.page.getByTestId('screen-feedback-thanks')).toBeVisible();
  }

  async expectButtonTappable(): Promise<void> {
    await expect(this.button).toBeVisible();
    const box = await this.button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  async expectNoSidewaysScroll(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  async expectDialogFits(): Promise<void> {
    const box = await this.dialog.locator('> div').first().boundingBox();
    const width = this.page.viewportSize()?.width ?? 0;
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
}
