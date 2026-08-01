import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { membersRouter } from '../../../../apps/api/src/routes/members.js';
import { memberEmailChanges, users } from '../../../../apps/api/src/db/schema.js';
import type { User } from '../../../../apps/api/src/db/schema.js';

// FHS-510 — admin changes a grown-up's sign-in email, confirmed by a
// one-time emailed link.
//
//   POST /api/members/:id/email-change          — admin-only, starts it.
//   POST /api/members/email-change/confirm       — PUBLIC, applies it.
//   POST /api/members/:id/email-change/cancel    — admin-only, drops it.

const pinRequestTenant = vi.fn(async () => undefined);
const dbMock = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
};
vi.mock('../../../../apps/api/src/db/client.js', () => ({
  getDb: () => dbMock,
  pinRequestTenant: (...args: unknown[]) => pinRequestTenant(...args),
}));

const sendEmail = vi.fn();
vi.mock('../../../../apps/api/src/lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const updateUserEmailById = vi.fn();
vi.mock('../../../../apps/api/src/lib/supabase-admin.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../apps/api/src/lib/supabase-admin.js')
  >('../../../../apps/api/src/lib/supabase-admin.js');
  return {
    ...actual,
    updateUserEmailById: (...args: unknown[]) => updateUserEmailById(...args),
  };
});

vi.mock('../../../../apps/api/src/config.js', async () => {
  const actual = await vi.importActual<typeof import('../../../../apps/api/src/config.js')>(
    '../../../../apps/api/src/config.js',
  );
  return {
    ...actual,
    config: { ...actual.config, APP_BASE_URL: 'https://app.familyhub.test' },
  };
});

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000777';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_USER_ID = '33333333-3333-4333-8333-333333333333';
const CHANGE_ID = '44444444-4444-4444-8444-444444444444';

const FIXED_ADMIN: User = {
  id: ADMIN_USER_ID,
  email: 'admin@example.com',
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};

// Chain stub: from/where/limit are no-ops returning `this`; returning()/the
// promise-then hook resolve to `rows`. Matches the pattern used across the
// other members route test files.
function chain(rows: unknown): unknown {
  const obj: Record<string, unknown> = {
    from: () => obj,
    where: () => obj,
    limit: () => obj,
    set: () => obj,
    values: () => obj,
    returning: () => Promise.resolve(rows),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(res, rej),
  };
  return obj;
}

/** Queue N rows-arrays for consecutive db.select(...) calls, in call order. */
function queueSelects(...sequence: unknown[][]) {
  let idx = 0;
  dbMock.select.mockImplementation(() => {
    const rows = sequence[idx] ?? [];
    idx += 1;
    return chain(rows);
  });
}

function seedAuth() {
  const seed: MiddlewareHandler = async (c, next) => {
    c.set('user', { id: ADMIN_USER_ID, email: FIXED_ADMIN.email, claims: {} });
    c.set('userRow', FIXED_ADMIN);
    c.set('tenantId', TENANT_ID);
    await next();
  };
  const app = new Hono();
  app.use('*', seed);
  app.route('/api/members', membersRouter);
  return app;
}

function publicApp() {
  // The confirm endpoint is PUBLIC — no seed middleware sets user/userRow/
  // tenantId, matching production (it's exempted from authMiddleware via
  // PUBLIC_PATH_PREFIXES, which never runs in this unit test at all).
  const app = new Hono();
  app.route('/api/members', membersRouter);
  return app;
}

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.insert.mockReset();
  dbMock.delete.mockReset();
  dbMock.execute.mockReset();
  dbMock.transaction.mockReset();
  pinRequestTenant.mockClear();
  sendEmail.mockReset();
  updateUserEmailById.mockReset();

  dbMock.insert.mockImplementation(() => chain([{ id: CHANGE_ID }]));
  dbMock.delete.mockImplementation(() => chain([]));
  sendEmail.mockResolvedValue({ ok: true });
});

