// Live unit/weight tally for the catalog footer + large-job advisory (BOX-05 / D-03). Pure,
// IO-free, jsdom-testable: this module imports NOTHING at runtime (no `three`, no React, no
// IO) so it stays outside the lazy /result chunk and never threatens the code-split build gate.
//
// NaN-safety: a half-typed quantity/weight field is mid-edit `NaN`/non-finite — coerce it to
// 0 so the footer never renders `NaN` (the correct soft behaviour during editing, D-04).
//
// SINGLE-SOURCE-OF-TRUTH (#8 desync): RHF stores EDITED numeric `<input>` values as STRINGS on
// the form (e.g. `"25"`) — only the seeded defaults are real `number`s. The submit path coerces
// those strings to numbers (the zod schema / request-builder), so the BUILT request counts `"25"`
// as 25 units. This tally must coerce IDENTICALLY: a bare `Number.isFinite("25")` is `false`, which
// would silently drop every edited field to 0 and make the displayed counters disagree with what
// actually gets packed (the #5 stale-counter + #8 displayed-vs-submitted divergence). `toFiniteNumber`
// runs the SAME string→number coercion as the request builder so rows, badge, footer, and the built
// PackRequest are provably one source of truth.

import type { BoxType } from '@/types/config';

/**
 * Coerce a possibly-string form value (RHF leaves edited `<input>`s as strings) to a finite
 * number, matching the submit-path coercion (`Number(v)`); non-finite / blank → 0 so the tally
 * never renders `NaN` mid-edit. The lone coercion seam shared by units AND estKg.
 */
function toFiniteNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

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
    // Coerce string-or-number form values the SAME way the request builder does (#8): an edited
    // `"25"` counts as 25 units here AND in the built PackRequest — one source of truth.
    const q = toFiniteNumber(b.quantity);
    const w = toFiniteNumber(b.weight);
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
