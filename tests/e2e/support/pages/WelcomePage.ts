import { expect, type Page } from '@playwright/test';

// Page object for the public Welcome page (`/`). Step files MUST go
// through these methods, no raw page.locator() calls per CLAUDE.md.
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

  /**
   * Clicks a header nav link at any viewport: below lg the links live behind
   * the burger menu (FHS-555), so open it first when it is on screen.
   */
  async clickHeaderNavLink(name: string) {
    const burger = this.burgerButton();
    if (await burger.isVisible()) await burger.click();
    await this.page
      .getByRole('link', { name: new RegExp(`^${name}$`, 'i') })
      .filter({ visible: true })
      .first()
      .click();
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

  // ── Header navigation (FHS-555) ───────────────────────────────────────────

  async openAtWidth(width: number, height = 812) {
    await this.page.setViewportSize({ width, height });
    await this.open();
  }

  burgerButton() {
    return this.page.getByTestId('site-nav-burger');
  }

  menuPanel() {
    return this.page.getByTestId('site-nav-panel');
  }

  menuLink(name: string) {
    return this.menuPanel().getByRole('link', { name: new RegExp(`^${name}$`, 'i') });
  }

  /** FHS-568: Log in is a button in the panel, not a link. */
  menuLoginButton() {
    return this.menuPanel().getByTestId('site-nav-login');
  }

  header() {
    return this.page.locator('header').first();
  }

  desktopNav() {
    return this.page.getByRole('navigation', { name: 'Main' }).first();
  }

  /** True when the header's own box is taller than a single row of controls. */
  async headerIsSingleLine() {
    const box = await this.header().boundingBox();
    expect(box, 'header should be visible').not.toBeNull();
    // One row = the 44px control + the header's py-4 (16px top and bottom).
    return box!.height <= 44 + 32 + 2;
  }

  horizontalOverflowPx() {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  burgerHasFocus() {
    return this.burgerButton().evaluate((el) => el === document.activeElement);
  }
}
