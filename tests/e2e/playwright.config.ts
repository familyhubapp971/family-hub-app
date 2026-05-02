import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Generates Playwright spec files from .feature files into .features-gen/.
// Scenario names in features/ MUST mirror Gherkin scenarios in
// documents/features/<slug>.md character-for-character (Jira AC traceability).
// Paths in defineBddConfig are resolved relative to THIS config file's
// directory (tests/e2e/), NOT the CWD where bddgen was invoked.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
  outputDir: '.features-gen',
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
