// Pure, IO-free layer banding: group an API pallet's placements into horizontal LAYERS
// by their BASE height (position.z), floor-up. This is the single genuinely-new derivation
// of Phase 8 — the shared foundation the explode offsets, build-up / isolate visibility, the
// slider ranges, and the placement-row -> layer lookup (D-12) all consume.
//
// Empirical banding risk (same discipline as the Phase-2 mapping risk / cog-map.ts): a box is
// ALWAYS banded by its BASE (position.z), even when a tall box's TOP spans into the next band's
// base height (D-13 / Pitfall 2). LAYER_Z_TOLERANCE is a float-jitter absorber on a SHARED
// base-z — NOT a height bridge that would merge two genuinely-distinct bands. Verified against
// the integer-base fixture (P001 -> 2 bands [0,700]; P002 -> 4 bands [0,150,350,700]) and
// re-checked against the demo presets in the Wave-2 explode slice — do NOT silently change it here.
//
// Keep this module free of any runtime `three`/`r3f` import (type-only at most) so it stays
// outside the lazy /result chunk and does not threaten the code-split build gate (L-05), and so
// BOTH the visual offset in Boxes.tsx and the camera extra-height in ResultPage.tsx can import
// the SAME EXPLODE_FIXED_UNIT constant from here without pulling three into the eager chunk.

import type { PlacementOut } from '@/types/pack-contract';

/**
 * Float-jitter absorber (mm) on a SHARED base-z. Two boxes whose `position.z` differ by no more
 * than this are treated as the same band's floor; a gap LARGER than this starts a new band.
 * Verified against the integer-base fixture; re-checked against the Wave-2 demo presets.
 * This is a jitter tolerance, NOT a height bridge — do not inflate it to merge real bands.
 */
export const LAYER_Z_TOLERANCE = 5;

/**
 * The SINGLE source of truth (mm) for the per-layer explode lift unit (median fixture layer
 * height, RESEARCH Open-Q1). Living in this three-free lib module means BOTH the visual offset
 * in Boxes.tsx (Plan 02 Task 1) and the camera extra-height in ResultPage.tsx (Plan 02 Task 2)
 * import the SAME value — never a duplicated numeric literal that could drift. Plan 02 tunes the
 * magnitude HERE only (one place) if the exploded gap reads too small or too large.
 */
export const EXPLODE_FIXED_UNIT = 350;

/** One horizontal band of boxes, indexed floor-up from 0. */
export interface Layer {
  /** 0-based floor-up index (layer 0 is the bottom band). */
  index: number;
  /** Minimum `position.z` in the band (its floor). */
  baseZ: number;
  /** Maximum `position.z + dimensions.H` in the band (its ceiling). */
  topZ: number;
  /** The item ids that base in this band. */
  itemIds: string[];
}

/** The full banding result: ordered layers + a complete item-id -> layer-index lookup. */
export interface LayerModel {
  layers: Layer[];
  itemToLayer: Map<string, number>;
}

/**
 * Minimal structural input so a literal OR a full mapped placement both pass — mirrors
 * `PlacementLike` in mapping.ts. Only the base axis (`position.z`) and height (`dimensions.H`)
 * matter for banding.
 */
export type ItemLike = Pick<PlacementOut, 'item_id' | 'position' | 'dimensions'>;

/** Coerce a degenerate (NaN/non-finite) number to a safe fallback so banding never produces NaN. */
function safeNum(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Group placements into base-z bands, floor-up. Greedy from the floor: sort by base z ascending,
 * then start a NEW band when the next box's base exceeds the current band's base by more than
 * `LAYER_Z_TOLERANCE`, otherwise extend the current band (and grow its `topZ`).
 *
 * A box is always banded by its BASE — a tall box at z=0 whose top reaches the next band's floor
 * still belongs to band 0 (D-13). Degenerate (NaN) `position.z` / `dimensions.H` are coerced to
 * 0 so a malformed placement cannot poison the sort or produce NaN bands (T-08-DOS). Empty input
 * returns an empty model (guards the UI "No boxes" disabled state).
 */
export function computeLayers(items: ReadonlyArray<ItemLike>): LayerModel {
  const itemToLayer = new Map<string, number>();
  if (items.length === 0) {
    return { layers: [], itemToLayer };
  }

  // Copy + stable sort by base z ascending (NaN-coerced to 0 so the sort never goes degenerate).
  const sorted = items
    .map((it) => ({
      it,
      base: safeNum(it.position.z, 0),
      top: safeNum(it.position.z, 0) + safeNum(it.dimensions.H, 0),
    }))
    .sort((a, b) => a.base - b.base);

  const layers: Layer[] = [];
  for (const { it, base, top } of sorted) {
    const current = layers[layers.length - 1];
    if (current === undefined || base - current.baseZ > LAYER_Z_TOLERANCE) {
      // New band: this box's base is more than a jitter-tolerance above the current floor.
      const layer: Layer = {
        index: layers.length,
        baseZ: base,
        topZ: top,
        itemIds: [it.item_id],
      };
      layers.push(layer);
      itemToLayer.set(it.item_id, layer.index);
    } else {
      // Same band: add the box and extend the ceiling if this box reaches higher.
      current.itemIds.push(it.item_id);
      current.topZ = Math.max(current.topZ, top);
      itemToLayer.set(it.item_id, current.index);
    }
  }

  return { layers, itemToLayer };
}
