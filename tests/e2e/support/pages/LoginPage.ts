import type { Page } from '@playwright/test';

// Page object for /login. Mirrors SignupPage — testid selectors match
// the data-testid attributes wired in apps/web/src/pages/auth/LoginPage.tsx.
// FHS-224 stripped the password field from the UI (passwordless parent
// auth per ADR 0011); the e2e back-door for the synthetic FHS-196
// account therefore POSTs to Supabase's password grant directly and
// seeds the session into localStorage rather than filling a form.
export class LoginPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto('/login');
  }

  emailInput() {
    return this.page.getByTestId('login-email');
  }

  submitButton() {
    return this.page.getByTestId('login-submit');
  }

  googleButton() {
    return this.page.getByTestId('login-google');
  }

  errorMessage() {
    return this.page.getByTestId('login-error');
  }

  async submitMagicLink(email: string) {
    await this.emailInput().fill(email);
    await this.submitButton().click();
  }

  /**
   * Sign in the synthetic e2e account by going around the magic-link
   * UI: hit Supabase's password-grant endpoint, then seed localStorage
   * with the returned session so the supabase-js client on the next
   * page load picks it up. The Supabase password column still exists
   * (ADR 0011 §Consequences) — we just don't expose it to humans.
   *
   * Resolves the storage key from SUPABASE_URL (`sb-<projectRef>-auth-token`).
   */
  async loginAndWaitForRedirect(email: string, password: string) {
    const supabaseUrl = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
    const anonKey = process.env['SUPABASE_ANON_KEY'] ?? process.env['VITE_SUPABASE_ANON_KEY'];
    if (!supabaseUrl || !anonKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY (or the VITE_ prefixed equivalents) ' +
          'must be set for the e2e auth helper. See infra/supabase/README.md.',
      );
    }
    const res = await this.page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      data: { email, password },
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`Supabase password grant failed (${res.status()}): ${body}`);
    }
    const raw = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      user: unknown;
    };
    // Supabase-js v2 keys session validity off `expires_at` (epoch
    // seconds). The /token endpoint only returns expires_in, so we
    // compute expires_at locally and merge — without this the session
    // is treated as expired on first getSession() and dropped.
    const session = {
      ...raw,
      expires_at: Math.floor(Date.now() / 1000) + raw.expires_in,
    };
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    // Seed via addInitScript BEFORE navigating, so the supabase-js
    // client picks the session up on its very first getSession() call
    // rather than racing the already-resolved AuthProvider effect.
    await this.page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      storageKey,
      JSON.stringify(session),
    ] as const);
    // Land on /dashboard (a protected route) and wait for AuthProvider
    // to resolve — the URL stays as-is when the session is recognised.
    await this.page.goto('/dashboard');
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });
  }
}
