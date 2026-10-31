import { type Page } from '@playwright/test';

// Page object for the public Signup page (`/signup`). Auth-first since
// the duplicate-family-name fix: email + Google only. Family name +
// slug locators moved to CreateFamilyPanel (page object lives where
// dashboard-redirect tests need it).
export class SignupPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/signup');
  }

  heading() {
    return this.page.getByRole('heading', { name: /get started/i });
  }

  socialProofHeading() {
    return this.page.getByRole('heading', { name: /2,400\+ families/i });
  }

  emailInput() {
    return this.page.getByTestId('signup-email');
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
