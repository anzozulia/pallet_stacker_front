import { describe, expect, it } from 'vitest';
// Wiring copied from palette.test.ts / request-builder.test.ts: @/ alias, jsdom-WebGL-free
// (pure tally logic, no 3D/IO surface).
import { LARGE_UNIT_THRESHOLD, tallyCatalog } from '@/lib/config-tally';

// Minimal rows: tallyCatalog only reads quantity + weight (Pick), so cases pass just those.
function row(quantity: number, weight: number) {
  return { quantity, weight };
}

describe('tallyCatalog (BOX-05 / D-03)', () => {
  it('counts: 3 types 64/40/64 → types 3, units 168, estKg = round(Σ qty×weight)', () => {
    // 64×5 + 40×2.5 + 64×1.25 = 320 + 100 + 80 = 500
    const tally = tallyCatalog([row(64, 5), row(40, 2.5), row(64, 1.25)]);
    expect(tally).toEqual({ types: 3, units: 168, estKg: 500, overThreshold: false });
  });

  it('estKg rounds to the nearest integer', () => {
    // 3 × 1.1 = 3.3 → round → 3
    expect(tallyCatalog([row(3, 1.1)]).estKg).toBe(3);
    // 3 × 1.5 = 4.5 → round → 5 (Math.round half-up)
    expect(tallyCatalog([row(3, 1.5)]).estKg).toBe(5);
  });

  it('threshold is strictly greater-than: 1000 → false, 1001 → true', () => {
    expect(tallyCatalog([row(1000, 1)]).overThreshold).toBe(false);
    expect(tallyCatalog([row(1001, 1)]).overThreshold).toBe(true);
  });

  it('NaN-safety: a mid-edit NaN quantity/weight contributes 0, never producing NaN', () => {
    const tally = tallyCatalog([row(NaN, 5), row(10, NaN), row(2, 3)]);
    // NaN qty → 0 units, 0 kg; NaN weight → 10 units, 0 kg; valid → 2 units, 6 kg.
    expect(tally.units).toBe(12);
    expect(tally.estKg).toBe(6);
    expect(Number.isNaN(tally.units)).toBe(false);
    expect(Number.isNaN(tally.estKg)).toBe(false);
    expect(tally.types).toBe(3);
  });

  it('empty catalog → all zeros', () => {
    expect(tallyCatalog([])).toEqual({ types: 0, units: 0, estKg: 0, overThreshold: false });
  });
});

describe('LARGE_UNIT_THRESHOLD (D-03)', () => {
  it('is exported and equals 1000', () => {
    expect(LARGE_UNIT_THRESHOLD).toBe(1000);
  });
});
