import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts / config-tally.test.ts: @/ alias proves resolution
// under Vitest, jsdom-WebGL-free (pure aggregation, no 3D/IO surface). Golden literals are
// hand-stated (NOT re-derived from the formula) so a formula bug fails loudly.
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { mapDoneResponse } from '@/lib/result-mapper';
import { summarise } from '@/lib/result-summary';

const view = mapDoneResponse(doneResponse as DoneResponse);

describe('summarise (whole-job golden, RESULT-03 / D-03)', () => {
  it('aggregates the fixture to the golden whole-job totals', () => {
    const s = summarise(view);
    expect(s.palletsUsed).toBe(2);
    expect(s.utilisationPct).toBeCloseTo(72.81, 5); // 0.7281 × 100, raw product (no rounding here)
    expect(s.unpacked).toBe(7);
    expect(s.totalItems).toBe(38); // 31 packed + 7 unpacked
    expect(s.totalWeightKg).toBe(211); // Σ pallet totalWeight: 119 + 92
  });

  it('leaves maxPallets undefined when not supplied', () => {
    expect(summarise(view).maxPallets).toBeUndefined();
  });

  it('passes through an explicit maxPallets argument', () => {
    expect(summarise(view, 5).maxPallets).toBe(5);
  });
});
