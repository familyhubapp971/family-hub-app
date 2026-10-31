import { expect, type Page } from '@playwright/test';

// Page object for the public Pricing page (`/pricing`).
export class PricingPagePO {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/pricing');
  }

  pageHeading() {
    return this.page.getByRole('heading', { level: 1, name: /simple, honest pricing/i });
  }

  tierByName(name: string) {
    return this.page.getByRole('heading', { level: 2, name }).first();
  }

  mostPopularBadge() {
    return this.page.getByText(/most popular/i);
  }

  /** All CTA buttons that route to /signup (one per tier). */
  ctas() {
    return this.page.getByRole('button', { name: /(get started|start free trial)/i });
  }

  async assertAllThreeTiersRender() {
    await expect(this.tierByName('Household')).toBeVisible();
    await expect(this.tierByName('Family')).toBeVisible();
    await expect(this.tierByName('Family Pro')).toBeVisible();
  }
}
