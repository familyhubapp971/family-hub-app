/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Tests live at <repo>/tests/unit/web/, but their bare-specifier imports
// (e.g. `react-router-dom`, `@testing-library/react`) need to resolve
// against apps/web/node_modules — pnpm doesn't hoist app deps to the
// repo root. Pinning resolve.modules makes Vite walk app-local
// node_modules first regardless of where the test file lives.
const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves bare imports from the file's nearest node_modules
    // upward; force it to start in apps/web for centralised tests.
    alias: [
      { find: /^react-router-dom$/, replacement: `${webRoot}node_modules/react-router-dom` },
      {
        find: /^@supabase\/supabase-js$/,
        replacement: `${webRoot}node_modules/@supabase/supabase-js`,
      },
      // Workspace package — alias at the source so vite's resolver
      // doesn't fall back to the dep optimizer's stale snapshot.
      // NOTE: any new workspace package consumed by tests needs a
      // sibling alias here too — otherwise the same "Failed to
      // resolve import" error reappears the first time the package
      // grows a new export.
      {
        find: /^@familyhub\/ui$/,
        replacement: fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
      },
    ],
  },
  // @familyhub/ui is a source-only workspace package (main: ./src/index.ts).
  // Vite's dep optimizer caches a pre-bundle keyed on the file list at
  // first run — adding new exports later returns "module not found" until
  // the cache is wiped. Excluding it from the optimizer makes vite resolve
  // the package via its package.json `main` on every transform, which
  // always reflects the current source.
  optimizeDeps: {
    exclude: ['@familyhub/ui'],
  },
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
