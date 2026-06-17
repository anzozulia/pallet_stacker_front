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
 * The 4 vetted demo presets, in display order. The fixed pallet (1200×800×1800 / 1000 kg /
 * no overhang) is applied by `buildPresetConfig`; these templates carry only the box rows.
 */
export const DEMO_PRESETS: DemoPreset[] = [
  {
    name: 'Office supply cartons',
    description: 'Two uniform square cartons that fill two pallets perfectly.',
    boxTypes: [
      boxRow('Paper-ream carton', 400, 400, 300, 10, 36),
      boxRow('File-storage box', 400, 400, 450, 14, 24),
    ],
  },
  {
    name: 'Distribution-centre mix',
    description: 'Three DC cartons, each cleanly fills its own pallet.',
    boxTypes: [
      boxRow('Master carton (tall)', 600, 400, 450, 20, 16),
      boxRow('Case box', 600, 400, 300, 15, 24),
      boxRow('Square tote', 400, 400, 300, 9, 36),
    ],
  },
  {
    name: 'Stationery & archive boxes',
    description: 'Two square cartons at volume → three tidy pallets.',
    boxTypes: [
      boxRow('Archive box', 400, 400, 300, 10, 48),
      boxRow('Catalogue box', 400, 400, 450, 14, 36),
    ],
  },
  {
    name: 'Wholesale grocery cases',
    description: 'Heavy cases + totes at volume → four full pallets.',
    boxTypes: [
      boxRow('Grocery case (heavy)', 600, 400, 300, 16, 48),
      boxRow('Produce tote', 400, 400, 300, 10, 72),
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
