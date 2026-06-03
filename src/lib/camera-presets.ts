// Pure, IO-free camera-preset math: derive ISO / TOP / FRONT camera vectors from
// the scene bounding box (D-11). These are computed from the FIXTURE's bbox, NOT
// the mockup's hardcoded camera vectors (design/result.html lines 341-343 used
// (1650,1300,1850) etc. tuned to a single 1200×800×1800 pallet) — so any real
// fixture frames correctly regardless of its dimensions (D-12 auto-fit).
//
// Keep this module free of any runtime `three`/`react` import so it stays
// jsdom-testable and outside the lazy /result chunk (preserves the code-split
// build gate, same discipline as mapping.ts / palette.ts).

export type Vec3Tuple = [number, number, number];

export interface Bbox {
  center: Vec3Tuple;
  size: Vec3Tuple; // full extents (max - min) per axis
}

export interface CameraPreset {
  position: Vec3Tuple;
  target: Vec3Tuple;
}

export type PresetKind = 'ISO' | 'TOP' | 'FRONT';

// Framing factor: how many bbox-radii back the camera sits. At the viewer's 45°
// fov the visible half-extent at distance d is ~0.414·d, so the bounding SPHERE
// (radius r) needs d ≳ r/0.414 ≈ 2.4r just to touch the frame edges. 2.6 leaves a
// comfortable margin around the whole scene (pallet + boxes) so nothing is clipped
// at the viewport edges in any preset. Tunable; scales the distance with the box.
const FRAMING_K = 2.6;

function radiusOf(size: Vec3Tuple): number {
  // Half the diagonal length of the bbox — a scale-invariant "size" of the scene.
  return Math.hypot(size[0], size[1], size[2]) / 2;
}

/**
 * Pure bbox -> camera vectors for a named preset.
 * `target` is always the bbox centre; `position` is offset by a distance that
 * scales with the bbox radius (never a hardcoded magic vector).
 *
 * - ISO:   elevated three-quarter view (positive on all of x, y, z).
 * - TOP:   directly above the centre, looking straight down (plan view).
 * - FRONT: offset primarily along +z at near-eye-level (axis-aligned elevation).
 */
export function presetFromBbox(bbox: Bbox, which: PresetKind): CameraPreset {
  const [cx, cy, cz] = bbox.center;
  const r = radiusOf(bbox.size);
  const d = r * FRAMING_K;
  const target: Vec3Tuple = [cx, cy, cz];

  if (which === 'TOP') {
    // Straight down: x≈cx, z≈cz (tiny epsilon avoids a degenerate look-direction),
    // y well above the centre.
    return { position: [cx, cy + d, cz + 1e-4], target };
  }

  if (which === 'FRONT') {
    // Axis-aligned elevation: offset mainly along +z, slightly above centre.
    return { position: [cx, cy + r * 0.25, cz + d], target };
  }

  // ISO: normalize(1, 0.8, 1.1) * d, positive on all three axes.
  const len = Math.hypot(1, 0.8, 1.1);
  const ux = 1 / len;
  const uy = 0.8 / len;
  const uz = 1.1 / len;
  return { position: [cx + ux * d, cy + uy * d, cz + uz * d], target };
}

/**
 * Orbit min/max zoom distances derived from the bbox radius (D-12 — not hardcoded).
 * Used by the viewer's OrbitControls in the scene.
 */
export function distanceLimitsFromBbox(bbox: Bbox): { minDistance: number; maxDistance: number } {
  const r = radiusOf(bbox.size);
  return { minDistance: r * 0.4, maxDistance: r * 4 };
}
