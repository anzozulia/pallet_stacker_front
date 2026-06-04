// Live unit/weight tally for the catalog footer + large-job advisory (BOX-05 / D-03). Pure,
// IO-free, jsdom-testable: this module imports NOTHING at runtime (no `three`, no React, no
// IO) so it stays outside the lazy /result chunk and never threatens the code-split build gate.
//
// NaN-safety: a half-typed quantity/weight field is mid-edit `NaN`/non-finite — coerce it to
// 0 so the footer never renders `NaN` (the correct soft behaviour during editing, D-04).

import type { BoxType } from '@/types/config';

/**
 * The large-job advisory threshold (D-03): jobs whose expanded unit count is STRICTLY greater
 * than this surface a "large job" warning. Single tunable named constant, mirroring the
 * `BAKED_OPTIONS` named-constant convention in request-builder.ts.
 */
export const LARGE_UNIT_THRESHOLD = 1000;

/** Footer tally: distinct box types, total expanded units, estimated kg, large-job flag. */
export interface CatalogTally {
  types: number;
  units: number;
  estKg: number;
  overThreshold: boolean;
}

/**
 * Reduce a catalog to its live tally. Reads only `quantity` + `weight` (Pick) so the form's
 * `useWatch` may pass partial rows. Non-finite quantity/weight (mid-edit `NaN`/`undefined`)
 * coerce to 0 so the result is never `NaN`. `estKg` is rounded; `overThreshold` is strictly
 * `units > LARGE_UNIT_THRESHOLD`.
 */
export function tallyCatalog(boxTypes: Pick<BoxType, 'quantity' | 'weight'>[]): CatalogTally {
  let units = 0;
  let estKg = 0;
  for (const b of boxTypes) {
    const q = Number.isFinite(b.quantity) ? b.quantity : 0;
    const w = Number.isFinite(b.weight) ? b.weight : 0;
    units += q;
    estKg += q * w;
  }
  return {
    types: boxTypes.length,
    units,
    estKg: Math.round(estKg),
    overThreshold: units > LARGE_UNIT_THRESHOLD,
  };
}
