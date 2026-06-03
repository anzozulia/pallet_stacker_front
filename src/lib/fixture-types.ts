// Hand-written TS interfaces typing the captured golden `done` response shape.
// zod is intentionally NOT used this phase (deferred to Phase 5's live client,
// where it validates GET /jobs/{id} at the trust boundary) — see 02-RESEARCH
// "Standard Stack". These types must be safe to import from anywhere, so this
// file imports nothing (no `three`, no React) to preserve code-split discipline.
// Field semantics (the locked-risk resolution): `position` is the box MIN CORNER
// in API z-up mm space; `dimensions` is POST-orientation extents; `orientation.perm`
// is a diagnostic scatter index already baked into `dimensions` (do NOT re-apply).
// NOTE: the per-pallet box array key is `items` (NOT `placements`).

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
