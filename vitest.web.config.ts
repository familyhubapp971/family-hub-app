/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Tests live at <repo>/tests/unit/web/, and their bare-specifier imports
// (e.g. `react-router-dom`, `@testing-library/react`) resolve against the
// root node_modules, where the web site's dependencies are installed.
// Pinning these aliases keeps them on that copy wherever the test lives.
const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves bare imports from the file's nearest node_modules
    // upward; force it to start at the repo root for centralised tests.
    alias: [
      { find: /^react-router-dom$/, replacement: `${webRoot}node_modules/react-router-dom` },
      {
        find: /^@supabase\/supabase-js$/,
        replacement: `${webRoot}node_modules/@supabase/supabase-js`,
      },
      // Workspace package: alias at the source so vite's resolver
      // doesn't fall back to the dep optimizer's stale snapshot.
      // NOTE: any new workspace package consumed by tests needs a
      // sibling alias here too: otherwise the same "Failed to
      // resolve import" error reappears the first time the package
      // grows a new export.
      {
        find: /^@familyhub\/ui$/,
        replacement: fileURLToPath(new URL('./design-system/src/index.ts', import.meta.url)),
      },
    ],
  },
  // @familyhub/ui is a source-only workspace package (main: ./src/index.ts).
  // Vite's dep optimizer caches a pre-bundle keyed on the file list at
  // first run: adding new exports later returns "module not found" until
  // the cache is wiped. Excluding it from the optimizer makes vite resolve
  // the package via its package.json `main` on every transform, which
  // always reflects the current source.
  optimizeDeps: {
    exclude: ['@familyhub/ui'],
  },
  test: {
    environment: 'jsdom',
    // setup.ts stays in src/app/test/ (NOT in tests/unit/) so it sits with
    // the web site's own code.
    setupFiles: ['./src/app/test/setup.ts'],
    // Centralized tests directory per CLAUDE.md.
    include: ['tests/unit/web/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    globals: true,
    css: true,
  },
});
