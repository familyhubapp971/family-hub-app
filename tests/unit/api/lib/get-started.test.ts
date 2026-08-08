import { describe, it, expect } from 'vitest';
import { deriveGetStartedSteps } from '../../../../apps/api/src/lib/get-started';

// FHS-634: the guide used to tick a step when you tapped its button and keep
// that in the browser. These lock the replacement: a step is done when the
// family really has the thing.

const kid = (over: Partial<{ id: string; pinHash: string | null; hasHabit: boolean }> = {}) => ({
  id: 'k1',
  pinHash: null as string | null,
  hasHabit: false,
  ...over,
});

describe('deriveGetStartedSteps (FHS-634)', () => {
  it('an empty family has nothing done', () => {
    expect(deriveGetStartedSteps({ kids: [], stickerRateSetAt: null })).toEqual({
      kids: false,
      pins: false,
      rate: false,
      habits: false,
    });
  });

  it('one child is enough for the kids step', () => {
    const steps = deriveGetStartedSteps({ kids: [kid()], stickerRateSetAt: null });
    expect(steps.kids).toBe(true);
  });

  it('the PIN step needs EVERY kid to have one', () => {
    const someone = deriveGetStartedSteps({
      kids: [kid({ id: 'a', pinHash: 'hash' }), kid({ id: 'b', pinHash: null })],
      stickerRateSetAt: null,
    });
    expect(someone.pins).toBe(false);

    const everyone = deriveGetStartedSteps({
      kids: [kid({ id: 'a', pinHash: 'hash' }), kid({ id: 'b', pinHash: 'hash' })],
      stickerRateSetAt: null,
    });
    expect(everyone.pins).toBe(true);
  });

  it('an empty PIN hash does not count as a PIN', () => {
    const steps = deriveGetStartedSteps({
      kids: [kid({ pinHash: '' })],
      stickerRateSetAt: null,
    });
    expect(steps.pins).toBe(false);
  });

  it('a family with no kids at all has not done the PIN step', () => {
    // `[].every(...)` is true, which would have quietly ticked the step for a
    // family that has nobody to give a PIN to.
    expect(deriveGetStartedSteps({ kids: [], stickerRateSetAt: null }).pins).toBe(false);
  });

  it('the rate step follows when it was chosen, not what it is', () => {
    expect(deriveGetStartedSteps({ kids: [], stickerRateSetAt: null }).rate).toBe(false);
    expect(
      deriveGetStartedSteps({ kids: [], stickerRateSetAt: new Date('2026-08-08T00:00:00Z') }).rate,
    ).toBe(true);
  });

  it('one kid with a habit of their own is enough for the habits step', () => {
    expect(
      deriveGetStartedSteps({
        kids: [kid({ id: 'a', hasHabit: false }), kid({ id: 'b', hasHabit: true })],
        stickerRateSetAt: null,
      }).habits,
    ).toBe(true);
  });

  it('a fully set-up family has all four done', () => {
    expect(
      deriveGetStartedSteps({
        kids: [kid({ pinHash: 'hash', hasHabit: true })],
        stickerRateSetAt: new Date('2026-08-08T00:00:00Z'),
      }),
    ).toEqual({ kids: true, pins: true, rate: true, habits: true });
  });
});
