import { describe, expect, it } from 'vitest';
// Wiring copied from Hello.test.tsx: @/ alias proves resolution under Vitest,
// and this stays jsdom-WebGL-free (no Canvas / three import) — pure math only.
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/lib/fixture-types';
import { assertWithinEnvelope, mapPlacement, typeKeyOf } from '@/lib/mapping';

const pallet = { L: 1000, W: 800 }; // from fixture pallets[0].dimensions

describe('mapPlacement (golden, non-rotated)', () => {
  it('non-rotated box T000 (perm [0,1,2]) maps to exact captured size + centre', () => {
    const m = mapPlacement(
      { item_id: 'T000', position: { x: 0, y: 0, z: 0 }, dimensions: { L: 250, W: 250, H: 700 } },
      pallet,
      'T',
    );
    // Literal numbers (NOT re-derived from the formula) so a formula bug fails loudly.
    expect(m.size).toEqual([250, 700, 250]); // API L->x, H->y, W->z
    expect(m.center).toEqual([-375, 450, -275]);
    expect(m.id).toBe('T000');
    expect(m.typeKey).toBe('T');
  });
});

describe('mapPlacement (golden, rotated)', () => {
  // LOAD-BEARING PROOF: D003 has orientation.perm [2,0,1]. mapPlacement must use
  // the POST-orientation `dimensions` verbatim and must NOT re-apply perm. If perm
  // were (wrongly) re-applied, size would not be [150,300,600]. This single test
  // pins the resolution of the whole-product locked risk.
  it('rotated box D003 (perm [2,0,1], post-orientation dims, perm NOT applied)', () => {
    const m = mapPlacement(
      { item_id: 'D003', position: { x: 0, y: 0, z: 700 }, dimensions: { L: 150, W: 600, H: 300 } },
      pallet,
      'D',
    );
    expect(m.size).toEqual([150, 300, 600]); // placed dims verbatim, perm ignored
    expect(m.center).toEqual([-425, 950, -100]);
  });
});

describe('typeKeyOf', () => {
  it('extracts the leading non-digit prefix', () => {
    expect(typeKeyOf('T000')).toBe('T');
    expect(typeKeyOf('D003')).toBe('D');
    expect(typeKeyOf('F011')).toBe('F');
  });
});

describe('mapPlacement (AABB envelope)', () => {
  it('every pallet-0 box sits within the pallet envelope (0 violations)', () => {
    const data = doneResponse as DoneResponse;
    const pallet0 = data.result.pallets[0];
    const { L, W, H } = pallet0.dimensions;
    const eps = 1e-6;
    const violations = pallet0.items.filter((p) => {
      const { x, y, z } = p.position;
      const d = p.dimensions;
      return (
        x < -eps ||
        y < -eps ||
        z < -eps ||
        x + d.L > L + eps ||
        y + d.W > W + eps ||
        z + d.H > H + eps
      );
    });
    expect(violations).toEqual([]);
    // The dev-only assertion must not throw on valid geometry.
    expect(() =>
      pallet0.items.forEach((p) => assertWithinEnvelope(p, pallet0.dimensions)),
    ).not.toThrow();
  });
});
