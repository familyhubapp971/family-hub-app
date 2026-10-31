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

  /**
   * FHS-603: clicks the header's Start free at any viewport. On a phone the
   * header carries only the logo and the burger (FHS-572 moved both actions
   * into the panel), so the page's first "Start free" is the hidden one inside
   * the closed panel and clicking it waits forever. The panel's copy is also a
   * link rather than a button, so a role lookup never finds it either. Open the
   * burger and use the panel's own control.
   */
  async clickStartFreeInHeader() {
    const burger = this.burgerButton();
    // isVisible() does not wait, so ask only once the header has rendered.
    // The burger is always in the page and hidden by CSS from lg up, so this
    // resolves at every width.
    await burger.waitFor({ state: 'attached' });
    if (await burger.isVisible()) {
      await burger.click();
      await this.menuSignupButton().click();
      return;
    }
    await this.startFreeButton().click();
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
    // FHS-603: isVisible() does not wait. Asking before the header rendered
    // read "no burger", so on a phone this fell through to the desktop row and
    // clicked a link nobody could see.
    await burger.waitFor({ state: 'attached' });
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

  /** FHS-568 / FHS-572: both actions sit inside the panel on phones. */
  menuLoginButton() {
    return this.menuPanel().getByTestId('site-nav-login');
  }

  menuSignupButton() {
    return this.menuPanel().getByTestId('site-nav-signup');
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
