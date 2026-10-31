import { defineConfig } from 'vitest/config';

// Root-level coverage defaults. vitest.web.config.ts (web site) and
// design-system/vitest.config.ts set the environment and test paths.
// Re-run with `pnpm test:coverage` to collect a merged lcov report.
export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}', 'design-system/src/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        'vite.config.ts',
        'postcss.config.js',
        'tailwind.config.js',
        'src/main.tsx',
        'src/test/**', // setup files, not logic
      ],
      all: true,
    },
  },
});
