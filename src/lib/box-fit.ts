// Conservative box-fits-pallet feasibility check (D-01 / BOX-06). Pure, coordinate-free,
// jsdom-testable: this module imports NOTHING at runtime (no `three`, no React, no IO) so
// it stays outside the lazy /result chunk and never threatens the code-split build gate.
//
// "Fits" = at least one allowed orientation has its footprint within the pallet L×W (plus
// `maxOverhang`, either box axis may align with either pallet axis) AND its up-axis extent
// is ≤ the pallet height. Conservative principle: when in doubt, ALLOW — only reject the
// genuinely-impossible (e.g. a 2000mm box on an 800mm pallet). The solver stays authoritative.

import type { BoxType, PalletConfig, RotationMode } from '@/types/config';

/** A candidate placement: the two footprint extents on the deck + the up-axis extent. */
interface Orientation {
  footA: number;
  footB: number;
  up: number;
}

/**
 * Enumerate the allowed `[footA, footB, up]` orientations for a box given its rotation
 * mode (BOX-04). The `switch` ends with a `never` default so adding a RotationMode without
 * an orientation rule becomes a compile error (total-coverage discipline).
 */
export function orientationsFor(
  b: Pick<BoxType, 'length' | 'width' | 'height' | 'rotation'>,
): Orientation[] {
  const { length: L, width: W, height: H } = b;
  const rotation: RotationMode = b.rotation;
  switch (rotation) {
    case 'fixed': // exact L/W/H, no rotation. Footprint L×W, up = H.
      return [{ footA: L, footB: W, up: H }];
    case 'uprightOnly': // height fixed (H up); base may turn 90° → footprintFits covers the swap.
      return [{ footA: L, footB: W, up: H }];
    case 'free': // any of the 3 axes may point up; the footprint is the other two.
      return [
        { footA: L, footB: W, up: H },
        { footA: L, footB: H, up: W },
        { footA: W, footB: H, up: L },
      ];
    default: {
      const _exhaustive: never = rotation;
      return _exhaustive;
    }
  }
}

/** A footprint fits the deck (with overhang) if it fits in either axis alignment. */
function footprintFits(a: number, b: number, pL: number, pW: number, overhang: number): boolean {
  const maxL = pL + overhang;
  const maxW = pW + overhang;
  return (a <= maxL && b <= maxW) || (a <= maxW && b <= maxL);
}

/** One unfittable box type: its catalog `index`, builder `id`, and the UI-SPEC message. */
export interface FitFailure {
  index: number;
  id: string;
  message: string;
}

/** Aggregate verdict: `ok` is true iff every box type fits (no `failures`). */
export interface FitResult {
  ok: boolean;
  failures: FitFailure[];
}

/**
 * Conservative D-01 hard-block check: returns the per-box-type failures (with `{index, id,
 * message}`) for every box that cannot fit the pallet in ANY allowed orientation, respecting
 * rotation mode, `maxOverhang`, and the max stack height. `ok` is true iff there are none.
 * Non-mutating; pure.
 */
export function checkAllBoxesFit(config: { pallet: PalletConfig; boxTypes: BoxType[] }): FitResult {
  const { pallet } = config;
  const failures: FitFailure[] = [];
  config.boxTypes.forEach((b, index) => {
    const fits = orientationsFor(b).some(
      (o) =>
        o.up <= pallet.height &&
        footprintFits(o.footA, o.footB, pallet.length, pallet.width, pallet.maxOverhang),
    );
    if (!fits) {
      failures.push({
        index,
        id: b.id,
        message: `"${b.label}" cannot fit the pallet in any allowed orientation`,
      });
    }
  });
  return { ok: failures.length === 0, failures };
}
