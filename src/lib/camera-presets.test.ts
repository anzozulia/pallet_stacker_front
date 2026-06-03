import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts: @/ alias proves resolution under Vitest,
// stays jsdom-WebGL-free (no Canvas / three import) — pure vector math only.
import { type Bbox, distanceLimitsFromBbox, presetFromBbox } from '@/lib/camera-presets';

// Synthetic, off-origin bbox so "target === centre" and per-axis offsets are
// unambiguous (centre is not [0,0,0]).
const bbox: Bbox = { center: [100, 200, 300], size: [400, 600, 800] };

function dist(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('presetFromBbox', () => {
  it('top-is-overhead: TOP looks straight down (x≈cx, z≈cz, y > cy)', () => {
    const { position, target } = presetFromBbox(bbox, 'TOP');
    expect(position[0]).toBeCloseTo(bbox.center[0]); // x ≈ cx
    expect(position[2]).toBeCloseTo(bbox.center[2]); // z ≈ cz
    expect(position[1]).toBeGreaterThan(bbox.center[1]); // y above centre
    expect(target).toEqual(bbox.center);
  });

  it('front-is-axis-aligned: FRONT offsets primarily along +z at near eye-level', () => {
    const { position, target } = presetFromBbox(bbox, 'FRONT');
    const dz = position[2] - bbox.center[2];
    const dy = position[1] - bbox.center[1];
    const dx = position[0] - bbox.center[0];
    expect(dz).toBeGreaterThan(0); // offset along +z
    expect(Math.abs(dx)).toBeLessThan(1e-6); // not offset along x
    expect(dz).toBeGreaterThan(dy); // primarily z, only slightly elevated
    expect(target).toEqual(bbox.center);
  });

  it('iso-is-elevated-3q: ISO offsets positively on all of x, y, z (three-quarter)', () => {
    const { position, target } = presetFromBbox(bbox, 'ISO');
    expect(position[0]).toBeGreaterThan(bbox.center[0]);
    expect(position[1]).toBeGreaterThan(bbox.center[1]);
    expect(position[2]).toBeGreaterThan(bbox.center[2]);
    expect(target).toEqual(bbox.center);
  });

  it('distance-scales-with-bbox: a 2× bbox yields proportionally larger camera distance', () => {
    const small: Bbox = { center: [0, 0, 0], size: [100, 100, 100] };
    const large: Bbox = { center: [0, 0, 0], size: [200, 200, 200] };
    for (const which of ['ISO', 'TOP', 'FRONT'] as const) {
      const dSmall = dist(presetFromBbox(small, which).position, small.center);
      const dLarge = dist(presetFromBbox(large, which).position, large.center);
      expect(dLarge).toBeGreaterThan(dSmall);
      // Doubling the bbox roughly doubles the camera distance (no hardcoded vector).
      expect(dLarge / dSmall).toBeCloseTo(2, 1);
      // target always equals the bbox centre
      expect(presetFromBbox(large, which).target).toEqual(large.center);
    }
  });
});

describe('distanceLimitsFromBbox', () => {
  it('derives min/max zoom from the bbox radius (min < max, scales with size)', () => {
    const small = distanceLimitsFromBbox({ center: [0, 0, 0], size: [100, 100, 100] });
    const large = distanceLimitsFromBbox({ center: [0, 0, 0], size: [200, 200, 200] });
    expect(small.minDistance).toBeLessThan(small.maxDistance);
    expect(large.minDistance).toBeGreaterThan(small.minDistance);
    expect(large.maxDistance).toBeGreaterThan(small.maxDistance);
  });
});
