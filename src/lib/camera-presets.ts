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

export type Vec4Tuple = [number, number, number, number]; // quaternion [x, y, z, w]

const DEFAULT_UP: Vec3Tuple = [0, 1, 0];

function sub(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize3(v: Vec3Tuple): Vec3Tuple {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Pure look-rotation quaternion (#11): the camera ORIENTATION that looks from `position` toward
 * `target` with the given `up`, expressed as a unit quaternion `[x, y, z, w]`. Three-free so the
 * smooth-sweep orientation math stays jsdom-testable and outside the lazy /result chunk.
 *
 * Convention mirrors three's camera: it looks down its LOCAL -Z, with +Y up and +X right. We build
 * the orthonormal camera basis (right, trueUp, forward=+Z away from target) and convert that
 * rotation matrix to a quaternion. The TOP preset's straight-down look is non-degenerate because
 * presetFromBbox offsets z by a tiny epsilon, keeping the forward vector off-parallel to `up`.
 */
export function lookQuaternion(
  position: Vec3Tuple,
  target: Vec3Tuple,
  up: Vec3Tuple = DEFAULT_UP,
): Vec4Tuple {
  // three's camera local axes: it looks along -Z, so the basis +Z points AWAY from the target.
  const z = normalize3(sub(position, target)); // forward (+Z), away from target
  let x = cross(up, z); // right (+X)
  if (Math.hypot(x[0], x[1], x[2]) < 1e-6) {
    // up ∥ forward (degenerate) — pick an alternate up so the basis stays well-defined.
    const altUp: Vec3Tuple = Math.abs(z[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    x = cross(altUp, z);
  }
  x = normalize3(x);
  const y = cross(z, x); // true up (+Y), already unit (z, x orthonormal)

  // Rotation matrix columns = basis vectors → quaternion (Shepperd's method, the same branch
  // three.js Quaternion.setFromRotationMatrix uses).
  const m00 = x[0],
    m10 = x[1],
    m20 = x[2];
  const m01 = y[0],
    m11 = y[1],
    m21 = y[2];
  const m02 = z[0],
    m12 = z[1],
    m22 = z[2];
  const trace = m00 + m11 + m22;
  let qx: number, qy: number, qz: number, qw: number;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    qw = 0.25 / s;
    qx = (m21 - m12) * s;
    qy = (m02 - m20) * s;
    qz = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  return [qx / len, qy / len, qz / len, qw / len];
}

/**
 * Pure spherical-linear interpolation of two unit quaternions (#11). Used to sweep the camera
 * ORIENTATION smoothly across the eased k so the look-direction rotates uniformly — no
 * tilt-then-snap where a linear position lerp leaves the rotation to resolve abruptly at the end.
 * Falls back to nlerp for nearly-parallel quaternions (numerically safe).
 */
export function slerpQuat(a: Vec4Tuple, b: Vec4Tuple, t: number): Vec4Tuple {
  let bx = b[0],
    by = b[1],
    bz = b[2],
    bw = b[3];
  let cosHalf = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  // Take the shorter arc (q and -q are the same rotation).
  if (cosHalf < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cosHalf = -cosHalf;
  }
  if (cosHalf > 0.9995) {
    // Nearly parallel — linear interpolate + renormalise.
    const rx = a[0] + (bx - a[0]) * t;
    const ry = a[1] + (by - a[1]) * t;
    const rz = a[2] + (bz - a[2]) * t;
    const rw = a[3] + (bw - a[3]) * t;
    const len = Math.hypot(rx, ry, rz, rw) || 1;
    return [rx / len, ry / len, rz / len, rw / len];
  }
  const halfAngle = Math.acos(cosHalf);
  const sinHalf = Math.sqrt(1 - cosHalf * cosHalf);
  const ratioA = Math.sin((1 - t) * halfAngle) / sinHalf;
  const ratioB = Math.sin(t * halfAngle) / sinHalf;
  return [
    a[0] * ratioA + bx * ratioB,
    a[1] * ratioA + by * ratioB,
    a[2] * ratioA + bz * ratioB,
    a[3] * ratioA + bw * ratioB,
  ];
}

/** Angle (radians) between two unit quaternions — the rotational distance. Test helper + guard. */
export function quatAngle(a: Vec4Tuple, b: Vec4Tuple): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}

/** Convenience: the look-quaternion for a named preset given the bbox (#11). */
export function presetQuaternion(bbox: Bbox, which: PresetKind): Vec4Tuple {
  const { position, target } = presetFromBbox(bbox, which);
  return lookQuaternion(position, target);
}

/**
 * Orbit min/max zoom distances derived from the bbox radius (D-12 — not hardcoded).
 * Used by the viewer's OrbitControls in the scene.
 */
export function distanceLimitsFromBbox(bbox: Bbox): { minDistance: number; maxDistance: number } {
  const r = radiusOf(bbox.size);
  return { minDistance: r * 0.4, maxDistance: r * 4 };
}
