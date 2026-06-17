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
  test('has exactly 4 entries', () => {
    expect(DEMO_PRESETS.length).toBe(4);
  });

  test('each preset has a name, description, and ≥1 box-type template', () => {
    for (const preset of DEMO_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.boxTypes.length).toBeGreaterThanOrEqual(1);
    }
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
