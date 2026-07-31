import { describe, expect, it, vi } from 'vitest';
import {
  applySkipPenalties,
  BOOST_PRESETS,
  DEFAULT_STICKER_RATE_MINOR,
  effectiveRateMinor,
  formatMinor,
  moneyMinorFromStickers,
  rateMinorToDecimal,
  reverseSkipPenalties,
  sumAdjustmentsMinor,
} from '../../../../apps/api/src/lib/reward-config.js';

// FHS-512 — configurable reward economy. MONEY-CRITICAL: every quantity here
// is an integer minor-unit amount (e.g. 50 = 0.50) — these tests exist to
// catch a float creeping back in or a rate resolving to the wrong value.

const TENANT_ID = 'tenant-1';
const MEMBER_ID = 'member-1';

describe('effectiveRateMinor (pure resolver)', () => {
  it('uses the family default when the child has no override', () => {
    expect(effectiveRateMinor({ stickerRateMinor: null }, { stickerRateMinor: 50 })).toBe(50);
  });
  it('uses the family default when the child override is undefined', () => {
    expect(effectiveRateMinor({ stickerRateMinor: undefined }, { stickerRateMinor: 50 })).toBe(50);
  });
  it("uses the child's own override when set, even to 0", () => {
    expect(effectiveRateMinor({ stickerRateMinor: 75 }, { stickerRateMinor: 50 })).toBe(75);
    expect(effectiveRateMinor({ stickerRateMinor: 0 }, { stickerRateMinor: 50 })).toBe(0);
  });
  it('DEFAULT_STICKER_RATE_MINOR matches the legacy fixed 0.5 rate', () => {
    expect(DEFAULT_STICKER_RATE_MINOR).toBe(50);
  });
});

describe('rateMinorToDecimal / moneyMinorFromStickers', () => {
  it('converts minor units to a decimal currency amount', () => {
    expect(rateMinorToDecimal(50)).toBe(0.5);
    expect(rateMinorToDecimal(0)).toBe(0);
    expect(rateMinorToDecimal(199)).toBeCloseTo(1.99);
  });
  it('computes stickers × rate in integer minor units (no floats)', () => {
    expect(moneyMinorFromStickers(4, 50)).toBe(200); // 4 stars at $0.50 = $2.00 = 200 minor units
    expect(moneyMinorFromStickers(0, 50)).toBe(0);
    expect(moneyMinorFromStickers(7, 199)).toBe(1393);
  });
});

describe('formatMinor', () => {
  it('formats an integer minor amount as the given currency', () => {
    expect(formatMinor(150, 'USD')).toMatch(/1\.50/);
    expect(formatMinor(0, 'AED')).toMatch(/0\.00/);
  });
  it('falls back to a plain decimal string for an invalid currency code', () => {
    expect(formatMinor(150, 'NOTACODE')).toBe('NOTACODE 1.50');
  });
});

describe('BOOST_PRESETS', () => {
  it('exposes the three UI presets', () => {
    expect(BOOST_PRESETS).toEqual([2, 3, 5]);
  });
});

// ── applySkipPenalties / reverseSkipPenalties ────────────────────────────────
//
// Fake `tx`: select() returns a thenable chain resolving to the next queued
// result set (mirrors the pattern used across the rest of the test suite);
// insert()/update()/delete() are spies that record their arguments.

function fakeTx(selectQueue: unknown[][]) {
  const inserted: Array<{ table: unknown; values: unknown }> = [];
  const updated: Array<{ table: unknown; set: unknown }> = [];
  const deleted: Array<{ table: unknown }> = [];
  let call = 0;
  const chain = (): unknown => {
    const rows = selectQueue[call++] ?? [];
    const obj: Record<string, unknown> = {
      from: () => obj,
      where: () => obj,
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return obj;
  };
  const tx = {
    select: vi.fn(() => chain()),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserted.push({ table, values });
        return Promise.resolve(undefined);
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (set: unknown) => {
        updated.push({ table, set });
        return { where: () => Promise.resolve(undefined) };
      },
    })),
    delete: vi.fn((table: unknown) => ({
      where: () => {
        deleted.push({ table });
        return Promise.resolve(undefined);
      },
    })),
  };
  return { tx, inserted, updated, deleted };
}

