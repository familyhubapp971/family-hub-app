import { defineWorkspace } from 'vitest/config';

// Single workspace entry so `pnpm vitest run --coverage` at the repo
// root discovers every package's tests and rolls coverage up into one
// report under /coverage. The web site's tests use vitest.web.config.ts
// (the root vitest.config.ts holds the shared coverage settings), and
// `pnpm --filter @familyhub/ui test` still uses the design system's config.
export default defineWorkspace(['design-system', './vitest.web.config.ts']);
