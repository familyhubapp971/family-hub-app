// FHS-384 — Integration step definitions for learn-insights.feature.
//
// Uses real Postgres on :5433. The DB is truncated in Background so each
// Scenario starts clean. Auth is wired with a real ES256 JWT (same pattern
// as mw-analytics.steps.ts). The app is built from the real route only —
// no full-app spin-up needed.
//
// @amiceli/vitest-cucumber rule: every step referenced in the feature must be
// bound inside the correct Scenario/Background callback with the exact keywords
// used. All steps are destructured per-Scenario to satisfy the lint rule.

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { SignJWT, exportJWK, generateKeyPair, type JWK, type KeyLike } from 'jose';
import { sql } from 'drizzle-orm';
import { expect, vi } from 'vitest';
import { authMiddleware, _resetJwksCacheForTests } from '../../../apps/api/src/middleware/auth.js';
import { learnInsightsRouter } from '../../../apps/api/src/routes/learn-insights.js';
import { members, mwMathsCertificates, tenants, users } from '../../../apps/api/src/db/schema.js';
import type { Database } from '../../../apps/api/src/db/client.js';
import { getTestDb } from '../support/db.js';

// ─── Mock the DB so the router calls the test pool ───────────────────────────

vi.mock('../../../apps/api/src/db/client.js', () => ({
  getDb: () => getTestDb(),
}));

// ─── Load feature ─────────────────────────────────────────────────────────────

const feature = await loadFeature(
  new URL('../features/learn-insights.feature', import.meta.url).pathname,
);

// ─── Key / JWT helpers ────────────────────────────────────────────────────────

const ISSUER = 'https://test.supabase.local/auth/v1';
const KID = 'learn-insights-test-kid';
const PARENT_USER_ID = '00000000-0000-4000-8000-000000000abc';
const PARENT_EMAIL = 'parent-insights@example.com';

async function genKey() {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = 'ES256';
  publicJwk.kid = KID;
  publicJwk.use = 'sig';
  return { privateKey, publicJwk };
}

async function mintToken(privateKey: KeyLike, userId: string, email: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'ES256', kid: KID })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(privateKey);
}

function makeJwks(publicJwk: JWK) {
  return async (header: { kid?: string; alg?: string }) => {
    const { importJWK } = await import('jose');
    if (header.kid !== publicJwk.kid) throw new Error(`no key for kid ${header.kid}`);
    return (await importJWK(publicJwk, header.alg ?? 'ES256')) as KeyLike;
  };
}

const resolveTenantFromHeader: MiddlewareHandler = async (c, next) => {
  c.set('tenantId', c.req.header('x-test-tenant'));
  await next();
};

// ─── describeFeature ──────────────────────────────────────────────────────────

