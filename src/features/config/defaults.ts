// Seed values the config form initialises from (D-09) and the factory for new catalog
// rows (C-06). `DEFAULT_CONFIG` is an EUR-pallet-shaped, business-valid PackConfig so a
// fresh load passes the strict submit schema; `makeDefaultBoxType()` mints a new box
// type with a letter-prefixed nanoid id (a digit/symbol lead would break the typeKeyOf
// parse-fallback — C-06 / Pitfall 5). Every field is seeded so RHF inputs stay
// controlled-from-birth (Pitfall 6).
//
// Units mirror src/types/config.ts: mm integers for dimensions/quantity, kg for weights.
// Imports nothing at runtime beyond nanoid; no three/React/IO. The `PackConfig` /
// `BoxType` type annotations keep these defaults in lockstep with the model.
import { nanoid } from 'nanoid';
import type { BoxType, PackConfig } from '@/types/config';

/**
 * Mint a new catalog box type with a unique, letter-prefixed id (C-06). Defaults mirror
 * the mockup's "Standard carton" seed (dims in mm, weight in kg) and a non-fragile
 * `free`-rotation box with a reasonable top-load allowance.
 *
 * `n` (default 1) sets the human label `Box type ${n}`. Callers number by ADDITIONS —
 * the catalog passes `fields.length + 1` so labels are not renumbered on removal — and
 * the seeded `DEFAULT_CONFIG` first type therefore reads `Box type 1`.
 */
export function makeDefaultBoxType(n: number = 1): BoxType {
  return {
    id: `b${nanoid(8)}`,
    label: `Box type ${n}`,
    length: 400,
    width: 300,
    height: 250,
    weight: 6.4,
    quantity: 10,
    maxLoad: 90,
    fragile: false,
    rotation: 'free',
  };
}

/**
 * EUR-pallet-shaped seed config (D-09): 1200×800 footprint, ~1800 mm stack height,
 * ~1000 kg / ~40 mm overhang limits, up to 2 pallets, and one default box type. Valid
 * against `packConfigSubmitSchema` on a fresh load.
 */
export const DEFAULT_CONFIG: PackConfig = {
  pallet: {
    length: 1200,
    width: 800,
    height: 1800,
    maxWeight: 1000,
    maxOverhang: 40,
  },
  boxTypes: [makeDefaultBoxType()],
  maxPallets: 2,
};
