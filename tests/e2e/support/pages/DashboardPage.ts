import type { Page } from '@playwright/test';

// Page object for /dashboard. Step files MUST go through these methods,
// not raw page.locator() — see CLAUDE.md "E2E" rule.
export class DashboardPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/dashboard');
  }

  email() {
    return this.page.getByTestId('dashboard-email');
  }

  logoutButton() {
    return this.page.getByTestId('dashboard-logout');
  }

  async logout() {
    await this.logoutButton().click();
  }
}
