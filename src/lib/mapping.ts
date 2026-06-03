// Pure, IO-free coordinate mapping: API placement (z-up, mm, MIN-CORNER position)
// -> Three.js mesh transform (y-up, box-CENTRE). This is THE locked-risk module.
//
// Resolved empirically against the captured golden fixture (02-RESEARCH Pattern 1):
//   - `position` is the box MIN CORNER (occupies [x,x+L]x[y,y+W]x[z,z+H] in API space).
//   - `dimensions` is POST-orientation extents — already rotated by the packer.
//   - `orientation.perm` is a diagnostic scatter index ALREADY baked into `dimensions`;
//     re-applying it would double-rotate (Pitfall 2), so this module never reads perm.
//
// Axis convention: API x=length, y=width, z=height(up); Three.js x=right, y=up, z=toward
// camera. Hence size = [L, H, W] (API L->x, H->y, W->z) and the pallet is recentred on
// the world origin in x/z with the deck top at y=DECK_TOP_Y.
//
// Keep this module free of any runtime `three` import (type-only at most) so it stays
// outside the lazy /result chunk and does not threaten the code-split build gate (Pitfall 3).

import type { PalletDims, PlacementOut } from './fixture-types';

const DECK_TOP_Y = 100; // blockH 78 + deckH 22 (mockup pallet model); tunable

export interface MappedBox {
  id: string;
  typeKey: string;
  size: [number, number, number]; // three-space extents: [L, H, W]
  center: [number, number, number]; // three-space box-centre, y-up
}

// Minimal structural inputs so callers can pass a full PlacementOut or a literal.
type PlacementLike = Pick<PlacementOut, 'item_id' | 'position' | 'dimensions'>;
type PalletXZ = Pick<PalletDims, 'L' | 'W'>;

/**
 * Map one API placement into a Three.js mesh transform.
 * Consumes ONLY `position` + `dimensions` — `orientation.perm` is intentionally ignored.
 */
export function mapPlacement(p: PlacementLike, pallet: PalletXZ, typeKey: string): MappedBox {
  const { x, y, z } = p.position;
  const { L, W, H } = p.dimensions;
  return {
    id: p.item_id,
    typeKey,
    size: [L, H, W], // API L->x, H->y, W->z
    center: [
      x + L / 2 - pallet.L / 2, // x: box-centre, pallet recentred on origin
      DECK_TOP_Y + z + H / 2, // y (up): deck top + min-z + half-height
      y + W / 2 - pallet.W / 2, // z: API width axis, recentred
    ],
  };
}

/**
 * Extract the box-type key: the leading non-digit prefix of an item id.
 * e.g. `T000` -> `T`, `D003` -> `D`, `F011` -> `F`.
 */
export function typeKeyOf(itemId: string): string {
  const m = /^[^\d]+/.exec(itemId);
  return m ? m[0] : itemId;
}

/**
 * Dev-only AABB sanity assertion: each box's min-corner AABB must sit within the
 * pallet envelope [0,L]x[0,W]x[0,H] in API space (pre-recentre). Guarded by
 * import.meta.env.DEV so it tree-shakes out of the production build (Pattern 5).
 */
export function assertWithinEnvelope(p: PlacementLike, pallet: PalletDims): void {
  if (!import.meta.env.DEV) return; // stripped from prod
  const { x, y, z } = p.position;
  const { L, W, H } = p.dimensions;
  const eps = 1e-6;
  if (
    x < -eps ||
    y < -eps ||
    z < -eps ||
    x + L > pallet.L + eps ||
    y + W > pallet.W + eps ||
    z + H > pallet.H + eps
  ) {
    console.error('[AABB] box escapes pallet envelope', p.item_id, p.position, p.dimensions);
  }
}
