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

  test('exposes the 3 interlocking-catalog presets in display order', () => {
    expect(DEMO_PRESETS.map((p) => p.name)).toEqual([
      'Large unit + accessory fillers',
      'Long crates + spacer cartons',
      'Flat-pack panels — wide + narrow',
    ]);
  });

  test('preset 1 — large unit + two filler footprints', () => {
    const preset = DEMO_PRESETS[0];
    expect(preset.boxTypes.map((b) => b.label)).toEqual([
      'Appliance carton',
      'Accessory box',
      'Corner filler',
    ]);
    const appliance = preset.boxTypes[0];
    expect([appliance.length, appliance.width, appliance.height]).toEqual([600, 500, 450]);
    expect([appliance.weight, appliance.quantity]).toEqual([18, 16]);
  });

  test('preset 2 — 900 + 300 mm length pairing', () => {
    const preset = DEMO_PRESETS[1];
    expect(preset.boxTypes.map((b) => b.label)).toEqual(['Long crate', 'Spacer carton']);
    const [crate, spacer] = preset.boxTypes;
    expect([crate.length, crate.width, crate.height]).toEqual([900, 400, 450]);
    expect([spacer.length, spacer.width, spacer.height]).toEqual([300, 400, 450]);
    expect(crate.length + spacer.length).toBe(1200);
  });

  test('preset 3 — 500 + 300 mm width pairing across full-length panels', () => {
    const preset = DEMO_PRESETS[2];
    expect(preset.boxTypes.map((b) => b.label)).toEqual(['Wide panel', 'Narrow panel']);
    const [wide, narrow] = preset.boxTypes;
    expect([wide.length, wide.width, wide.height]).toEqual([1200, 500, 450]);
    expect([narrow.length, narrow.width, narrow.height]).toEqual([1200, 300, 450]);
    expect(wide.width + narrow.width).toBe(800);
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
