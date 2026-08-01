import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FHS-516 — resolve SUPABASE_URL for the authed e2e fixture without
// disturbing anything else in process.env (notably DATABASE_URL — see
// below).
//
// In CI, SUPABASE_URL is exported at the job level (ci-pr-staging.yml /
// ci-staging.yml e2e-critical job) and inherited by every child process,
// including this one — resolveSupabaseUrl() just reads it.
//
// Locally, only the api's OWN `dev` script loads it (via
// `tsx watch --env-file=../../.env.local`, see apps/api/package.json) —
// the Playwright test process itself never does. This module reads the
// same repo-root .env.local file directly, but ONLY the SUPABASE_URL key —
// unlike `process.loadEnvFile()`, it never mutates process.env, so it can't
// accidentally pull the STAGING DATABASE_URL (also defined in .env.local)
// into this process and make the seed script below write to the wrong
// database. The e2e Postgres connection string is resolved completely
// separately (see db.ts), straight from process.env.DATABASE_URL.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ENV_LOCAL = path.resolve(HERE, '../../../../.env.local');

function readSupabaseUrlFromRootEnvLocal(): string | undefined {
  if (!existsSync(ROOT_ENV_LOCAL)) return undefined;
  const lines = readFileSync(ROOT_ENV_LOCAL, 'utf8').split('\n');
  let found: string | undefined;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key !== 'SUPABASE_URL') continue;
    const value = line.slice(eq + 1).trim();
    // .env.local defines SUPABASE_URL twice: once as an unexpanded
    // shell-style reference (`SUPABASE_URL=$SUPABASE_URL_STAGING`, a
    // template leftover) and once as the real https:// value. Only accept
    // a concrete URL; last concrete match wins if there's ever more than
    // one (mirrors dotenv "later definition wins" semantics).
    if (/^https?:\/\//.test(value)) found = value;
  }
  return found;
}

/** Test-only — resets the memoised value so a test can cover both branches. */
let cached: string | undefined;
export function _resetSupabaseUrlCacheForTests(): void {
  cached = undefined;
}

/**
 * Non-throwing lookup — used by playwright*.config.ts at CONFIG LOAD TIME,
 * which runs for every e2e spec, not just ones that use the authed
 * fixture. A contributor machine (or hypothetical future CI job) with no
 * Supabase configured at all must still be able to run the marketing/login
 * specs; only a spec that actually asks for `authedFamily` should fail
 * (via resolveSupabaseUrl() below, called at test-run time).
 */
export function tryResolveSupabaseUrl(): string | undefined {
  if (cached) return cached;
  const fromEnv = process.env['SUPABASE_URL'];
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }
  const fromFile = readSupabaseUrlFromRootEnvLocal();
  if (fromFile) {
    cached = fromFile;
    return cached;
  }
  return undefined;
}

/**
 * Throwing variant — used by the fixture (support/fixtures.ts) at actual
 * test-run time, where failing loudly and immediately is exactly right:
 * only specs that use `authedFamily` ever call this, so an unconfigured
 * Supabase project fails just those specs with a clear message instead of
 * silently minting a token with no issuer.
 */
export function resolveSupabaseUrl(): string {
  const url = tryResolveSupabaseUrl();
  if (url) return url;
  throw new Error(
    'resolveSupabaseUrl: could not determine SUPABASE_URL. CI sets it at the job level; ' +
      'locally, ensure repo-root .env.local defines it (see .env.example) — the authed e2e ' +
      'fixture needs it to mint a test JWT whose `iss` claim matches what the running api ' +
      'expects.',
  );
}
