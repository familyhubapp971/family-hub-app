// bddgen's createBdd() requires a `test` extended from playwright-bdd's OWN
// `test` export (it carries the Given/When/Then/$bddContext fixtures):
// extending `@playwright/test`'s bare `test` throws
// "createBdd() should use 'test' extended from playwright-bdd" at runtime.
import { test as base } from 'playwright-bdd';
import { mintE2eAccessToken } from './auth/jwt.js';
import { resolveSupabaseUrl } from './auth/env.js';
import { buildSupabaseLocalStorageEntry } from './auth/session.js';
import { cleanupFamily, seedFamily, type SeededFamily } from './auth/seed.js';

// FHS-516: reusable authenticated fixture for specs that need a signed-in
// family. Any future spec that needs an authed `/t/:slug/*` page imports
// `test`/`expect` from HERE (not from '@playwright/test' directly) and
// depends on the `authedFamily` fixture:
//
//   import { test, expect } from '../support/fixtures.js';
//   import { createBdd } from 'playwright-bdd';
//   const { Given, When, Then } = createBdd(test);
//
//   Given('I am signed in to a fresh family', async ({ authedFamily, page }) => {
//     await page.goto(`/t/${authedFamily.slug}/members`);
//   });
//
// What it does, end to end:
//   1. Seeds a fresh, isolated tenant + admin user + child member + habit
//      directly in Postgres (support/auth/seed.ts), no signup flow, no
//      real email.
//   2. Mints an ES256 JWT for that user (support/auth/jwt.ts), signed with
//      the fixed test key the api trusts ONLY when E2E_TEST_JWKS is set
//      (see playwright.config.ts + apps/api/src/middleware/auth.ts).
//   3. Injects a supabase-js-shaped session into localStorage via
//      `context.addInitScript` (support/auth/session.ts), so it's already
//      there before the web app's first script runs: no UI login needed.
//   4. Tears the seeded family down after the test (support/auth/seed.ts).
//
// A test using this fixture can go straight to `page.goto('/t/<slug>/...')`
// already authenticated, exactly like a real signed-in user on a hard
// reload (session restored from localStorage).

export interface AuthedFamily extends SeededFamily {
  accessToken: string;
}

export const test = base.extend<{ authedFamily: AuthedFamily }>({
  authedFamily: async ({ context }, use) => {
    const family = await seedFamily();
    const accessToken = await mintE2eAccessToken({ sub: family.userId, email: family.email });
    const supabaseUrl = resolveSupabaseUrl();
    // The token's own `exp` claim (seconds), decode it back out so the
    // injected session's expires_at matches exactly rather than
    // re-deriving it and risking clock-skew drift between the two.
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp: number };
    const entry = buildSupabaseLocalStorageEntry({
      supabaseUrl,
      accessToken,
      userId: family.userId,
      email: family.email,
      expiresAt: payload.exp,
    });

    await context.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key: entry.key, value: entry.value },
    );

    await use({ ...family, accessToken });

    await cleanupFamily(family);
  },
});

export { expect } from '@playwright/test';
