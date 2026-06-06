// Canonical in-memory app config model (D-01) — the shape Phase 4's form fills and
// the request-builder (Plan 02) reads. These are hand-written, pure contract types:
// this module imports NOTHING (no `three`, no React, no IO) so it is safe to import
// from anywhere, preserving the code-split discipline (the lazy /result chunk gate).
// The runtime zod mirror of these types lives in src/features/config/schema.ts (the
// form/restore boundary); this module stays type-only.
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
  /**
   * Gate for `maxOverhang`: when false (the default) the UI zeroes + disables the overhang
   * field so the pallet permits no overhang; when true the user may set a positive value.
   * Mirrors the box-type `fragile` ↔ `maxLoad` interaction. Collected + persisted; the
   * numeric `maxOverhang` is what reaches the API.
   */
  allowOverhang: boolean;
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
  /**
   * User-facing display name for this box type (D-08), distinct from the builder slug
   * `id`. Shown in the catalog UI and persisted; collected from the user, NOT sent to
   * the API in v1.
   */
  label: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  quantity: number;
  /**
   * Maximum load that may rest on top of this box, in kg (D-08). `0` when the box is
   * `fragile`. Collected, persisted, and displayed, but NOT sent to the API in v1.
   */
  maxLoad: number;
  /**
   * Fragile flag (D-08): when true, nothing may be stacked on top (and `maxLoad` is 0).
   * Collected, persisted, and displayed, but NOT sent to the API in v1.
   */
  fragile: boolean;
  rotation: RotationMode;
}

/**
 * The full app config model. There are NO user-facing packing-option fields: the API
 * options (`max_pallets`, `time_budget_s`, `seed`, `support_ratio`) are all derived /
 * baked in the request-builder (D-03, Plan 02) — `max_pallets` is set to the box count so
 * the solver is never artificially capped, not surfaced as a user control.
 */
export interface PackConfig {
  pallet: PalletConfig;
  boxTypes: BoxType[];
}
