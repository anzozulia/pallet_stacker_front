// Pure, IO-free request builder: app-model PackConfig (camelCase, src/types/config.ts)
// -> POST /api/v1/pack request body (snake_case, src/types/pack-contract.ts), plus an
// idToType Map for O(1) type recovery (PACK-02 / SC-1). This module imports NOTHING at
// runtime (no `three`, no React, no IO, no random) so it stays outside the lazy /result
// chunk and never threatens the code-split build gate (SC-4).
//
// The `item_id` is the ONLY channel carrying type identity through the type-agnostic API
// (D-07). Ids MUST be unique and stable across rebuilds — so they are a deterministic
// `${typeId}-${index}` counter. NO random/UUID id source: random would break SC-1
// (stable-across-rebuilds), so it is deliberately and explicitly avoided here.

import type { PackConfig, RotationMode } from '@/types/config';
import type { BoxRequest, PackOptions, PackRequest } from '@/types/pack-contract';

/**
 * Baked packing options (D-03): NOT user-facing, but part of the sent contract.
 * Verified from the captured pack-request.json options block.
 */
export const BAKED_OPTIONS = { time_budget_s: 25, seed: 7, support_ratio: 0.8 } as const;

type ApiRotation = BoxRequest['rotations'];

/**
 * Total app RotationMode -> API rotation table (BOX-04 / SC-2). Typing it
 * `Record<RotationMode, ApiRotation>` makes `tsc -b` (run by `npm run build`) enforce
 * total coverage: adding a RotationMode without a mapping becomes a compile error.
 */
const ROTATION_TO_API: Record<RotationMode, ApiRotation> = {
  free: 'all',
  uprightOnly: 'this_side_up',
  fixed: 'none',
};

/** Map a domain rotation mode to its single API rotation string. */
export function rotationToApi(mode: RotationMode): ApiRotation {
  return ROTATION_TO_API[mode];
}

/** Deterministic, stable item id: `${typeId}-${index}` (zero-based; D-07). No random source. */
function makeItemId(typeId: string, index: number): string {
  return `${typeId}-${index}`;
}

export interface BuildResult {
  request: PackRequest;
  idToType: Map<string, string>;
}

/**
 * Build the POST /api/v1/pack request from an app PackConfig.
 * - Expands each box type's `quantity` into N individual boxes with unique stable ids (PACK-02).
 * - Returns an `idToType` Map for O(1), format-independent type recovery (SC-1).
 * - Maps camelCase pallet fields to API snake_case; bakes the non-user options (D-03).
 * Non-mutating: never assigns onto the input config.
 */
export function buildPackRequest(config: PackConfig): BuildResult {
  const idToType = new Map<string, string>();
  const boxes: BoxRequest[] = [];

  for (const boxType of config.boxTypes) {
    const rotations = rotationToApi(boxType.rotation);
    for (let index = 0; index < boxType.quantity; index += 1) {
      const id = makeItemId(boxType.id, index);
      idToType.set(id, boxType.id);
      boxes.push({
        id,
        length: boxType.length,
        width: boxType.width,
        height: boxType.height,
        weight: boxType.weight,
        rotations,
      });
    }
  }

  const options: PackOptions = {
    // max_pallets is no longer a user control: cap it at the box count. You never need more
    // pallets than boxes, so this is effectively unlimited — the solver is never artificially
    // capped while still satisfying the API's required field.
    max_pallets: boxes.length,
    ...BAKED_OPTIONS,
  };

  const request: PackRequest = {
    boxes,
    pallet: {
      length: config.pallet.length,
      width: config.pallet.width,
      height: config.pallet.height,
      max_weight: config.pallet.maxWeight,
      max_overhang: config.pallet.maxOverhang,
    },
    options,
  };

  return { request, idToType };
}
