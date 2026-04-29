import type { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { config } from '../config.js';
import { getDb } from '../db/client.js';
import type { Database } from '../db/client.js';
import type { User as MirrorUser } from '../db/schema.js';
import { getOrCreateUser } from '../lib/user-mirror.js';
import { createLogger } from '../logger.js';

// JWT verification middleware (FHS-191) + mirror-row sync (FHS-192/193).
//
// Modern Supabase signs session JWTs with ES256 and exposes the public
// keys at <SUPABASE_URL>/auth/v1/.well-known/jwks.json. The middleware
// fetches that JWKS once, caches it, and refreshes on key-id miss. We
// never trust the legacy HS256 / shared-secret path — see ADR 0008.
//
// Once a token verifies, the middleware ensures a `public.users` mirror
// row exists for the JWT `sub` (FHS-192). The upsert is idempotent;
// every authenticated request runs through it so app tables can FK to
// `public.users` knowing the row will be there.
//
// Order in app.ts: cors → request-context → rate-limit → AUTH → tenant
// resolution. Tenant context keys off the authenticated user, so auth
// must run first.

const log = createLogger('auth');

const PUBLIC_PATH_PREFIXES = ['/health', '/hello'] as const;

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthenticatedUser | undefined;
  }
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  /** Raw verified payload — handlers may need claims we don't surface explicitly. */
  claims: JWTPayload;
  /** Mirror row from `public.users`. Present once FHS-192's getOrCreateUser
   *  has succeeded; absent if the verified JWT had no email claim and the
   *  middleware is configured with `requireEmailForMirror: false`. */
  mirror?: MirrorUser;
}

export interface AuthMiddlewareOptions {
  /**
   * Override the JWKS resolver. Production leaves this undefined and the
   * middleware builds a remote JWKS bound to SUPABASE_URL. Tests inject
   * a local JWKS so they don't hit the network and can mint matching
   * tokens with a known private key.
   */
  jwks?: JWTVerifyGetKey;
  /**
   * Override the issuer claim. Defaults to `${SUPABASE_URL}/auth/v1`
   * which matches what the Supabase auth server stamps into tokens.
   */
  issuer?: string;
  /**
   * Extra path prefixes (e.g. webhook callbacks) that bypass auth in
   * addition to the built-in /health and /hello.
   */
  publicPathPrefixes?: readonly string[];
  /**
   * Override the user-mirror upsert. Production leaves this undefined
   * and the middleware calls `getOrCreateUser(getDb(), claims)`. Unit
   * tests inject a stub so they don't need a real Postgres connection;
   * the integration spec exercises the real DB path.
   *
   * Returning `undefined` skips attaching a mirror row; the middleware
   * still attaches `claims` so downstream code that doesn't need the row
   * keeps working.
   */
  mirror?: (claims: { id: string; email: string }) => Promise<MirrorUser | undefined>;
  /**
   * If true (default), reject tokens that lack an email claim. The
   * mirror row's `email` column is NOT NULL UNIQUE so we can't insert
   * without one. Setting false skips the mirror call when email is
   * missing — useful for tokens minted by service-role flows that
   * legitimately have no email (none today; future-proofing).
   */
  requireEmailForMirror?: boolean;
}

let cachedDefaultJwks: JWTVerifyGetKey | undefined;

/**
 * Build (or reuse) the JWKS resolver for SUPABASE_URL. `createRemoteJWKSet`
 * returns a function that handles its own cache + cooldown internally:
 * keys are fetched on first call, cached for `cacheMaxAge` ms, and refetched
 * when a token's `kid` doesn't match any cached key (subject to `cooldownDuration`
 * to avoid hammering the JWKS endpoint on a bad token storm).
 */
function getDefaultJwks(): JWTVerifyGetKey | undefined {
  if (cachedDefaultJwks) return cachedDefaultJwks;
  if (!config.SUPABASE_URL) return undefined;

  const url = new URL('/auth/v1/.well-known/jwks.json', config.SUPABASE_URL);
  cachedDefaultJwks = createRemoteJWKSet(url, {
    cacheMaxAge: config.JWKS_CACHE_TTL_MS,
    // 30s cooldown between refreshes triggered by an unknown kid — bounds
    // the blast radius of a flood of forged tokens with random kids.
    cooldownDuration: 30_000,
  });
  return cachedDefaultJwks;
}

/** Test-only — clears the module-level cache so a fresh JWKS is built next call. */
export function _resetJwksCacheForTests(): void {
  cachedDefaultJwks = undefined;
}

