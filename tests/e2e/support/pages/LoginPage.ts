import type { Page } from '@playwright/test';

// Page object for /login. Step files MUST go through these methods,
// not raw page.locator() — see CLAUDE.md "E2E" rule.
export class LoginPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/login');
  }

  emailInput() {
    return this.page.getByTestId('login-email');
  }

  passwordInput() {
    return this.page.getByTestId('login-password');
  }

  submitButton() {
    return this.page.getByTestId('login-submit');
  }

  errorMessage() {
    return this.page.getByTestId('login-error');
  }
}
