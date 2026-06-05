import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts: @/ alias proves resolution under Vitest,
// stays jsdom-WebGL-free (no Canvas / three import) — pure vector math only.
import {
  type Bbox,
  type Vec4Tuple,
  distanceLimitsFromBbox,
  lookQuaternion,
  presetFromBbox,
  presetQuaternion,
  quatAngle,
  slerpQuat,
} from '@/lib/camera-presets';

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

describe('preset orientation interpolation (#11 smooth-sweep math)', () => {
  function isUnit(q: Vec4Tuple): boolean {
    return Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1) < 1e-6;
  }

  it('lookQuaternion returns a unit quaternion', () => {
    const q = lookQuaternion([100, 100, 100], [0, 0, 0]);
    expect(isUnit(q)).toBe(true);
  });

  it('ISO and TOP look-orientations differ (distinct framings rotate, not just translate)', () => {
    const iso = presetQuaternion(bbox, 'ISO');
    const top = presetQuaternion(bbox, 'TOP');
    expect(isUnit(iso)).toBe(true);
    expect(isUnit(top)).toBe(true);
    // The two presets look in clearly different directions — a real rotational gap to sweep.
    expect(quatAngle(iso, top)).toBeGreaterThan(0.3);
  });

  it('a slerped mid-point lies BETWEEN the two preset orientations (uniform sweep)', () => {
    const iso = presetQuaternion(bbox, 'ISO');
    const top = presetQuaternion(bbox, 'TOP');
    const total = quatAngle(iso, top);
    const mid = slerpQuat(iso, top, 0.5);
    expect(isUnit(mid)).toBe(true);
    const toMid = quatAngle(iso, mid);
    const fromMid = quatAngle(mid, top);
    // The midpoint is strictly between the endpoints …
    expect(toMid).toBeGreaterThan(1e-3);
    expect(fromMid).toBeGreaterThan(1e-3);
    expect(toMid).toBeLessThan(total);
    // … and a t=0.5 slerp bisects the arc evenly (the no-snap guarantee: the rotation is
    // distributed uniformly across the transition, not back-loaded).
    expect(toMid).toBeCloseTo(fromMid, 4);
    expect(toMid + fromMid).toBeCloseTo(total, 4);
  });

  it('slerp endpoints are exact (t=0 → from, t=1 → to)', () => {
    const iso = presetQuaternion(bbox, 'ISO');
    const front = presetQuaternion(bbox, 'FRONT');
    expect(quatAngle(slerpQuat(iso, front, 0), iso)).toBeLessThan(1e-6);
    expect(quatAngle(slerpQuat(iso, front, 1), front)).toBeLessThan(1e-6);
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
