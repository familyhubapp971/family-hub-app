import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  SignJWT,
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
  type KeyLike,
} from 'jose';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authMiddleware, getAuthenticatedUser } from '@familyhub/api/middleware/auth';
import { getOrCreateUser } from '../../../apps/api/src/lib/user-mirror.js';
import type { Database } from '../../../apps/api/src/db/client.js';
import { getTestDb } from '../support/db.js';

// FHS-193 — full auth → mirror sync round-trip against real Postgres.
//
// The unit tests cover the middleware's DI surface in isolation; this
// spec exercises the wiring end-to-end:
//
//   1. Real ES256 keypair, real JWT, real JWKS over HTTP.
//   2. Real `getOrCreateUser` against the test DB on :5433.
//   3. Real `authMiddleware` with the default mirror, no stubs.
//
// What we assert:
//   - Verified token + email claim → 200, row inserted in `public.users`.
//   - Same token replayed → 200, no duplicate row.
//   - Token signed by an untrusted key → 401, no row inserted.
//   - Token with `exp` in the past → 401, no row inserted.
//   - Public route (/health) → 200 without a token.
//   - Mirror row is reachable from the request handler via getAuthenticatedUser().

const ALG = 'ES256';
const KID = 'flow-key-1';

interface Keypair {
  privateKey: KeyLike;
  publicJwk: JWK;
}

let trustedKey: Keypair;
let server: http.Server;
let serverUrl: string;
let issuer: string;
let db: Database;

async function generateKey(kid = KID): Promise<Keypair> {
  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = ALG;
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  return { privateKey, publicJwk };
}

async function mintToken(
  privateKey: KeyLike,
  opts: {
    sub?: string;
    email?: string;
    expSecondsFromNow?: number;
    issuer?: string;
    kid?: string;
  } = {},
): Promise<string> {
  const sub = opts.sub ?? randomUUID();
  const exp = Math.floor(Date.now() / 1000) + (opts.expSecondsFromNow ?? 3600);
  const builder = new SignJWT(opts.email ? { email: opts.email } : {})
    .setProtectedHeader({ alg: ALG, kid: opts.kid ?? KID })
    .setSubject(sub)
    .setIssuer(opts.issuer ?? issuer)
    .setIssuedAt()
    .setExpirationTime(exp);
  return builder.sign(privateKey);
}

beforeAll(async () => {
  trustedKey = await generateKey();

  server = http.createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [trustedKey.publicJwk] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('failed to bind JWKS server');
  serverUrl = `http://127.0.0.1:${addr.port}`;
  issuer = `${serverUrl}/auth/v1`;

  db = getTestDb() as unknown as Database;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
});

afterEach(async () => {
  // Belt-and-braces: clear the table again so a failing assert mid-suite
  // doesn't leak rows into the next test's WHERE NOT EXISTS clauses.
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
});

function buildApp() {
  // Wire the real authMiddleware with a JWKS bound to our test server.
  // No `mirror` override — we use the default (`getOrCreateUser` against
  // the real test DB), which is the whole point of this spec.
  const app = new Hono();
  const jwks = createRemoteJWKSet(new URL(`${serverUrl}/auth/v1/.well-known/jwks.json`), {
    cacheMaxAge: 60_000,
    cooldownDuration: 5_000,
  });
  app.use(
    '*',
    authMiddleware({
      jwks,
      issuer,
      mirror: (claims) => getOrCreateUser(db, claims),
    }),
  );
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/me', (c) => {
    const user = getAuthenticatedUser(c);
    return c.json({
      id: user.id,
      email: user.email,
      mirrorEmail: user.mirror?.email,
      mirrorId: user.mirror?.id,
    });
  });
  return app;
}

async function userCount(): Promise<number> {
  const { rows } = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM users`,
  );
  return Number(rows[0]?.count ?? '0');
}

describe('FHS-193 — auth flow (middleware + mirror, real Postgres)', () => {
  it('verifies a valid token and inserts the mirror row on first hit', async () => {
    const app = buildApp();
    const sub = randomUUID();
    const email = 'first@example.com';
    const token = await mintToken(trustedKey.privateKey, { sub, email });

    const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: sub,
      email,
      mirrorEmail: email,
      mirrorId: sub,
    });
    expect(await userCount()).toBe(1);
  });

  it('is idempotent — same token replayed does not duplicate the row', async () => {
    const app = buildApp();
    const sub = randomUUID();
    const email = 'replay@example.com';
    const token = await mintToken(trustedKey.privateKey, { sub, email });

    expect(
      (await app.request('/me', { headers: { Authorization: `Bearer ${token}` } })).status,
    ).toBe(200);
    expect(
      (await app.request('/me', { headers: { Authorization: `Bearer ${token}` } })).status,
    ).toBe(200);

    expect(await userCount()).toBe(1);
  });

  it('401s a token signed by an untrusted key — no row inserted', async () => {
    const attacker = await generateKey();
    const app = buildApp();
    const token = await mintToken(attacker.privateKey, { kid: KID, email: 'evil@example.com' });

    const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect(await userCount()).toBe(0);
  });

  it('401s an expired token — no row inserted', async () => {
    const app = buildApp();
    const token = await mintToken(trustedKey.privateKey, {
      email: 'late@example.com',
      expSecondsFromNow: -60,
    });

    const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect(await userCount()).toBe(0);
  });

  it('200s /health without a token and inserts no row', async () => {
    const app = buildApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await userCount()).toBe(0);
  });

  it('rejects a token with no email claim (mirror cannot upsert without one)', async () => {
    const app = buildApp();
    const token = await mintToken(trustedKey.privateKey, { sub: randomUUID() });

    const res = await app.request('/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect(await userCount()).toBe(0);
  });

  it('refreshes the mirror email when a later token carries a new email for the same sub', async () => {
    const app = buildApp();
    const sub = randomUUID();

    const first = await mintToken(trustedKey.privateKey, { sub, email: 'old@example.com' });
    const r1 = await app.request('/me', { headers: { Authorization: `Bearer ${first}` } });
    expect(r1.status).toBe(200);

    const second = await mintToken(trustedKey.privateKey, { sub, email: 'new@example.com' });
    const r2 = await app.request('/me', { headers: { Authorization: `Bearer ${second}` } });
    expect(r2.status).toBe(200);

    const body = (await r2.json()) as { mirrorEmail?: string };
    expect(body.mirrorEmail).toBe('new@example.com');
    expect(await userCount()).toBe(1);
  });
});
