// Behaviour contract for the two config zod schemas (D-02 / Pitfall 4). jsdom-safe,
// pure (no WebGL/React). The strict submit schema enforces the D-02 business rules;
// the lenient shape schema is a structure/type-only restore guard.
import { describe, expect, test } from 'vitest';
import { packConfigShapeSchema, packConfigSubmitSchema } from './schema';
import { DEFAULT_CONFIG, makeDefaultBoxType } from './defaults';

function boxOverrides(overrides: Record<string, unknown>) {
  return {
    ...DEFAULT_CONFIG,
    boxTypes: [{ ...makeDefaultBoxType(), ...overrides }],
  };
}

describe('packConfigSubmitSchema (strict, D-02)', () => {
  test('accepts the EUR-shaped DEFAULT_CONFIG', () => {
    expect(packConfigSubmitSchema.safeParse(DEFAULT_CONFIG).success).toBe(true);
  });

  test('rejects an empty-string mm field before coercion (no ""→0)', () => {
    const result = packConfigSubmitSchema.safeParse(boxOverrides({ length: '' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('Required');
    }
  });

  test('rejects a zero mm dimension (positive int rule)', () => {
    expect(packConfigSubmitSchema.safeParse(boxOverrides({ length: 0 })).success).toBe(false);
  });

  test('rejects a non-integer mm dimension', () => {
    expect(packConfigSubmitSchema.safeParse(boxOverrides({ length: 1.5 })).success).toBe(false);
  });

  test('accepts a decimal kg weight', () => {
    expect(packConfigSubmitSchema.safeParse(boxOverrides({ weight: 1.5 })).success).toBe(true);
  });

  test('rejects an empty box catalog', () => {
    const result = packConfigSubmitSchema.safeParse({ ...DEFAULT_CONFIG, boxTypes: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('Add at least one box type');
    }
  });

  test('accepts maxLoad of 0 (fragile boxes carry no load)', () => {
    expect(packConfigSubmitSchema.safeParse(boxOverrides({ maxLoad: 0 })).success).toBe(true);
  });
});

describe('packConfigShapeSchema (lenient restore guard, Pitfall 4)', () => {
  test('accepts the DEFAULT_CONFIG', () => {
    expect(packConfigShapeSchema.safeParse(DEFAULT_CONFIG).success).toBe(true);
  });

  test('accepts a structurally-valid but business-invalid config (length: 0)', () => {
    expect(packConfigShapeSchema.safeParse(boxOverrides({ length: 0 })).success).toBe(true);
  });

  test('rejects a structurally-broken config (missing pallet)', () => {
    const { boxTypes, maxPallets } = DEFAULT_CONFIG;
    expect(packConfigShapeSchema.safeParse({ boxTypes, maxPallets }).success).toBe(false);
  });
});

describe('defaults (D-09 / C-06)', () => {
  test('makeDefaultBoxType id does not start with a digit', () => {
    expect(makeDefaultBoxType().id).not.toMatch(/^\d/);
  });

  test('two calls produce distinct ids', () => {
    expect(makeDefaultBoxType().id).not.toBe(makeDefaultBoxType().id);
  });

  test('returned box carries the extended BoxType fields', () => {
    const box = makeDefaultBoxType();
    expect(box).toHaveProperty('label');
    expect(box).toHaveProperty('maxLoad');
    expect(box).toHaveProperty('fragile');
  });
});
