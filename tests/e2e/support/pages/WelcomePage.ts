import { expect, type Page } from '@playwright/test';

// Page object for the public Welcome page (`/`). Step files MUST go
// through these methods — no raw page.locator() calls per CLAUDE.md.
export class WelcomePagePO {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/');
  }

  brand() {
    return this.page.getByRole('link', { name: /^FamilyHub$/i });
  }

  /** The cycling hero headline (rotates every 5s). */
  heroHeading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  startFreeButton() {
    return this.page.getByRole('button', { name: /start free/i }).first();
  }

  pricingNavLink() {
    return this.page.getByRole('link', { name: /^Pricing$/i });
  }

  loginNavLink() {
    return this.page.getByRole('link', { name: /^Log in$/i });
  }

  featureCardByTitle(title: string | RegExp) {
    return this.page.getByRole('heading', { level: 3, name: title });
  }

  async assertAllFourFeatureCardsRender() {
    await expect(this.featureCardByTitle(/one calendar/i)).toBeVisible();
    await expect(this.featureCardByTitle(/tasks that actually stick/i)).toBeVisible();
    await expect(this.featureCardByTitle(/curious minds/i)).toBeVisible();
    await expect(this.featureCardByTitle(/memories that last/i)).toBeVisible();
  }
}
