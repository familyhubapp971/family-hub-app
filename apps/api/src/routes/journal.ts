import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { journalEntries, members } from '../db/schema.js';
import { getAuthenticatedUser } from '../middleware/auth.js';

// FHS-270 — GET / POST /api/journal.
//
// A child's private text journal. Scoped to (tenant, member): readable by
// the child themselves and the tenant admin who opens their world.
// Parent-accessed (standard auth); memberId is passed + validated.

export const journalEntrySchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  createdAt: z.string().datetime(),
});

export const listJournalResponseSchema = z.object({
  entries: z.array(journalEntrySchema),
});

const memberQuerySchema = z.object({ memberId: z.string().uuid() });
const createRequestSchema = z.object({
  memberId: z.string().uuid(),
  body: z.string().trim().min(1, 'body is required').max(5000),
});

async function callerIsMember(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.tenantId, tenantId), eq(members.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

async function memberInTenant(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  memberId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.tenantId, tenantId), eq(members.id, memberId)))
    .limit(1);
  return rows.length > 0;
}

export const journalRouter = new Hono()
  .get('/', async (c) => {
    getAuthenticatedUser(c);
    const userRow = c.get('userRow');
    if (!userRow) throw new Error('journal handler reached without userRow');
    const tenantId = c.get('tenantId');
    if (!tenantId) {
      return c.json({ error: 'tenant context required', errorCode: 'TENANT_REQUIRED' }, 400);
    }
    const parsed = memberQuerySchema.safeParse({ memberId: c.req.query('memberId') });
    if (!parsed.success) {
      return c.json(
        {
          error: 'invalid request',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400,
      );
    }
    const db = getDb();
    if (!(await callerIsMember(db, tenantId, userRow.id))) {
      return c.json({ error: 'forbidden', detail: 'caller is not a member of this tenant' }, 403);
    }
    if (!(await memberInTenant(db, tenantId, parsed.data.memberId))) {
      return c.json({ error: 'not found', detail: 'member not found in this tenant' }, 404);
    }
    const rows = await db
      .select({
        id: journalEntries.id,
        body: journalEntries.body,
        createdAt: journalEntries.createdAt,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.memberId, parsed.data.memberId),
        ),
      )
      .orderBy(desc(journalEntries.createdAt));
    return c.json(
      listJournalResponseSchema.parse({
        entries: rows.map((r) => ({
          id: r.id,
          body: r.body,
          createdAt: r.createdAt.toISOString(),
        })),
      }),
    );
  })
  .post('/', async (c) => {
    getAuthenticatedUser(c);
    const userRow = c.get('userRow');
    if (!userRow) throw new Error('journal handler reached without userRow');
    const tenantId = c.get('tenantId');
    if (!tenantId) {
      return c.json({ error: 'tenant context required', errorCode: 'TENANT_REQUIRED' }, 400);
    }
    const body = (await c.req.json().catch(() => null)) as unknown;
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: 'invalid request',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400,
      );
    }
    const db = getDb();
    if (!(await callerIsMember(db, tenantId, userRow.id))) {
      return c.json({ error: 'forbidden', detail: 'caller is not a member of this tenant' }, 403);
    }
    if (!(await memberInTenant(db, tenantId, parsed.data.memberId))) {
      return c.json({ error: 'not found', detail: 'member not found in this tenant' }, 404);
    }
    const [row] = await db
      .insert(journalEntries)
      .values({ tenantId, memberId: parsed.data.memberId, body: parsed.data.body })
      .returning({
        id: journalEntries.id,
        body: journalEntries.body,
        createdAt: journalEntries.createdAt,
      });
    if (!row) return c.json({ error: 'insert failed', errorCode: 'JOURNAL_INSERT_NO_ROW' }, 500);
    return c.json(
      journalEntrySchema.parse({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      }),
      201,
    );
  });
