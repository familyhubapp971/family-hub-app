import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { membersRouter } from '../../../../apps/api/src/routes/members.js';
import type { User } from '../../../../apps/api/src/db/schema.js';

// FHS-108 — GET /api/members. Stub the DB at the module boundary;
// seed user + tenant context via a tiny middleware. Same shape as the
// onboarding/invitations route tests.

const dbMock = { select: vi.fn() };
vi.mock('../../../../apps/api/src/db/client.js', () => ({
  getDb: () => dbMock,
}));

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '00000000-0000-4000-8000-000000000777';
const CALLER_MEMBER_ID = '99999999-9999-4999-8999-999999999999';
const USER_EMAIL = 'sarah@example.com';
const FIXED_USER: User = {
  id: USER_ID,
  email: USER_EMAIL,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

interface SeedOpts {
  noTenant?: boolean;
  callerMissing?: boolean;
  /** Caller's role in the tenant — drives the FHS-510 email/pendingEmail gate. */
  callerRole?: string;
  /** Rows for the admin-only "current sign-in email per linked userId" select. */
  userRows?: Array<{ id: string; email: string }>;
  /** Rows for the admin-only "pending email changes" select. */
  pendingChangeRows?: Array<{ memberId: string; newEmail: string }>;
}

function buildAppWithSeed(opts: SeedOpts = {}, members: unknown[] = []) {
  const seed: MiddlewareHandler = async (c, next) => {
    c.set('user', { id: USER_ID, email: USER_EMAIL, claims: {} });
    c.set('userRow', FIXED_USER);
    c.set('tenantId', opts.noTenant ? undefined : TENANT_ID);
    await next();
  };

  // Selects, in order: caller-membership lookup, members list, pending
  // invites (FHS-276), then — ADMIN CALLER ONLY (FHS-510) — the linked-users
  // email lookup and the pending-email-changes lookup. A non-admin caller
  // never triggers the last two selects at all (see routes/members.ts).
  let selectCallIdx = 0;
  dbMock.select.mockImplementation(() => {
    selectCallIdx += 1;
    if (selectCallIdx === 1) {
      return {
        from: () => ({
          where: () => ({
            // FHS-252 — role is selected too so the handler can return
            // it as `callerRole` for the members page to gate admin-
            // only PIN affordances.
            limit: () =>
              Promise.resolve(
                opts.callerMissing
                  ? []
                  : [{ id: CALLER_MEMBER_ID, role: opts.callerRole ?? 'admin' }],
              ),
          }),
        }),
      };
    }
    if (selectCallIdx === 2) {
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(members),
          }),
        }),
      };
    }
    if (selectCallIdx === 3) {
      // FHS-276 pending invites (none in these fixtures).
      return {
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      };
    }
    if (selectCallIdx === 4) {
      // FHS-510 — linked-users email lookup (admin caller only).
      return {
        from: () => ({
          where: () => Promise.resolve(opts.userRows ?? []),
        }),
      };
    }
    // FHS-510 — pending email changes (admin caller only).
    return {
      from: () => ({
        where: () => Promise.resolve(opts.pendingChangeRows ?? []),
      }),
    };
  });

  const app = new Hono();
  app.use('*', seed);
  app.route('/api/members', membersRouter);
  return app;
}

beforeEach(() => {
  dbMock.select.mockReset();
});

