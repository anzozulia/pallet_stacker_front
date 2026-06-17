// Pure-logic test for the demo-preset data + builder (no React/jsdom). Asserts every
// preset builds a PackConfig that parses against the STRICT submit schema, carries the
// FIXED pallet envelope, mints fresh letter-prefixed unique ids per call, and keeps the
// uprightOnly / non-fragile / maxLoad-90 box defaults.
import { describe, expect, it, test } from 'vitest';
import { DEMO_PRESETS, buildPresetConfig } from '@/features/config/demo-presets';
import { packConfigSubmitSchema } from '@/features/config/schema';

const FIXED_PALLET = {
  length: 1200,
  width: 800,
  height: 1800,
  maxWeight: 1000,
  maxOverhang: 0,
  allowOverhang: false,
} as const;

describe('DEMO_PRESETS', () => {
  test('has exactly 3 entries', () => {
    expect(DEMO_PRESETS.length).toBe(3);
  });

  test('each preset has a name, description, and ≥1 box-type template', () => {
    for (const preset of DEMO_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.boxTypes.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('exposes the 3 rotation-interlock presets in display order', () => {
    expect(DEMO_PRESETS.map((p) => p.name)).toEqual([
      'Large unit + nesting fillers',
      'Display slab + turned frame',
      'Long cartons — six up, two crosswise',
    ]);
  });

  test('preset 1 — 900×500 unit + two yaw-wrapping filler footprints', () => {
    const preset = DEMO_PRESETS[0];
    expect(preset.boxTypes.map((b) => b.label)).toEqual([
      'Appliance carton',
      'Accessory box',
      'Filler cube',
    ]);
    const appliance = preset.boxTypes[0];
    expect([appliance.length, appliance.width, appliance.height]).toEqual([900, 500, 450]);
    expect([appliance.weight, appliance.quantity]).toEqual([16, 8]);
    // 1200−900 = 800−500 = 300: one filler size fits the right strip AND the top strip,
    // so the solver must yaw it 90° to wrap both exposed faces of the big carton.
    expect(1200 - appliance.length).toBe(800 - appliance.width);
  });

  test('preset 2 — 1000×600 slab framed by a turned filler + corner cube', () => {
    const preset = DEMO_PRESETS[1];
    expect(preset.boxTypes.map((b) => b.label)).toEqual([
      'Display carton',
      'Edge filler',
      'Corner cube',
    ]);
    const [slab, filler, cube] = preset.boxTypes;
    expect([slab.length, slab.width, slab.height]).toEqual([1000, 600, 450]);
    expect([filler.length, filler.width, filler.height]).toEqual([200, 400, 450]);
    expect([cube.length, cube.width, cube.height]).toEqual([200, 200, 450]);
  });

  test('preset 3 — single 200×600 carton, six upright + two crosswise per layer', () => {
    const preset = DEMO_PRESETS[2];
    expect(preset.boxTypes.map((b) => b.label)).toEqual(['Profile carton']);
    const [profile] = preset.boxTypes;
    expect([profile.length, profile.width, profile.height]).toEqual([200, 600, 450]);
    // Six standing (200 wide) span the 1200 length over 600 of width; two laid crosswise
    // (600 wide) cap the last 200 mm → a 100% rotation-only interlock.
    expect(profile.width + profile.length).toBe(800);
  });
});

describe('buildPresetConfig', () => {
  it.each(DEMO_PRESETS)('builds a config that parses the submit schema: $name', (preset) => {
    const config = buildPresetConfig(preset);
    const result = packConfigSubmitSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it.each(DEMO_PRESETS)('uses the FIXED pallet envelope: $name', (preset) => {
    const config = buildPresetConfig(preset);
    expect(config.pallet).toEqual(FIXED_PALLET);
  });

  it.each(DEMO_PRESETS)('mints non-empty, letter-prefixed, unique box ids: $name', (preset) => {
    const config = buildPresetConfig(preset);
    const ids = config.boxTypes.map((b) => b.id);
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0);
      expect(id).toMatch(/^[^\d]/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(DEMO_PRESETS)(
    'every box is uprightOnly, non-fragile, maxLoad 90, with matching length: $name',
    (preset) => {
      const config = buildPresetConfig(preset);
      expect(config.boxTypes.length).toBe(preset.boxTypes.length);
      for (const box of config.boxTypes) {
        expect(box.rotation).toBe('uprightOnly');
        expect(box.fragile).toBe(false);
        expect(box.maxLoad).toBe(90);
      }
    },
  );

  it.each(DEMO_PRESETS)('two successive calls yield disjoint id sets: $name', (preset) => {
    const a = buildPresetConfig(preset).boxTypes.map((b) => b.id);
    const b = buildPresetConfig(preset).boxTypes.map((b) => b.id);
    const overlap = a.filter((id) => b.includes(id));
    expect(overlap).toHaveLength(0);
  });
});
