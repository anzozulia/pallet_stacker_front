// Vetted demo box-catalog presets for the Configure page (one-click prefill). Each preset
// is a small set of box-type templates already validated against the live packing API
// (clean multi-pallet layouts, 0 unpacked, all rotation `uprightOnly`). The pallet
// envelope is FIXED for every preset — only the boxTypes vary.
//
// Units mirror src/types/config.ts: mm integers for dimensions/quantity, kg for weights.
// Imports ONLY nanoid + the model types — never three/r3f/drei or any viewer module, so
// this file rides the eager `/` chunk (code-split gate C-05), mirroring defaults.ts.
import { nanoid } from 'nanoid';
import type { BoxType, PackConfig } from '@/types/config';

/**
 * A demo preset: a human name + one-line description + a list of box-type templates
 * carrying every BoxType field EXCEPT `id` (the id is minted fresh per build, so a
 * preset can be picked repeatedly without sharing ids).
 */
export interface DemoPreset {
  name: string;
  description: string;
  boxTypes: Array<Omit<BoxType, 'id'>>;
}

// Shared box-type defaults for every preset row (mirrors makeDefaultBoxType): non-fragile,
// upright-only rotation, 90 kg top-load allowance.
function boxRow(
  label: string,
  length: number,
  width: number,
  height: number,
  weight: number,
  quantity: number,
): Omit<BoxType, 'id'> {
  return {
    label,
    length,
    width,
    height,
    weight,
    quantity,
    maxLoad: 90,
    fragile: false,
    rotation: 'uprightOnly',
  };
}

/**
 * The 3 vetted demo presets, in display order. Each is engineered so the solver MUST
 * rotate boxes 90° and interlock different footprints to fill the deck — producing the
 * "I'd never have packed it that way" effect, not a trivial uniform grid or an obvious
 * length/width pairing. The fixed pallet (1200×800×1800 / 1000 kg / no overhang) is
 * applied by `buildPresetConfig`; these templates carry only the box rows.
 *
 * All three were verified against the LIVE packing API (this_side_up / uprightOnly,
 * 0 unpacked, no overhang, full per-layer support, clean z-aligned layers):
 *   1. 900×500 unit + 300×400 + 300×300 fillers → 2 pallets, ~95%. The 300×400 filler
 *      YAWS (300×400 ↔ 400×300) to wrap both exposed faces of the big carton's L-gap.
 *      (1200−900 = 800−500 = 300, so one filler size fits the right strip AND the top.)
 *   2. 1000×600 slab + 200×400 + 200×200 → 2 pallets, 100%. Narrow filler yaws to frame
 *      the slab on the top edge (lying) and the right strip (standing); cube plugs the corner.
 *   3. 200×600 carton ×64 → 2 pallets, 100%. Each layer = six standing upright (200×600)
 *      + two laid crosswise (600×200) to cap the last 200 mm of width. A pure rotation fill.
 */
export const DEMO_PRESETS: DemoPreset[] = [
  {
    name: 'Large unit + nesting fillers',
    description:
      'A tall appliance carton parks in one corner; smaller boxes — some turned 90° — wrap its two open faces to fill the awkward L-shaped gap. ~95% full across 2 pallets.',
    boxTypes: [
      boxRow('Appliance carton', 900, 500, 450, 16, 8),
      boxRow('Accessory box', 300, 400, 450, 6, 16),
      boxRow('Filler cube', 300, 300, 450, 5, 20),
    ],
  },
  {
    name: 'Display slab + turned frame',
    description:
      'One big display carton per layer, then a narrow filler and a cube rotate to frame it along the top edge and the side strip. Packs 100% full on 2 pallets.',
    boxTypes: [
      boxRow('Display carton', 1000, 600, 450, 22, 8),
      boxRow('Edge filler', 200, 400, 450, 4, 16),
      boxRow('Corner cube', 200, 200, 450, 3, 40),
    ],
  },
  {
    name: 'Long cartons — six up, two crosswise',
    description:
      'A single long carton, sized so six stand upright and two lie crosswise to cap each row — a perfect interlock you would never pack by hand. 100% full, 2 pallets.',
    boxTypes: [boxRow('Profile carton', 200, 600, 450, 7, 64)],
  },
];

/**
 * Build a fresh, full `PackConfig` from a preset. Returns NEW object/array literals on every
 * call — the FIXED pallet envelope plus the preset's box rows, each given a freshly minted,
 * letter-prefixed unique id (`b${nanoid(8)}`, same scheme as makeDefaultBoxType so the
 * `b`-prefix keeps the typeKey/request ids valid). Not frozen — RHF owns/mutates after reset.
 */
export function buildPresetConfig(preset: DemoPreset): PackConfig {
  return {
    pallet: {
      length: 1200,
      width: 800,
      height: 1800,
      maxWeight: 1000,
      maxOverhang: 0,
      allowOverhang: false,
    },
    boxTypes: preset.boxTypes.map((t) => ({ id: `b${nanoid(8)}`, ...t })),
  };
}