describe('applySkipPenalties — skip-penalty accrual at close-week', () => {
  const WEEK = { id: 'week-1', startDate: '2026-06-15' }; // Monday

  it('does nothing when the child has no habits with a skip penalty', async () => {
    const { tx, inserted, updated } = fakeTx([[]]); // habits query → empty
    const result = await applySkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    expect(result).toEqual({ totalPenaltyMinor: 0, adjustmentsInserted: 0 });
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it('penalises every one of the 7 days when NO sticker was placed all week', async () => {
    const { tx, inserted, updated } = fakeTx([
      [{ id: 'habit-1', skipPenaltyMinor: 25 }], // habits with a penalty
      [], // no stickers placed this week for this habit
    ]);
    const result = await applySkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    expect(result.totalPenaltyMinor).toBe(7 * 25); // 175
    expect(result.adjustmentsInserted).toBe(7);
    expect(inserted).toHaveLength(1);
    const rows = inserted[0]!.values as Array<{ day: string; amountMinor: number; reason: string }>;
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.amountMinor === -25)).toBe(true);
    expect(rows.every((r) => r.reason === 'skip')).toBe(true);
    // Days map onto the week's actual calendar dates (Mon 15th .. Sun 21st).
    expect(rows.map((r) => r.day)).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
      '2026-06-18',
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
    ]);
    expect(updated).toHaveLength(1); // saved_cash was decremented once
  });

  it('only penalises days that are actually missing a sticker', async () => {
    const { tx, inserted } = fakeTx([
      [{ id: 'habit-1', skipPenaltyMinor: 25 }],
      [
        { habitId: 'habit-1', day: 0 },
        { habitId: 'habit-1', day: 1 },
        { habitId: 'habit-1', day: 3 },
      ], // days 0,1,3 done → days 2,4,5,6 missed
    ]);
    const result = await applySkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    expect(result.adjustmentsInserted).toBe(4);
    expect(result.totalPenaltyMinor).toBe(4 * 25);
    const rows = inserted[0]!.values as Array<{ day: string }>;
    expect(rows.map((r) => r.day)).toEqual([
      '2026-06-17',
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
    ]);
  });

  it('a habit with zero missed days (perfect week) accrues no penalty', async () => {
    const allDays = Array.from({ length: 7 }, (_, day) => ({ habitId: 'habit-1', day }));
    const { tx, inserted, updated } = fakeTx([[{ id: 'habit-1', skipPenaltyMinor: 25 }], allDays]);
    const result = await applySkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    expect(result).toEqual({ totalPenaltyMinor: 0, adjustmentsInserted: 0 });
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it('sums penalties across multiple habits independently', async () => {
    const { tx, inserted } = fakeTx([
      [
        { id: 'habit-1', skipPenaltyMinor: 10 },
        { id: 'habit-2', skipPenaltyMinor: 50 },
      ],
      [
        { habitId: 'habit-1', day: 0 }, // habit-1: 6 days missed
        { habitId: 'habit-2', day: 0 },
        { habitId: 'habit-2', day: 1 }, // habit-2: 5 days missed
      ],
    ]);
    const result = await applySkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    // habit-1: 6 * 10 = 60. habit-2: 5 * 50 = 250. Total = 310.
    expect(result.totalPenaltyMinor).toBe(310);
    expect(result.adjustmentsInserted).toBe(11);
    expect(inserted).toHaveLength(1); // one batched insert for both habits
  });

  it('never inserts a positive amountMinor — a penalty row is always negative', async () => {
    const { tx, inserted } = fakeTx([[{ id: 'habit-1', skipPenaltyMinor: 30 }], []]);
    await applySkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    const rows = inserted[0]!.values as Array<{ amountMinor: number }>;
    expect(rows.every((r) => r.amountMinor < 0)).toBe(true);
  });
});

describe('reverseSkipPenalties — reopen/repair undoes the accrual', () => {
  const WEEK = { startDate: '2026-06-15' };

  it('does nothing when no penalty rows exist for the week', async () => {
    const { tx, deleted, updated } = fakeTx([[]]);
    const result = await reverseSkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    expect(result).toEqual({ totalReversedMinor: 0, rowsDeleted: 0 });
    expect(deleted).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });

  it('deletes every matching adjustment and restores the total to saved_cash', async () => {
    const { tx, deleted, updated } = fakeTx([
      [
        { id: 'adj-1', amountMinor: -25 },
        { id: 'adj-2', amountMinor: -25 },
        { id: 'adj-3', amountMinor: -50 },
      ],
    ]);
    const result = await reverseSkipPenalties(tx as never, TENANT_ID, MEMBER_ID, WEEK);
    expect(result.totalReversedMinor).toBe(100); // 25+25+50
    expect(result.rowsDeleted).toBe(3);
    expect(deleted).toHaveLength(3); // one delete per row
    expect(updated).toHaveLength(1); // one saved_cash restore
  });
});

describe('sumAdjustmentsMinor', () => {
  it('sums every adjustment row for the member (negative = net penalised)', async () => {
    const { tx } = fakeTx([[{ amountMinor: -25 }, { amountMinor: -50 }, { amountMinor: 10 }]]);
    const total = await sumAdjustmentsMinor(tx as never, TENANT_ID, MEMBER_ID);
    expect(total).toBe(-65);
  });
  it('returns 0 for a member with no adjustments', async () => {
    const { tx } = fakeTx([[]]);
    const total = await sumAdjustmentsMinor(tx as never, TENANT_ID, MEMBER_ID);
    expect(total).toBe(0);
  });
});
