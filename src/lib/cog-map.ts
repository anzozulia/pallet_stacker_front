// Pure, IO-free CoG point-map: API centre-of-gravity POINT (z-up, mm) -> a single
// Three.js-space point for the CoG marker (DIAG-01). This is the riskiest NEW derivation
// this phase — same empirical discipline as the Phase-2 mapping risk.
//
// Empirically-confirmed axis convention (06-RESEARCH Pattern 2, weighted-centroid match):
//   - cog.x = API length  -> three x   (pallet recentred on origin: cog.x - L/2)
//   - cog.y = API width   -> three z   (recentred: cog.y - W/2)
//   - cog.z = API height (UP) -> three y (deck top + cog.z)
//
// CRITICAL: a CoG is ALREADY a centre point, so there is NO half-dimension term on the
// up-axis (unlike mapPlacement, which adds H/2 to lift a MIN-CORNER box to its centre).
// Do NOT route a cog through mapPlacement — it would add spurious L/2 / H/2 / W/2 offsets
// that are meant for min-corner placements, not for an already-centred point.
//
// Keep this module free of any runtime `three` import (type-only at most) so it stays
// outside the lazy /result chunk and does not threaten the code-split build gate (C-04).

import { DECK_TOP_Y } from './mapping';
import type { Cog, PalletDims } from '@/types/pack-contract';

/**
 * Map an API centre-of-gravity point into the shared Three.js scene space.
 * Returns `[cog.x - L/2, DECK_TOP_Y + cog.z, cog.y - W/2]` — up-axis is `cog.z`, with NO
 * half-dimension term (a CoG is already a centre). `DECK_TOP_Y` is shared with `mapPlacement`
 * so the marker and the boxes sit on one deck height.
 */
export function mapCog(cog: Cog, pallet: Pick<PalletDims, 'L' | 'W'>): [number, number, number] {
  return [cog.x - pallet.L / 2, DECK_TOP_Y + cog.z, cog.y - pallet.W / 2];
}
