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
 * The 3 vetted demo presets, in display order. Each demonstrates NON-OBVIOUS optimal
 * packing — multiple footprints interlocking to near-zero waste, not trivial uniform
 * grids. The fixed pallet (1200×800×1800 / 1000 kg / no overhang) is applied by
 * `buildPresetConfig`; these templates carry only the box rows. All verified clean
 * against the live API (0 unpacked, support 1.0, single LWH orientation, no overhang).
 */
export const DEMO_PRESETS: DemoPreset[] = [
  {
    name: 'Large unit + accessory fillers',
    description:
      'A big appliance carton whose leftover strip and corners are filled by two smaller box sizes — three footprints interlocking to near-zero waste.',
    boxTypes: [
      boxRow('Appliance carton', 600, 500, 450, 18, 16),
      boxRow('Accessory box', 300, 200, 450, 5, 24),
      boxRow('Corner filler', 200, 200, 450, 3, 24),
    ],
  },
  {
    name: 'Long crates + spacer cartons',
    description:
      'Long crates that only fit when each is paired with a short carton — 900 + 300 mm makes the full 1200 mm row. Four tightly-packed pallets.',
    boxTypes: [
      boxRow('Long crate', 900, 400, 450, 22, 32),
      boxRow('Spacer carton', 300, 400, 450, 8, 32),
    ],
  },
  {
    name: 'Flat-pack panels — wide + narrow',
    description:
      'Full-length panels in two widths that pair across the deck — 500 + 300 mm spans the 800 mm width. Three pallets, every layer a perfect fit.',
    boxTypes: [
      boxRow('Wide panel', 1200, 500, 450, 28, 12),
      boxRow('Narrow panel', 1200, 300, 450, 17, 12),
    ],
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
