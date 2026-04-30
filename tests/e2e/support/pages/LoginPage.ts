import type { Page } from '@playwright/test';

// Page object for /login. Mirror of SignupPage — testid selectors
// match the data-testid attributes wired in apps/web/src/pages/auth/LoginPage.tsx.
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

  async fillCredentials(email: string, password: string) {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
  }

  async submit() {
    await this.submitButton().click();
  }

  async loginAndWaitForRedirect(email: string, password: string) {
    await this.open();
    await this.fillCredentials(email, password);
    await this.submit();
    // LoginPage redirects to /dashboard on success. Wait for the URL
    // change so a "still on /login" race doesn't show up as a flake on
    // the very next step.
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });
  }
}
