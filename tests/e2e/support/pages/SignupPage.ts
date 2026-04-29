import type { Page } from '@playwright/test';

// Page object for /signup. All step files MUST go through these
// methods, not raw page.locator() — see CLAUDE.md "E2E" rule.
export class SignupPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/signup');
  }

  emailInput() {
    return this.page.getByTestId('signup-email');
  }

  passwordInput() {
    return this.page.getByTestId('signup-password');
  }

  submitButton() {
    return this.page.getByTestId('signup-submit');
  }

  successMessage() {
    return this.page.getByTestId('signup-success');
  }

  errorMessage() {
    return this.page.getByTestId('signup-error');
  }

  async fillCredentials(email: string, password: string) {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
  }

  async submit() {
    await this.submitButton().click();
  }
}
