// The POST /api/v1/pack request contract (NEW) plus the consolidated `done`-response
// contract (MOVED verbatim from src/lib/fixture-types.ts per D-02). These are pure,
// hand-written contract types: this module imports NOTHING runtime (no `three`, no
// React, no IO) so it is safe to import anywhere, preserving code-split discipline.
// No zod this phase (D-04) — runtime validation lives at Phase 5's network boundary.
//
// Response-side field semantics (the locked Phase-2 risk resolution): `position` is
// the box MIN CORNER in API z-up mm space; `dimensions` is POST-orientation extents;
// `orientation.perm` is a diagnostic scatter index already baked into `dimensions`
// (do NOT re-apply). NOTE: the per-pallet box array key is `items` (NOT `placements`).

// ---------------------------------------------------------------------------
// Request side (NEW) — API snake_case, derived from the captured pack-request.json.
// ---------------------------------------------------------------------------

/**
 * Packing options sent in POST /api/v1/pack. Only `max_pallets` is user-facing
 * (PACK-03 / D-03); `time_budget_s`, `seed`, `support_ratio` are baked by the
 * request-builder (Plan 02) but are still part of the sent contract.
 */
export interface PackOptions {
  max_pallets: number;
  time_budget_s: number;
  seed: number;
  support_ratio: number;
}

/**
 * One individual box in the request (after per-type quantity expansion, PACK-02).
 * `rotations` is the API's closed string union (VERIFIED from pack-request.json
 * values) — the target of the Plan-02 RotationMode → API rotation table.
 */
export interface BoxRequest {
  id: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  rotations: 'all' | 'this_side_up' | 'none';
}

/**
 * The full POST /api/v1/pack request body. Pallet keys are API snake_case
 * (`max_weight`, `max_overhang`); the request-builder maps the camelCase
 * PalletConfig (src/types/config.ts) onto this shape in Plan 02.
 */
export interface PackRequest {
  boxes: BoxRequest[];
  pallet: {
    length: number;
    width: number;
    height: number;
    max_weight: number;
    max_overhang: number;
  };
  options: PackOptions;
}

// ---------------------------------------------------------------------------
// Response side (MOVED verbatim from src/lib/fixture-types.ts — locked Phase-2
// semantics, field names unchanged). See module header for field semantics.
// ---------------------------------------------------------------------------

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoxDims {
  L: number;
  W: number;
  H: number;
}

export interface PalletDims {
  L: number;
  W: number;
  H: number;
  max_weight: number;
}

export interface Orientation {
  perm: [number, number, number];
  name: string;
}

export interface PlacementOut {
  item_id: string;
  position: Vec3;
  dimensions: BoxDims;
  orientation: Orientation;
  weight: number;
  support_ratio: number;
  supported_by: string[];
  supports: string[];
}

export interface Cog {
  x: number;
  y: number;
  z: number;
}

export interface PalletResult {
  pallet_id: string;
  dimensions: PalletDims;
  utilisation: number;
  cog: Cog;
  total_weight: number;
  items: PlacementOut[];
}

export interface UnpackedItem {
  item_id: string;
  dimensions: BoxDims;
  weight: number;
  reason: string;
}

export interface InputSummary {
  items_packed: number;
  items_unpacked: number;
  pallets_used: number;
  total_volume_utilisation: number;
}

export interface DoneResult {
  input_summary: InputSummary;
  pallets: PalletResult[];
  unpacked_items: UnpackedItem[];
}

export interface DoneResponse {
  job_id: string;
  status: string;
  result: DoneResult;
}
