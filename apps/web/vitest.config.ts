/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // setup.ts stays in apps/web/src/test/ (NOT in tests/unit/) so it
    // can resolve @testing-library/jest-dom from apps/web/node_modules.
    setupFiles: ['./src/test/setup.ts'],
    // Centralized tests directory per CLAUDE.md.
    include: ['../../tests/unit/web/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    globals: true,
    css: true,
  },
});
