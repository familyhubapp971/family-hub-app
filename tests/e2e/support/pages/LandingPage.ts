import type { Page } from '@playwright/test';

// Page object for the landing page. Step files MUST go through these
// methods, not raw page.locator() calls (CLAUDE.md "E2E" rule).
export class LandingPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/');
  }

  heading() {
    return this.page.getByRole('heading', { name: /family hub/i });
  }

  helloMessage() {
    return this.page.getByTestId('hello-message');
  }

  helloTimestamp() {
    return this.page.getByTestId('hello-timestamp');
  }

  helloError() {
    return this.page.getByTestId('hello-error');
  }
}
