import type { Page } from '@playwright/test';

export class LegalPagePO {
  constructor(private readonly page: Page) {}

  async openPrivacyAtPhoneWidth(width = 375) {
    await this.page.setViewportSize({ width, height: 812 });
    await this.page.goto('/legal/privacy');
  }

  pillNavLinks() {
    return this.page.getByRole('navigation', { name: 'Legal pages' }).getByRole('link');
  }

  horizontalOverflowPx() {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }
}
