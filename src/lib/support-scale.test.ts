import { describe, expect, it } from 'vitest';
// Wiring copied from palette.test.ts / mapping.test.ts: @/ alias, jsdom-WebGL-free (pure
// colour logic, no 3D/IO). The fixture's support_ratio is uniformly 1.0 (Pitfall 4), so the
// ORDERING/DISTINCTNESS assertions use SYNTHETIC ratios — never the all-1.0 fixture.
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { supportColor } from '@/lib/support-scale';

const SYNTHETIC = [1.0, 0.8, 0.5, 0.2, 0] as const;

describe('supportColor (DIAG-02 — synthetic ordered scale, well-supported → low-support)', () => {
  it('returns a #rrggbb hex for every synthetic ratio', () => {
    for (const r of SYNTHETIC) {
      expect(supportColor(r)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('the well-supported top differs from the low-support bottom', () => {
    expect(supportColor(1.0)).not.toBe(supportColor(0));
  });

  it('the five synthetic inputs produce at least three distinct bucket colours', () => {
    const distinct = new Set(SYNTHETIC.map((r) => supportColor(r)));
    expect(distinct.size).toBeGreaterThanOrEqual(3);
  });

  it('clamps out-of-range input to the [0,1] endpoints', () => {
    expect(supportColor(2)).toBe(supportColor(1));
    expect(supportColor(-1)).toBe(supportColor(0));
  });

  it('smoke: every fixture box (support_ratio === 1) maps to the same top-bucket colour', () => {
    const view = doneResponse as DoneResponse;
    const colours = new Set<string>();
    for (const p of view.result.pallets) {
      for (const it of p.items) colours.add(supportColor(it.support_ratio));
    }
    expect(colours.size).toBe(1);
    expect([...colours][0]).toBe(supportColor(1.0));
  });
});