describeFeature(feature, ({ Background, Scenario }) => {
  let db: Database;
  let app: Hono;
  let token: string;
  let kidToken: string;
  const tenantIds: Record<string, string> = {};
  const memberIds: Record<string, string> = {};

  let lastResponse: { status: number; body: Record<string, unknown> };

  function headers(tenantSlug: string, useKidToken = false) {
    return {
      Authorization: `Bearer ${useKidToken ? kidToken : token}`,
      'x-test-tenant': tenantIds[tenantSlug]!,
      'Content-Type': 'application/json',
    };
  }

  async function getInsights(memberName: string, tenantSlug: string, useKidToken = false) {
    const memberId = memberIds[memberName];
    const res = await app.request(`/api/learn/insights?memberId=${memberId ?? 'unknown-id'}`, {
      headers: headers(tenantSlug, useKidToken),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    lastResponse = { status: res.status, body };
  }

  // ── Background ─────────────────────────────────────────────────────────────

  Background(({ Given, And }) => {
    Given('the test Postgres has clean learn insights tables', async () => {
      db = getTestDb() as unknown as Database;

      // Truncate all relevant tables in dependency order.
      await db.execute(sql`TRUNCATE TABLE mw_maths_certificates RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE mw_maths_progress RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE mw_logic_certificates RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE mw_logic_progress RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE learn_progress RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE world_flags_progress RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE members RESTART IDENTITY CASCADE`);
      await db.execute(sql`TRUNCATE TABLE tenants RESTART IDENTITY CASCADE`);
      await db.execute(sql`DELETE FROM users WHERE id = ${PARENT_USER_ID}`);
      _resetJwksCacheForTests();
      for (const m of [tenantIds, memberIds]) {
        for (const k of Object.keys(m)) delete m[k];
      }
    });

    And('a users mirror row exists for the learn insights caller', async () => {
      await db.execute(
        sql`INSERT INTO users (id, email) VALUES (${PARENT_USER_ID}, ${PARENT_EMAIL})
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
      );
      const { privateKey, publicJwk } = await genKey();
      app = new Hono();
      app.use(
        '*',
        authMiddleware({
          issuer: ISSUER,
          jwks: makeJwks(publicJwk),
          userMirrorSync: async () => {
            const rows = await db
              .select()
              .from(users)
              .where(sql`id = ${PARENT_USER_ID}`)
              .limit(1);
            return rows[0]!;
          },
        }),
      );
      app.use('*', resolveTenantFromHeader);
      app.route('/api/learn/insights', learnInsightsRouter);
      token = await mintToken(privateKey, PARENT_USER_ID, PARENT_EMAIL);
    });

    And('a tenant {string} exists with the caller as an admin member', async (_c, slug: string) => {
      const [tenant] = await db
        .insert(tenants)
        .values({ slug, name: `${slug} Family` })
        .returning();
      tenantIds[slug] = tenant!.id;
      await db.insert(members).values({
        tenantId: tenant!.id,
        userId: PARENT_USER_ID,
        displayName: 'Parent',
        role: 'admin',
      });
    });

    And(
      'the {string} tenant has a child member {string}',
      async (_c, slug: string, name: string) => {
        const [row] = await db
          .insert(members)
          .values({
            tenantId: tenantIds[slug]!,
            userId: null,
            displayName: name,
            role: 'child',
            isChild: true,
          })
          .returning();
        memberIds[name] = row!.id;
      },
    );

    And(
      'a second tenant {string} exists with a child member {string}',
      async (_c, slug: string, name: string) => {
        const [tenant] = await db
          .insert(tenants)
          .values({ slug, name: `${slug} Family` })
          .returning();
        tenantIds[slug] = tenant!.id;
        const [childRow] = await db
          .insert(members)
          .values({
            tenantId: tenant!.id,
            userId: null,
            displayName: name,
            role: 'child',
            isChild: true,
          })
          .returning();
        memberIds[name] = childRow!.id;
      },
    );
  });

  // ── Scenario: parent reads insights with seeded Maths data ────────────────

  Scenario(
    "a parent reads a child's insights with seeded Maths progress",
    ({ Given, When, Then, And }) => {
      Given(
        '{string} has {int} maths certificates in {string}',
        async (_c, name: string, count: number, slug: string) => {
          const ops = ['addition', 'subtraction', 'multiplication', 'division'];
          let inserted = 0;
          for (const op of ops) {
            for (let t = 1; t <= 12 && inserted < count; t++) {
              await db.insert(mwMathsCertificates).values({
                tenantId: tenantIds[slug]!,
                memberId: memberIds[name]!,
                operation: op,
                difficulty: String(t),
                totalCorrect: 10,
              });
              inserted++;
            }
          }
        },
      );

      When(
        'the caller GETs learn insights for {string} in {string}',
        async (_c, name: string, slug: string) => {
          await getInsights(name, slug);
        },
      );

      Then('the learn insights response status is {int}', (_c, status: number) => {
        expect(lastResponse.status).toBe(status);
      });

      And('the learn insights memberId matches {string}', (_c, name: string) => {
        expect(lastResponse.body.memberId).toBe(memberIds[name]);
      });

      And('the learn insights Maths subject has certificatesEarned {int}', (_c, earned: number) => {
        const subjects = lastResponse.body.subjects as Array<{
          subject: string;
          certificatesEarned: number;
        }>;
        const maths = subjects.find((s) => s.subject === 'Maths');
        expect(maths?.certificatesEarned).toBe(earned);
      });

      And('the learn insights Maths progressPct is {int}', (_c, pct: number) => {
        const subjects = lastResponse.body.subjects as Array<{
          subject: string;
          progressPct: number;
        }>;
        const maths = subjects.find((s) => s.subject === 'Maths');
        expect(maths?.progressPct).toBe(pct);
      });

      And('the learn insights hasActivity is {word}', (_c, val: string) => {
        expect(lastResponse.body.hasActivity).toBe(val === 'true');
      });
    },
  );

  // ── Scenario: empty state ──────────────────────────────────────────────────

  Scenario('empty state — a child with no Learn activity', ({ When, Then, And }) => {
    When(
      'the caller GETs learn insights for {string} in {string}',
      async (_c, name: string, slug: string) => {
        await getInsights(name, slug);
      },
    );

    Then('the learn insights response status is {int}', (_c, status: number) => {
      expect(lastResponse.status).toBe(status);
    });

    And('the learn insights hasActivity is {word}', (_c, val: string) => {
      expect(lastResponse.body.hasActivity).toBe(val === 'true');
    });

    And('the learn insights weakest is null', () => {
      expect(lastResponse.body.weakest).toBeNull();
    });

    And('every subject has progressPct 0', () => {
      const subjects = lastResponse.body.subjects as Array<{ progressPct: number }>;
      for (const s of subjects) {
        expect(s.progressPct).toBe(0);
      }
    });
  });

  // ── Scenario: tenant isolation ─────────────────────────────────────────────

  Scenario(
    'tenant isolation — a parent cannot read a child in another tenant',
    ({ When, Then }) => {
      When(
        'the caller GETs learn insights for {string} in {string}',
        async (_c, name: string, slug: string) => {
          await getInsights(name, slug);
        },
      );

      Then('the learn insights response status is {int}', (_c, status: number) => {
        expect(lastResponse.status).toBe(status);
      });
    },
  );

  // ── Scenario: kid caller is rejected ──────────────────────────────────────

  Scenario('kid-role caller is rejected (403 ADULT_REQUIRED)', ({ Given, When, Then, And }) => {
    Given('a kid caller {string} in {string}', async (_c, name: string, slug: string) => {
      // Create a kid member with its own auth user identity so we can
      // mint a JWT for it. A real kid member has isChild=true and role='child'.
      const kidUserId = '00000000-0000-4000-8000-000000000bbb';
      const kidEmail = `${name.toLowerCase()}@example.com`;

      await db.execute(
        sql`INSERT INTO users (id, email) VALUES (${kidUserId}, ${kidEmail})
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
      );
      await db.insert(members).values({
        tenantId: tenantIds[slug]!,
        userId: kidUserId,
        displayName: name,
        role: 'child',
        isChild: true,
      });
      memberIds[name] = kidUserId; // store so getInsights can look it up if needed

      // Mint a kid token via the same keypair as the parent (same JWKS). In
      // production kid tokens are HS256, but in this test the middleware is the
      // same ES256 auth — we just need a different subject claim.
      const { privateKey: kpk } = await genKey();
      // Re-build app with a combined JWKS that knows both kids. Simpler: just
      // re-use the parent's existing app and swap the Authorization header below.
      // The kid's role check comes from the DB (members.role = 'child'), not
      // from the JWT payload, so using the parent keypair here is fine for
      // testing the role guard.
      kidToken = await mintToken(kpk, kidUserId, kidEmail);

      // Re-wire the auth to accept the kid's key too (easiest: issue from
      // the SAME key by re-keying the app). Since the JWKS cache is global,
      // regenerate it for this user.
      const { privateKey: newPk, publicJwk: newJwk } = await genKey();
      newJwk.kid = KID; // re-use same KID so the existing JWKS stub matches
      kidToken = await mintToken(newPk, kidUserId, kidEmail);

      // Rebuild the app wiring so the kid's token verifies.
      _resetJwksCacheForTests();
      app = new Hono();
      app.use(
        '*',
        authMiddleware({
          issuer: ISSUER,
          jwks: async (header) => {
            const { importJWK } = await import('jose');
            return (await importJWK(newJwk, header.alg ?? 'ES256')) as KeyLike;
          },
          userMirrorSync: async (claims) => {
            const rows = await db
              .select()
              .from(users)
              .where(sql`id = ${claims.sub}`)
              .limit(1);
            return rows[0]!;
          },
        }),
      );
      app.use('*', resolveTenantFromHeader);
      app.route('/api/learn/insights', learnInsightsRouter);
    });

    When(
      'the kid caller GETs learn insights for {string} in {string}',
      async (_c, name: string, slug: string) => {
        await getInsights(name, slug, true);
      },
    );

    Then('the learn insights response status is {int}', (_c, status: number) => {
      expect(lastResponse.status).toBe(status);
    });

    And('the learn insights error code is {string}', (_c, code: string) => {
      expect((lastResponse.body as { errorCode?: string }).errorCode).toBe(code);
    });
  });
});