function isPublicPath(path: string, extras: readonly string[]): boolean {
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  for (const prefix of extras) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function unauthorized(c: Context, reason: string, requestId?: string) {
  // Don't leak verification details to the client. The reason ends up in
  // structured logs; the response stays a flat 401 with the generic
  // error envelope used by the rest of the api.
  log.warn({ reason, request_id: requestId, path: c.req.path }, 'auth: rejecting request');
  return c.json({ error: 'unauthorized' }, 401);
}

function defaultMirror(db: Database) {
  return async (claims: { id: string; email: string }): Promise<MirrorUser> =>
    getOrCreateUser(db, claims);
}

/**
 * Hono middleware that verifies the `Authorization: Bearer <token>` header
 * against the Supabase JWKS, attaches the user to context on success, and
 * returns 401 otherwise. Public path prefixes (`/health`, `/hello`) are
 * short-circuited before any header inspection.
 */
export function authMiddleware(opts: AuthMiddlewareOptions = {}): MiddlewareHandler {
  const issuer =
    opts.issuer ?? (config.SUPABASE_URL ? `${config.SUPABASE_URL}/auth/v1` : undefined);
  const publicExtras = opts.publicPathPrefixes ?? [];
  const requireEmailForMirror = opts.requireEmailForMirror ?? true;
  // Resolve the mirror function lazily on the first call so unit tests
  // that pass `mirror: undefined` and never authenticate don't trigger
  // a real Postgres pool init.
  let mirror = opts.mirror;

  return async (c, next) => {
    const requestId = c.get('requestId');

    if (isPublicPath(c.req.path, publicExtras)) {
      await next();
      return;
    }

    // Resolve the JWKS source per-request — that lets tests inject one
    // via the options without restarting the app.
    const jwks = opts.jwks ?? getDefaultJwks();
    if (!jwks || !issuer) {
      // Fail-closed: if the api was started without SUPABASE_URL, every
      // protected request gets a 401. Production validates SUPABASE_URL
      // at boot (config.ts), so this branch only fires in misconfigured
      // dev/test setups.
      return unauthorized(c, 'jwks-unavailable', requestId);
    }

    const header = c.req.header('authorization') ?? c.req.header('Authorization');
    if (!header) return unauthorized(c, 'missing-authorization-header', requestId);

    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match || !match[1]) return unauthorized(c, 'malformed-authorization-header', requestId);
    const token = match[1].trim();
    if (!token) return unauthorized(c, 'empty-bearer-token', requestId);

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, jwks, {
        algorithms: ['ES256'],
        issuer,
      });
      payload = verified.payload;
    } catch (err) {
      const reason = mapVerifyError(err);
      return unauthorized(c, reason, requestId);
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
    if (!sub) return unauthorized(c, 'token-missing-sub-claim', requestId);

    const email = typeof payload['email'] === 'string' ? (payload['email'] as string) : undefined;

    // Mirror upsert. Skip when email is missing AND
    // `requireEmailForMirror` is false; otherwise reject — we need an
    // email to satisfy the NOT NULL UNIQUE column on `public.users`.
    let mirrorRow: MirrorUser | undefined;
    if (email !== undefined) {
      if (!mirror) mirror = defaultMirror(getDb());
      try {
        mirrorRow = await mirror({ id: sub, email });
      } catch (err) {
        // Mirror failures are server-side bugs (DB down, schema drift).
        // Logging at error level surfaces them in Sentry without leaking
        // detail to the client; the request gets a 500 from the global
        // onError handler in app.ts.
        log.error(
          { err: err instanceof Error ? err.message : String(err), request_id: requestId, sub },
          'auth: mirror upsert failed',
        );
        throw err;
      }
    } else if (requireEmailForMirror) {
      return unauthorized(c, 'token-missing-email-claim', requestId);
    }

    const user: AuthenticatedUser = {
      id: sub,
      claims: payload,
      ...(email !== undefined ? { email } : {}),
      ...(mirrorRow !== undefined ? { mirror: mirrorRow } : {}),
    };
    c.set('user', user);

    await next();
  };
}

function mapVerifyError(err: unknown): string {
  if (err instanceof joseErrors.JWTExpired) return 'token-expired';
  if (err instanceof joseErrors.JWTClaimValidationFailed) return 'token-claim-invalid';
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) return 'token-signature-invalid';
  if (err instanceof joseErrors.JWKSNoMatchingKey) return 'jwks-no-matching-key';
  if (err instanceof joseErrors.JOSEError) return `jose-${err.code}`;
  // Network errors from the JWKS fetch — fail-closed but capture for ops.
  if (err instanceof Error) {
    log.error({ err: err.message }, 'auth: unexpected verification error');
    return 'verification-error';
  }
  return 'unknown-error';
}

/**
 * Helper for route handlers behind the auth middleware. Throws when no
 * user is on the context — that should be unreachable in production
 * because the middleware rejects pre-handler, but the throw makes the
 * "I forgot to mount auth" mistake loud during development.
 */
export function getAuthenticatedUser(c: Context): AuthenticatedUser {
  const user = c.get('user');
  if (!user) {
    throw new Error(
      'getAuthenticatedUser called on a request that did not pass authMiddleware — ' +
        'mount the middleware before this handler or move the route under PUBLIC_PATH_PREFIXES.',
    );
  }
  return user;
}
