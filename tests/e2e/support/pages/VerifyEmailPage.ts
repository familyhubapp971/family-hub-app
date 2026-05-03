import { type Page } from '@playwright/test';

// Page object for /verify-email (FHS-223). No raw page.locator() in
// step files per CLAUDE.md.
export class VerifyEmailPage {
  constructor(private readonly page: Page) {}

  heading() {
    return this.page.getByRole('heading', { name: /check your email/i });
  }

  emailReadout() {
    return this.page.getByTestId('verify-email-address');
  }

  openGmailLink() {
    return this.page.getByTestId('verify-email-open-gmail');
  }

  resendButton() {
    return this.page.getByTestId('verify-email-resend');
  }

  backLink() {
    return this.page.getByTestId('verify-email-back');
  }
}
