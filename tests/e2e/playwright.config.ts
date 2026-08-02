import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { e2eTestJwksJson } from './support/auth/test-key.js';
import { tryResolveSupabaseUrl } from './support/auth/env.js';

// In CI the workflow exports DATABASE_URL with credentials matching the
// `postgres:16-alpine` service (e.g. fh_test:fh_test@localhost). Inline
// command-line env vars on a child_process spawn OVERRIDE the parent
// process env, so previously hardcoding a no-credential URL here meant
// the API process tried to connect anonymously and every DB-touching
// endpoint failed in CI. Inherit DATABASE_URL when set; fall back to
// the local-dev convention only when it isn't.
const apiDatabaseUrl = process.env.DATABASE_URL ?? 'postgres://localhost:5432/familyhub_test';

// FHS-516 — the authed e2e fixture's test JWKS + the Supabase project URL
// the api verifies tokens' `iss` claim against. See support/fixtures.ts for
// the full picture and apps/api/src/middleware/auth.ts for the api-side
// hook. tryResolveSupabaseUrl() reads SUPABASE_URL from the job env in CI,
// or repo-root .env.local locally — same source the api's own `dev` script
// uses, so both processes agree on the issuer without coordination. It's
// the NON-throwing lookup deliberately: this file loads for every e2e spec,
// including ones that never touch the authed fixture, so a contributor
// machine with no Supabase configured must still be able to run those.
// Only a spec that actually requests `authedFamily` fails (loudly, via the
// throwing resolveSupabaseUrl() inside support/fixtures.ts).
const supabaseUrl = tryResolveSupabaseUrl();
const apiWebServerEnv = supabaseUrl
  ? { SUPABASE_URL: supabaseUrl, E2E_TEST_JWKS: e2eTestJwksJson() }
  : undefined;

// Generates Playwright spec files from .feature files into .features-gen/.
// Scenario names in features/ MUST mirror Gherkin scenarios in
// documents/features/<slug>.md character-for-character (Jira AC traceability).
// Paths in defineBddConfig are resolved relative to THIS config file's
// directory (tests/e2e/), NOT the CWD where bddgen was invoked.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
  outputDir: '.features-gen',
  // FHS-516 — steps/authed-smoke.ts uses `test` extended with the
  // `authedFamily` fixture (support/fixtures.ts), not the bare
  // playwright-bdd test. bddgen can't infer that from the steps glob alone
  // (support/ isn't in it), so it needs pointing at the fixtures file
  // explicitly to generate specs that import the right `test` instance.
  importTestFrom: 'support/fixtures.ts',
  // FHS-516 — @authed-local specs need the local api booted with the
  // E2E_TEST_JWKS override; this full matrix points web at the real staging
  // api (for the legacy real-login auth.feature spec), so it CANNOT also serve
  // the test-JWKS harness. Those specs run in playwright.critical.config.ts
  // instead (which points web at the local api). Excluded here.
  tags: 'not @authed-local',
});

export default defineConfig({
  testDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: './playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5273',
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Boot BOTH the api (port 3001) and the web (port 5273). Web's Vite
  // dev server proxies /api → api. CI has no manually-started servers;
  // locally we reuse if already running. Bumped timeout to 120s for
  // cold pnpm + tsx + vite startup on a fresh CI runner.
  //
  // FHS-516 GOTCHA: `reuseExistingServer` means that if you already have
  // `pnpm dev` (or a leftover api process) bound to :3001 from another
  // terminal, Playwright reuses THAT process — which never got
  // E2E_TEST_JWKS — instead of starting its own. Every existing spec still
  // passes (they don't hit the api with a bearer token), but the authed
  // fixture's spec(s) fail with 401s that look like a fixture bug. If an
  // authed spec starts failing locally, check `lsof -i :3001` first and
  // kill anything already listening before re-running.
  webServer: [
    {
      command: `NODE_ENV=test PORT=3001 LOG_LEVEL=error DATABASE_URL=${apiDatabaseUrl} pnpm --filter @familyhub/api dev`,
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // FHS-516 — merged with process.env by Playwright (doesn't replace
      // it), same override precedence as the inline DATABASE_URL above:
      // these win over whatever apps/api's own `--env-file=.env.local`
      // loading would otherwise set for the same keys. Undefined (Supabase
      // unconfigured on this machine) means the api falls back to exactly
      // its pre-FHS-516 behaviour — no E2E_TEST_JWKS, real remote JWKS.
      env: apiWebServerEnv,
    },
    {
      command: 'pnpm --filter @familyhub/web dev',
      url: 'http://localhost:5273',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // FHS-516 — the full matrix deliberately does NOT override VITE_API_URL:
      // its one authed spec (auth.feature, FHS-196) does a REAL Supabase login
      // and needs the real staging api that trusts real Supabase tokens (which
      // apps/web/.env.development.local already points VITE_API_URL at). The
      // test-JWKS harness's @authed-local specs, which need the local api, are
      // excluded from this matrix (see the `tags` filter above) and run in
      // playwright.critical.config.ts, which pins VITE_API_URL at the local api.
    },
  ],
});
