import { describe, expect, it } from 'vitest';
// Wiring mirrors request-builder.test.ts: the @/ alias proves resolution under Vitest,
// and this suite is pure (no jsdom / WebGL / localStorage mock needed) — the guard
// functions are IO-free by design, so we pass RAW strings straight in (Pitfall 4 / D-07).
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  deserializeConfigOrDefault,
  serializeConfig,
} from '@/lib/config-persist';
import { DEFAULT_CONFIG } from '@/features/config/defaults';

describe('config-persist constants (D-07)', () => {
  it('exports the versioned storage key', () => {
    expect(STORAGE_KEY).toBe('palletize:config:v1');
  });

  it('exports STORAGE_VERSION = 1', () => {
    expect(STORAGE_VERSION).toBe(1);
  });
});

describe('serializeConfig / deserializeConfigOrDefault round-trip (DATA-02 / D-07)', () => {
  it('round-trips a valid config: deserialize(serialize(x)) deep-equals x', () => {
    const raw = serializeConfig(DEFAULT_CONFIG);
    expect(deserializeConfigOrDefault(raw)).toEqual(DEFAULT_CONFIG);
  });

  it('serializes into the versioned envelope { version, config }', () => {
    const parsed = JSON.parse(serializeConfig(DEFAULT_CONFIG));
    expect(parsed).toEqual({ version: STORAGE_VERSION, config: DEFAULT_CONFIG });
  });
});

describe('deserializeConfigOrDefault never crash-loads untrusted storage (T-4-PERSIST / D-07)', () => {
  it('null → DEFAULT_CONFIG', () => {
    expect(deserializeConfigOrDefault(null)).toEqual(DEFAULT_CONFIG);
  });

  it('unparseable string → DEFAULT_CONFIG (never throws)', () => {
    expect(() => deserializeConfigOrDefault('not json{')).not.toThrow();
    expect(deserializeConfigOrDefault('not json{')).toEqual(DEFAULT_CONFIG);
  });

  it('non-object JSON (e.g. a bare number/string/array) → DEFAULT_CONFIG', () => {
    expect(deserializeConfigOrDefault('42')).toEqual(DEFAULT_CONFIG);
    expect(deserializeConfigOrDefault('"a string"')).toEqual(DEFAULT_CONFIG);
    expect(deserializeConfigOrDefault('[1,2,3]')).toEqual(DEFAULT_CONFIG);
    expect(deserializeConfigOrDefault('null')).toEqual(DEFAULT_CONFIG);
  });

  it('version mismatch → DEFAULT_CONFIG (discard-and-seed, no migrate yet)', () => {
    const blob = JSON.stringify({ version: 99, config: DEFAULT_CONFIG });
    expect(deserializeConfigOrDefault(blob)).toEqual(DEFAULT_CONFIG);
  });

  it('shape-invalid config (wrong types / missing keys) → DEFAULT_CONFIG', () => {
    const blob = JSON.stringify({ version: STORAGE_VERSION, config: { pallet: 'oops' } });
    expect(deserializeConfigOrDefault(blob)).toEqual(DEFAULT_CONFIG);
  });

  it('does not throw on any malformed input', () => {
    const malformed = [null, '', '{', '{"version":1}', '{"config":{}}', 'undefined', 'NaN'];
    for (const input of malformed) {
      expect(() => deserializeConfigOrDefault(input)).not.toThrow();
      expect(deserializeConfigOrDefault(input)).toEqual(DEFAULT_CONFIG);
    }
  });
});

describe('lenient guard restores incomplete-but-shaped drafts (Pitfall 4 / D-04 / SC-5)', () => {
  it('a structurally-valid but business-invalid draft (a box length set to 0) RESTORES, not defaults', () => {
    // Business-invalid (length 0 would fail the STRICT submit schema) but structurally
    // sound — must survive so an in-progress draft round-trips (lenient packConfigShapeSchema).
    const draft = {
      ...DEFAULT_CONFIG,
      boxTypes: [{ ...DEFAULT_CONFIG.boxTypes[0], length: 0 }],
    };
    const blob = JSON.stringify({ version: STORAGE_VERSION, config: draft });
    const restored = deserializeConfigOrDefault(blob);

    expect(restored).toEqual(draft);
    expect(restored).not.toEqual(DEFAULT_CONFIG);
    expect(restored.boxTypes[0].length).toBe(0);
  });
});