describe('FHS-510 — POST /api/members/:id/email-change (admin-only, starts the change)', () => {
  it('non-admin caller → 403, nothing written, no email sent', async () => {
    queueSelects([{ id: 'caller-member', role: 'adult' }]);
    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com' }),
    });
    expect(res.status).toBe(403);
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('target not in this tenant → 404', async () => {
    queueSelects([{ id: 'caller-member', role: 'admin' }], []); // target lookup empty
    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com' }),
    });
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('target has no linked login (userId null) → 400 NO_LOGIN_EMAIL', async () => {
    queueSelects(
      [{ id: 'caller-member', role: 'admin' }],
      [{ id: TARGET_ID, userId: null, displayName: 'Iman' }],
    );
    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errorCode: string };
    expect(body.errorCode).toBe('NO_LOGIN_EMAIL');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('new email already registered to another account → 409, no insert/send', async () => {
    queueSelects(
      [{ id: 'caller-member', role: 'admin' }],
      [{ id: TARGET_ID, userId: TARGET_USER_ID, displayName: 'Yusuf' }],
      [{ email: 'yusuf@old.example.com' }], // current email lookup
      [{ id: 'some-other-user-id' }], // existing-email lookup: a collision
    );
    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'taken@example.com' }),
    });
    expect(res.status).toBe(409);
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('happy path — creates a hashed pending row and emails the NEW address, never the raw token', async () => {
    queueSelects(
      [{ id: 'caller-member', role: 'admin' }],
      [{ id: TARGET_ID, userId: TARGET_USER_ID, displayName: 'Yusuf' }],
      [{ email: 'yusuf@old.example.com' }],
      [], // no email collision
    );
    let insertedValues: Record<string, unknown> | null = null;
    dbMock.insert.mockImplementation(() => ({
      values: (v: Record<string, unknown>) => {
        insertedValues = v;
        return { returning: () => Promise.resolve([{ id: CHANGE_ID }]) };
      },
    }));

    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Yusuf.New@Example.com' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pendingEmail: string };
    expect(body.pendingEmail).toBe('yusuf.new@example.com'); // lower-cased

    // The row written to the DB carries a 64-hex-char SHA-256 hash, never a
    // field holding the raw token.
    expect(insertedValues).toMatchObject({
      tenantId: TENANT_ID,
      memberId: TARGET_ID,
      newEmail: 'yusuf.new@example.com',
    });
    expect(insertedValues).toHaveProperty('tokenHash');
    expect((insertedValues as unknown as { tokenHash: string }).tokenHash).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(Object.keys(insertedValues as object)).not.toContain('token');

    // The email goes to the NEW address, with a confirm link carrying the
    // member id and a token query param — but the token in that link is
    // NOT the same string as the stored hash (i.e. it's the raw secret).
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmail.mock.calls[0]![0] as { to: string; html: string };
    expect(emailArgs.to).toBe('yusuf.new@example.com');
    const match = /confirm-email\/([^"?]+)\?token=([^"&\s]+)/.exec(emailArgs.html);
    expect(match?.[1]).toBe(TARGET_ID);
    const rawTokenInLink = match?.[2];
    expect(rawTokenInLink).toBeTruthy();
    expect(rawTokenInLink).not.toBe((insertedValues as unknown as { tokenHash: string }).tokenHash);
  });

  it('email send failure rolls back the pending row and returns 502', async () => {
    queueSelects(
      [{ id: 'caller-member', role: 'admin' }],
      [{ id: TARGET_ID, userId: TARGET_USER_ID, displayName: 'Yusuf' }],
      [{ email: 'yusuf@old.example.com' }],
      [],
    );
    sendEmail.mockResolvedValue({ ok: false, error: 'boom' });
    let deletedTable: unknown = null;
    dbMock.delete.mockImplementation((table: unknown) => {
      deletedTable = table;
      return chain([]);
    });

    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com' }),
    });
    expect(res.status).toBe(502);
    expect(deletedTable).toBe(memberEmailChanges);
  });
});

