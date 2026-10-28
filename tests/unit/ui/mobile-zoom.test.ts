// FHS-677 and FHR-20: phone screens must not zoom on tap and must fit the
// width. These are stylesheet rules, so the test reads the shared stylesheet
// and fails if a rule is removed.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = readFileSync(
  new URL('../../../packages/ui/src/styles/globals.css', import.meta.url),
  'utf8',
);

describe('phone zoom rules', () => {
  it('turns off double-tap zoom but not two-finger zoom', () => {
    expect(css).toMatch(/touch-action:\s*manipulation/);
    expect(css).not.toMatch(/user-scalable\s*=\s*no/);
  });

  it('stops the page getting wider than the screen', () => {
    expect(css).toMatch(/overflow-x:\s*clip/);
  });

  it('gives small text boxes 16px on touch screens so focusing them does not zoom', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*input\.text-sm[\s\S]*font-size:\s*16px/);
  });
});
