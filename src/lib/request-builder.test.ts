import { describe, expect, it } from 'vitest';
// Wiring copied verbatim from mapping.test.ts / palette.test.ts: @/ alias proves
// resolution under Vitest, and this stays jsdom-WebGL-free (no WebGL surface, no 3D
// runtime) — pure transform logic only.
import packRequestFixture from '@/lib/__fixtures__/pack-request.json';
import { typeKeyOf } from '@/lib/mapping';
import { buildPackRequest, rotationToApi } from '@/lib/request-builder';
import type { PackConfig } from '@/types/config';

// Small synthetic input covering all three RotationMode values. Multi-letter typeIds
// (NOT the fixture's clean single letters) so determinism/uniqueness do not lean on the
// fixture's prefixes (RESEARCH Test Inputs corpus note). Still non-digit-leading so the
// typeKeyOf parse-FALLBACK channel stays correct (Pitfall 3).
const config: PackConfig = {
  pallet: {
    length: 1000,
    width: 800,
    height: 1000,
    maxWeight: 250,
    maxOverhang: 0,
    allowOverhang: false,
  },
  boxTypes: [
    {
      id: 'Da',
      label: 'Box A',
      length: 600,
      width: 300,
      height: 150,
      weight: 5.0,
      quantity: 3,
      maxLoad: 50,
      fragile: false,
      rotation: 'free',
    },
    {
      id: 'Tb',
      label: 'Box B',
      length: 250,
      width: 250,
      height: 700,
      weight: 7.0,
      quantity: 2,
      maxLoad: 30,
      fragile: false,
      rotation: 'uprightOnly',
    },
    {
      id: 'Fc',
      label: 'Box C',
      length: 350,
      width: 350,
      height: 350,
      weight: 9.0,
      quantity: 1,
      maxLoad: 0,
      fragile: true,
      rotation: 'fixed',
    },
  ],
};

describe('buildPackRequest (PACK-02 expansion)', () => {
  it('expands quantity into exactly N boxes per type', () => {
    const { request, idToType } = buildPackRequest(config);
    // 3 + 2 + 1 = 6 total expanded boxes.
    expect(request.boxes).toHaveLength(6);
    // Group via the PRIMARY recovery channel (idToType), not the typeKeyOf parse-fallback.
    const countOf = (typeId: string) =>
      request.boxes.filter((b) => idToType.get(b.id) === typeId).length;
    expect(countOf('Da')).toBe(3);
    expect(countOf('Tb')).toBe(2);
    expect(countOf('Fc')).toBe(1);
  });

  it('ids are unique across the whole boxes array (cross-type included)', () => {
    const { request } = buildPackRequest(config);
    const ids = request.boxes.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('emits deterministic golden ids (zero-based {typeId}-{index})', () => {
    const { request } = buildPackRequest(config);
    // Golden-literal assertion (NOT formula-derived) so an id-format regression fails loudly.
    expect(request.boxes.map((b) => b.id)).toEqual([
      'Da-0',
      'Da-1',
      'Da-2',
      'Tb-0',
      'Tb-1',
      'Fc-0',
    ]);
  });

  it('id format is parse-fallback-safe (non-digit-leading so typeKeyOf cannot mis-parse)', () => {
    const { request } = buildPackRequest(config);
    for (const box of request.boxes) {
      // Pitfall 3 guard: ids never start with a digit, so the typeKeyOf parse-FALLBACK
      // (leading non-digit prefix) never returns a digit-leading garbage key.
      expect(box.id[0]).not.toMatch(/\d/);
      expect(typeKeyOf(box.id)[0]).not.toMatch(/\d/);
    }
  });
});

describe('buildPackRequest (determinism, SC-1)', () => {
  it('is deterministic across rebuilds (byte-identical ids + idToType)', () => {
    const first = buildPackRequest(config);
    const second = buildPackRequest(config);
    expect(first.request.boxes.map((b) => b.id)).toEqual(second.request.boxes.map((b) => b.id));
    expect([...first.idToType.entries()]).toEqual([...second.idToType.entries()]);
  });
});

describe('buildPackRequest (idToType O(1) recovery, SC-1)', () => {
  it('round-trips every emitted id back to its originating typeId', () => {
    const { request, idToType } = buildPackRequest(config);
    expect(idToType.size).toBe(request.boxes.length);
    for (const box of request.boxes) {
      expect(idToType.get(box.id)).toBe(box.id.split('-')[0]);
    }
    expect(idToType.get('Da-0')).toBe('Da');
    expect(idToType.get('Tb-1')).toBe('Tb');
    expect(idToType.get('Fc-0')).toBe('Fc');
  });
});

describe('rotationToApi (BOX-04 / SC-2 total table)', () => {
  it('maps the 3 domain modes to exactly all/this_side_up/none', () => {
    expect(rotationToApi('free')).toBe('all');
    expect(rotationToApi('uprightOnly')).toBe('this_side_up');
    expect(rotationToApi('fixed')).toBe('none');
  });

  it('targets the 3 distinct API strings', () => {
    const targets = [rotationToApi('free'), rotationToApi('uprightOnly'), rotationToApi('fixed')];
    expect(new Set(targets).size).toBe(3);
  });

  it('applies the rotation table per box in the built request', () => {
    const { request, idToType } = buildPackRequest(config);
    const byType = (typeId: string) =>
      request.boxes.find((b) => idToType.get(b.id) === typeId)!.rotations;
    expect(byType('Da')).toBe('all');
    expect(byType('Tb')).toBe('this_side_up');
    expect(byType('Fc')).toBe('none');
  });
});

describe('buildPackRequest (options block, D-03)', () => {
  it('sends max_pallets = boxes.length (uncapped) plus baked time_budget_s/seed/support_ratio', () => {
    const { request } = buildPackRequest(config);
    // 3 + 2 + 1 = 6 expanded boxes → max_pallets is never an artificial cap.
    expect(request.options).toEqual({
      max_pallets: request.boxes.length,
      time_budget_s: 25,
      seed: 7,
      support_ratio: 0.8,
    });
    expect(request.options.max_pallets).toBe(6);
  });
});

describe('buildPackRequest (pallet field mapping)', () => {
  it('maps camelCase app pallet to API snake_case', () => {
    const { request } = buildPackRequest(config);
    expect(request.pallet).toEqual({
      length: 1000,
      width: 800,
      height: 1000,
      max_weight: 250,
      max_overhang: 0,
    });
  });
});

describe('buildPackRequest (fixture shape)', () => {
  it('a built BoxRequest has exactly the captured fixture box keys', () => {
    const { request } = buildPackRequest(config);
    const fixtureKeys = Object.keys(packRequestFixture.boxes[0]).sort();
    expect(Object.keys(request.boxes[0]).sort()).toEqual(fixtureKeys);
  });

  it('does not mutate the input config', () => {
    const snapshot = JSON.stringify(config);
    buildPackRequest(config);
    expect(JSON.stringify(config)).toBe(snapshot);
  });
});