describe('FHS-510 — POST /api/members/:id/email-change/cancel (admin-only)', () => {
  it('non-admin caller → 403, no delete', async () => {
    queueSelects([{ id: 'caller-member', role: 'adult' }]);
    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change/cancel`, {
      method: 'POST',
    });
    expect(res.status).toBe(403);
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('admin caller → 200 { cancelled: true }, deletes the pending row', async () => {
    queueSelects([{ id: 'caller-member', role: 'admin' }]);
    let deletedTable: unknown = null;
    dbMock.delete.mockImplementation((table: unknown) => {
      deletedTable = table;
      return chain([]);
    });
    const app = seedAuth();
    const res = await app.request(`/api/members/${TARGET_ID}/email-change/cancel`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect((await res.json()) as { cancelled: boolean }).toEqual({ cancelled: true });
    expect(deletedTable).toBe(memberEmailChanges);
  });
});

describe('FHS-510 — POST /api/members/email-change/confirm (PUBLIC)', () => {
  function txMock() {
    const tx = { execute: vi.fn(async () => ({ rows: [] })), update: vi.fn(() => chain([])) };
    dbMock.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
    return tx;
  }

  it('no matching row (wrong token) → 410 expired, no Supabase call', async () => {
    dbMock.execute.mockResolvedValue({ rows: [] });
    const app = publicApp();
    const res = await app.request('/api/members/email-change/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: TARGET_ID, token: 'wrong-token' }),
    });
    expect(res.status).toBe(410);
    expect(updateUserEmailById).not.toHaveBeenCalled();
  });

  it('already-used row → 410 expired', async () => {
    dbMock.execute.mockResolvedValue({
      rows: [
        {
          id: CHANGE_ID,
          tenant_id: TENANT_ID,
          member_id: TARGET_ID,
          new_email: 'new@example.com',
          expires_at: new Date(Date.now() + 60_000),
          used_at: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
    });
    const app = publicApp();
    const res = await app.request('/api/members/email-change/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: TARGET_ID, token: 'some-token' }),
    });
    expect(res.status).toBe(410);
    expect(updateUserEmailById).not.toHaveBeenCalled();
  });

  it('expired row (past expires_at) → 410 expired', async () => {
    dbMock.execute.mockResolvedValue({
      rows: [
        {
          id: CHANGE_ID,
          tenant_id: TENANT_ID,
          member_id: TARGET_ID,
          new_email: 'new@example.com',
          expires_at: new Date(Date.now() - 1000),
          used_at: null,
        },
      ],
    });
    const app = publicApp();
    const res = await app.request('/api/members/email-change/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: TARGET_ID, token: 'some-token' }),
    });
    expect(res.status).toBe(410);
    expect(updateUserEmailById).not.toHaveBeenCalled();
  });

  it('happy path — pins the row tenant, updates Supabase + the users mirror, marks used, returns the new email', async () => {
    dbMock.execute.mockResolvedValue({
      rows: [
        {
          id: CHANGE_ID,
          tenant_id: TENANT_ID,
          member_id: TARGET_ID,
          new_email: 'yusuf.new@example.com',
          expires_at: new Date(Date.now() + 60_000),
          used_at: null,
        },
      ],
    });
    // select #1: target member lookup. select #2 (after the transaction):
    // tenants.slug lookup.
    queueSelects(
      [{ id: TARGET_ID, userId: TARGET_USER_ID, displayName: 'Yusuf' }],
      [{ slug: 'khans' }],
    );
    updateUserEmailById.mockResolvedValue(undefined);
    const tx = txMock();

    const app = publicApp();
    const res = await app.request('/api/members/email-change/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: TARGET_ID, token: 'the-raw-token' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { newEmail: string; memberName: string; tenantSlug: string };
    expect(body).toEqual({
      newEmail: 'yusuf.new@example.com',
      memberName: 'Yusuf',
      tenantSlug: 'khans',
    });

    expect(pinRequestTenant).toHaveBeenCalledWith(TENANT_ID);
    expect(updateUserEmailById).toHaveBeenCalledWith(TARGET_USER_ID, 'yusuf.new@example.com');
    expect(tx.update).toHaveBeenCalledWith(users);
    expect(tx.update).toHaveBeenCalledWith(memberEmailChanges);

    // The lookup itself hashes the SAME way the request handler does, so a
    // regression that swaps SHA-256 for something else would be caught by
    // this handshake test rather than only surfacing at runtime.
    const expectedHash = createHash('sha256').update('the-raw-token').digest('hex');
    const executedSql = dbMock.execute.mock.calls[0]![0] as { queryChunks?: unknown };
    expect(JSON.stringify(executedSql)).toContain(expectedHash);
  });

  it('member removed / unlinked since the request → 410 expired (no Supabase call)', async () => {
    dbMock.execute.mockResolvedValue({
      rows: [
        {
          id: CHANGE_ID,
          tenant_id: TENANT_ID,
          member_id: TARGET_ID,
          new_email: 'new@example.com',
          expires_at: new Date(Date.now() + 60_000),
          used_at: null,
        },
      ],
    });
    queueSelects([]); // target lookup: member gone
    const app = publicApp();
    const res = await app.request('/api/members/email-change/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: TARGET_ID, token: 'some-token' }),
    });
    expect(res.status).toBe(410);
    expect(updateUserEmailById).not.toHaveBeenCalled();
  });

  it('Supabase admin update failure → 502, users mirror NOT touched', async () => {
    dbMock.execute.mockResolvedValue({
      rows: [
        {
          id: CHANGE_ID,
          tenant_id: TENANT_ID,
          member_id: TARGET_ID,
          new_email: 'new@example.com',
          expires_at: new Date(Date.now() + 60_000),
          used_at: null,
        },
      ],
    });
    queueSelects([{ id: TARGET_ID, userId: TARGET_USER_ID, displayName: 'Yusuf' }]);
    updateUserEmailById.mockRejectedValue(new Error('supabase down'));
    const app = publicApp();
    const res = await app.request('/api/members/email-change/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: TARGET_ID, token: 'some-token' }),
    });
    expect(res.status).toBe(502);
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });
});
