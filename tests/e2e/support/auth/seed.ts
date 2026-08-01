import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { ensureReaderFunctions, getE2eDb, schema } from './db.js';

// FHS-516 — seed one small, fully-isolated family per test. Every test that
// uses the `authedFamily` fixture gets its own tenant + admin user + child
// member + habit with randomised slug/email, so parallel workers never
// collide on the unique `tenants.slug` / `users.email` constraints. The
// tenant row's `onDelete: 'cascade'` FKs mean deleting it (cleanupFamily)
// removes every child row (members, habits, ...) in one statement.

export interface SeededFamily {
  tenantId: string;
  slug: string;
  tenantName: string;
  /** Matches the JWT `sub` the fixture mints — see support/fixtures.ts. */
  userId: string;
  email: string;
  adminMemberId: string;
  childMemberId: string;
  habitId: string;
}

function shortId(): string {
  return randomUUID().slice(0, 8);
}

export async function seedFamily(): Promise<SeededFamily> {
  // The api pushes schema on boot but never creates the SECURITY DEFINER
  // reader functions GET /api/me needs — apply them once before seeding so
  // authed pages resolve the family name (not the "Your family" fallback).
  await ensureReaderFunctions();
  const db = getE2eDb();
  const suffix = shortId();
  const slug = `e2e-${suffix}`;
  const tenantName = `E2E Test Family ${suffix}`;
  const userId = randomUUID();
  const email = `e2e-${suffix}@example.invalid`;

  const [tenant] = await db
    .insert(schema.tenants)
    .values({ slug, name: tenantName, timezone: 'UTC', currency: 'USD' })
    .returning({ id: schema.tenants.id });
  if (!tenant) throw new Error('seedFamily: tenant insert returned no row');

  // Mirrors what authMiddleware's getOrCreateUser would do on first
  // request — pre-inserting it here lets `members.user_id` FK to it
  // immediately. The middleware's own upsert on the first authenticated
  // request is a no-op refresh against this same row (idempotent).
  await db.insert(schema.users).values({ id: userId, email });

  const [adminMember] = await db
    .insert(schema.members)
    .values({
      tenantId: tenant.id,
      userId,
      displayName: `E2E Admin ${suffix}`,
      role: 'admin',
      isChild: false,
    })
    .returning({ id: schema.members.id });
  if (!adminMember) throw new Error('seedFamily: admin member insert returned no row');

  const [childMember] = await db
    .insert(schema.members)
    .values({
      tenantId: tenant.id,
      displayName: `E2E Kid ${suffix}`,
      role: 'child',
      isChild: true,
      age: 8,
    })
    .returning({ id: schema.members.id });
  if (!childMember) throw new Error('seedFamily: child member insert returned no row');

  const [habit] = await db
    .insert(schema.habits)
    .values({
      tenantId: tenant.id,
      memberId: childMember.id,
      name: 'Brush teeth',
    })
    .returning({ id: schema.habits.id });
  if (!habit) throw new Error('seedFamily: habit insert returned no row');

  return {
    tenantId: tenant.id,
    slug,
    tenantName,
    userId,
    email,
    adminMemberId: adminMember.id,
    childMemberId: childMember.id,
    habitId: habit.id,
  };
}

/**
 * Deletes the tenant row (cascades to every tenant-scoped child row: members,
 * habits, ...) and the users-mirror row. The mirror has no tenant_id (a user
 * can belong to several tenants), so it doesn't cascade off the tenant
 * delete — remove it explicitly so repeated local runs don't accumulate
 * `e2e-*@example.invalid` fixture rows.
 */
export async function cleanupFamily(
  family: Pick<SeededFamily, 'tenantId' | 'userId'>,
): Promise<void> {
  const db = getE2eDb();
  await db.delete(schema.tenants).where(eq(schema.tenants.id, family.tenantId));
  await db.delete(schema.users).where(eq(schema.users.id, family.userId));
}
