import { type Page } from '@playwright/test';

// Page object for the public Signup page (`/signup`). MP redesign per
// FHS-26: split-screen, magic-link only, no password. Step files MUST
// go through these methods — no raw page.locator() per CLAUDE.md.
export class SignupPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/signup');
  }

  heading() {
    return this.page.getByRole('heading', { name: /create your family/i });
  }

  socialProofHeading() {
    return this.page.getByRole('heading', { name: /2,400\+ families/i });
  }

  familyNameInput() {
    return this.page.getByTestId('signup-family-name');
  }

  displayNameInput() {
    return this.page.getByTestId('signup-display-name');
  }

  emailInput() {
    return this.page.getByTestId('signup-email');
  }

  slugPreview() {
    return this.page.getByTestId('signup-slug-preview');
  }

  slugAvailable() {
    return this.page.getByTestId('signup-slug-available');
  }

  slugTaken() {
    return this.page.getByTestId('signup-slug-taken');
  }

  slugSuggestions() {
    return this.page.getByTestId('signup-slug-suggestions');
  }

  changeSlugLink() {
    return this.page.getByTestId('signup-slug-change');
  }

  slugInput() {
    return this.page.getByTestId('signup-slug-input');
  }

  submitButton() {
    return this.page.getByTestId('signup-submit');
  }

  googleButton() {
    return this.page.getByTestId('signup-google');
  }

  loginLink() {
    return this.page.getByRole('link', { name: /log in/i });
  }
}
