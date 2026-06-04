// Canonical in-memory app config model (D-01) — the shape Phase 4's form fills and
// the request-builder (Plan 02) reads. These are hand-written, pure contract types:
// this module imports NOTHING (no `three`, no React, no IO) so it is safe to import
// from anywhere, preserving the code-split discipline (the lazy /result chunk gate).
// No zod this phase (D-04) — runtime validation lives at Phase 5's network boundary.
//
// Field convention: camelCase app-model fields in mm (dimensions, integers) / kg
// (weight). The request-builder (Plan 02) maps these to the API's snake_case
// (`max_weight`, `max_overhang`, etc.).

/**
 * Closed domain union of box rotation modes (D-05). `'free'` is the default (D-06).
 * The request-builder (Plan 02) maps these to the API's `rotations` string union
 * (`'all' | 'this_side_up' | 'none'`). Spelling is the planner's locked choice for
 * this phase.
 */
export type RotationMode = 'free' | 'uprightOnly' | 'fixed';

/**
 * Pallet envelope configuration. All fields are numbers in mm (dimensions) / kg
 * (weights), integers per PROJECT.md units. `maxWeight` / `maxOverhang` are
 * camelCase app-model fields mapped to the API's `max_weight` / `max_overhang`
 * (snake_case) by the request-builder in Plan 02.
 */
export interface PalletConfig {
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  maxOverhang: number;
}

/**
 * A box type in the catalog. Per-type dimensions (mm) + unit weight (kg) +
 * quantity to expand (PACK-02) + rotation mode (BOX-04).
 */
export interface BoxType {
  /**
   * Stable, builder-controlled slug used to construct individual item ids when
   * expanding `quantity` (distinct from any future user-facing label). It MUST be a
   * non-digit-leading slug so the `typeKeyOf` parse-fallback (leading non-digit
   * prefix, see mapping.ts) stays correct (Pitfall 3).
   */
  id: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  quantity: number;
  rotation: RotationMode;
}

/**
 * The full app config model. `maxPallets` is the single user-facing packing option
 * (PACK-03 / D-03). The other API options (`time_budget_s`, `seed`, `support_ratio`)
 * are intentionally NOT here — they are baked in the request-builder (D-03, Plan 02),
 * not user-facing.
 */
export interface PackConfig {
  pallet: PalletConfig;
  boxTypes: BoxType[];
  maxPallets: number;
}
