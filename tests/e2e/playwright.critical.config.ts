import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Critical-path subset for PR CI: only @critical-tagged scenarios,
// chromium only, must finish under 5 min. Full matrix runs post-merge
// to staging via the regular playwright.config.ts.
// Paths relative to THIS config file's directory (tests/e2e/).
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
  outputDir: '.features-gen-critical',
  tags: '@critical',
});

export default defineConfig({
  testDir,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  outputDir: './test-results-critical',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: './playwright-report-critical', open: 'never' }]]
    : [['list'], ['html', { outputFolder: './playwright-report-critical', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5273',
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Boot api + web; CI has no manual servers.
  webServer: [
    {
      command:
        'NODE_ENV=test PORT=3001 LOG_LEVEL=error DATABASE_URL=postgres://localhost:5432/familyhub_test pnpm --filter @familyhub/api dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @familyhub/web dev',
      url: 'http://localhost:5273',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
