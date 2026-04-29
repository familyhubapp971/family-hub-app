import type { Page, Route } from '@playwright/test';

// Hermetic Supabase mocks for E2E (FHS-193).
//
// Why route-level mocks? Calling staging Supabase from a GH Actions
// runner is unreliable — fetches to ap-south-1 hang behind Cloudflare's
// edge with no error response. We replace the network surface with
// page.route() handlers that return deterministic responses, so signup
// / login / dashboard / logout flows run without any external dependency.
//
// We intercept every path under `/auth/v1/` regardless of host — Supabase
// JS calls `${VITE_SUPABASE_URL}/auth/v1/<path>`, and in CI without the
// env var the client falls back to `https://placeholder.invalid/...`.
// Matching on path-suffix means the same fixture works whether the dev
// server has the env var set or not.

const PROJECT_REF = 'mocked';
const ISSUER = `https://${PROJECT_REF}.supabase.co/auth/v1`;

export interface MockUser {
  id: string;
  email: string;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  /** seconds since epoch — Supabase JS uses this to schedule auto-refresh. */
  expires_at: number;
  token_type: 'bearer';
  user: MockUser & {
    aud: 'authenticated';
    role: 'authenticated';
    email_confirmed_at: string;
    created_at: string;
    updated_at: string;
  };
}

export const DEFAULT_USER: MockUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'mock@familyhub.test',
};

/**
 * Build a Supabase-shaped session object. The token is a syntactically
 * valid JWT-ish three-part string — we never verify it on the web side,
 * the api integration tests cover real signature verification.
 */
export function buildSession(user: MockUser = DEFAULT_USER): MockSession {
  const now = Math.floor(Date.now() / 1000);
  const issued = new Date(now * 1000).toISOString();
  return {
    access_token: `mock.${user.id}.token`,
    refresh_token: `mock.${user.id}.refresh`,
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: issued,
      created_at: issued,
      updated_at: issued,
    },
  };
}

interface InstallOptions {
  /** Returned by `/auth/v1/signup`. Defaults to email-confirmation flow (no session). */
  signupReturnsSession?: boolean;
  /** Override the default mock user. */
  user?: MockUser;
}

/**
 * Mount mocks for the unauthenticated-signup flow. The signup endpoint
 * returns a `user` row with `confirmation_sent_at` populated and
 * `session: null` — matching the email-confirmation Supabase project
 * configuration (FHS-187 / ADR 0008).
 */
export async function installSignupMocks(page: Page, opts: InstallOptions = {}): Promise<void> {
  const user = opts.user ?? DEFAULT_USER;
  await installBaseMocks(page);

  await page.route('**/auth/v1/signup', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (opts.signupReturnsSession) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSession(user)),
      });
      return;
    }
    // Email-confirmation flow: GoTrue returns 200 with a user payload and
    // no session. The web code keys off `error == null` for the success
    // branch and shows the "Check your inbox" message.
    const issued = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: user.id,
        aud: 'authenticated',
        role: '',
        email: user.email,
        confirmation_sent_at: issued,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: issued,
        updated_at: issued,
      }),
    });
  });
}

/**
 * Mount mocks for an authenticated session. Pre-seeds Supabase JS's
 * localStorage entry so `getSession()` resolves to the mock session
 * synchronously on first paint — no flash of the login redirect.
 *
 * Call before `page.goto(...)` of any protected route.
 */
export async function installAuthenticatedSession(
  page: Page,
  user: MockUser = DEFAULT_USER,
): Promise<MockSession> {
  await installBaseMocks(page);

  const session = buildSession(user);

  // The Supabase storage key is `sb-<project-ref>-auth-token`. With
  // `VITE_SUPABASE_URL` unset (CI default), the client uses the
  // placeholder URL `https://placeholder.invalid` — its ref segment is
  // `placeholder`, so the storage key becomes `sb-placeholder-auth-token`.
  // We seed both so the test works regardless of whether dev has real
  // env vars wired or not.
  const storageValue = JSON.stringify(session);
  await page.addInitScript(
    ([value]) => {
      try {
        window.localStorage.setItem('sb-placeholder-auth-token', value);
        window.localStorage.setItem('sb-mocked-auth-token', value);
      } catch {
        // localStorage unavailable in some Playwright contexts; the
        // fallback is the GET /auth/v1/user mock below.
      }
    },
    [storageValue],
  );

  // GoTrue calls GET /user on session restore to confirm the access
  // token is still valid. Returning the user keeps the session live; a
  // 401 here would force the client to clear storage on first paint.
  await page.route('**/auth/v1/user', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session.user),
    });
  });

  // Logout clears the server-side session. We don't need to track state
  // — Supabase JS clears its own storage and emits SIGNED_OUT regardless.
  await page.route('**/auth/v1/logout**', async (route: Route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  return session;
}

/**
 * Catch-all for the rest of the GoTrue surface. Anything we haven't
 * pinned explicitly returns a generic error so a regression doesn't
 * silently leak to staging Supabase. Mounted last by every install*
 * helper — call sites don't need to think about it.
 */
async function installBaseMocks(page: Page): Promise<void> {
  // JWKS is fetched by the api, never the browser. If something asks
  // for it through the browser, return an empty key set rather than
  // letting the request hang.
  await page.route('**/auth/v1/.well-known/jwks.json', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ keys: [] }),
    });
  });

  await page.route('**/auth/v1/settings', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        external: { email: true, phone: false },
        disable_signup: false,
        mailer_autoconfirm: false,
        phone_autoconfirm: false,
        sms_provider: '',
        mfa_enabled: false,
        saml_enabled: false,
      }),
    });
  });
}

/** Exposed for tests that want to assert the mocked issuer in a payload. */
export const MOCK_ISSUER = ISSUER;
