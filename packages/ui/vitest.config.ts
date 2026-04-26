import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['../../tests/unit/ui/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
});