describe('FHS-108 — GET /api/members', () => {
  it('returns 400 when no tenant is on the request', async () => {
    const app = buildAppWithSeed({ noTenant: true });
    const res = await app.request('/api/members');
    expect(res.status).toBe(400);
  });

  it('returns 403 when the caller is not a member of the tenant', async () => {
    const app = buildAppWithSeed({ callerMissing: true });
    const res = await app.request('/api/members');
    expect(res.status).toBe(403);
  });

  it('returns 200 with an empty list when the tenant has no members', async () => {
    const app = buildAppWithSeed({}, []);
    const res = await app.request('/api/members');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: unknown[] };
    expect(body.members).toEqual([]);
  });

  it('derives status=active when user_id is set, status=unclaimed otherwise', async () => {
    const baseDate = new Date('2026-05-02T00:00:00.000Z');
    const M1 = '22222222-2222-4222-8222-222222222222';
    const M2 = '33333333-3333-4333-8333-333333333333';
    const app = buildAppWithSeed({}, [
      {
        id: M1,
        displayName: 'Sarah',
        role: 'admin',
        avatarEmoji: '👩',
        userId: USER_ID,
        createdAt: baseDate,
        // FHS-252 — handler now reads is_child + pin_hash to derive
        // the per-row hasPin boolean. Stub them to safe defaults.
        isChild: false,
        pinHash: null,
      },
      {
        id: M2,
        displayName: 'Iman',
        role: 'child',
        avatarEmoji: '👧',
        userId: null,
        createdAt: baseDate,
        isChild: false,
        pinHash: null,
      },
    ]);
    const res = await app.request('/api/members');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      members: Array<{ id: string; status: string; role: string; avatarEmoji: string | null }>;
      callerRole: string;
      callerMemberId: string;
    };
    expect(body.members).toHaveLength(2);
    // FHS-523 — the caller's own member id + role are echoed back so a page can
    // show the caller's roster name (child-world pill) without a second fetch.
    expect(body.callerRole).toBe('admin');
    expect(body.callerMemberId).toBe(CALLER_MEMBER_ID);
    expect(body.members[0]).toMatchObject({
      id: M1,
      role: 'admin',
      status: 'active',
      avatarEmoji: '👩',
    });
    expect(body.members[1]).toMatchObject({
      id: M2,
      role: 'child',
      status: 'unclaimed',
      avatarEmoji: '👧',
    });
  });

  // FHS-510 — email / pendingEmail are admin-only.
  describe('email / pendingEmail gating (FHS-510)', () => {
    const baseDate = new Date('2026-05-02T00:00:00.000Z');
    const M1 = '22222222-2222-4222-8222-222222222222';

    function grownUpRow(over: Partial<Record<string, unknown>> = {}) {
      return {
        id: M1,
        displayName: 'Sarah',
        role: 'admin',
        avatarEmoji: '👩',
        userId: USER_ID,
        createdAt: baseDate,
        isChild: false,
        pinHash: null,
        ...over,
      };
    }

    it('an admin caller sees the real email and pendingEmail', async () => {
      const app = buildAppWithSeed(
        {
          callerRole: 'admin',
          userRows: [{ id: USER_ID, email: 'sarah@example.com' }],
          pendingChangeRows: [{ memberId: M1, newEmail: 'sarah.new@example.com' }],
        },
        [grownUpRow()],
      );
      const res = await app.request('/api/members');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        members: Array<{ email: string | null; pendingEmail: string | null }>;
      };
      expect(body.members[0]).toMatchObject({
        email: 'sarah@example.com',
        pendingEmail: 'sarah.new@example.com',
      });
      // 5 selects: caller, members, invites, linked-user emails, pending changes.
      expect(dbMock.select).toHaveBeenCalledTimes(5);
    });

    it('a non-admin caller always gets null on both fields, and the admin-only lookups never run', async () => {
      const app = buildAppWithSeed(
        {
          callerRole: 'adult',
          // Even if these WOULD resolve to data, a non-admin caller must
          // never see it — the handler skips the queries entirely.
          userRows: [{ id: USER_ID, email: 'sarah@example.com' }],
          pendingChangeRows: [{ memberId: M1, newEmail: 'sarah.new@example.com' }],
        },
        [grownUpRow()],
      );
      const res = await app.request('/api/members');
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        members: Array<{ email: string | null; pendingEmail: string | null }>;
      };
      expect(body.members[0]).toMatchObject({ email: null, pendingEmail: null });
      // Only 3 selects — the two FHS-510 admin-only lookups never fire.
      expect(dbMock.select).toHaveBeenCalledTimes(3);
    });
  });
});
