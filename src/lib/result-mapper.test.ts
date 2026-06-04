import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts / palette.test.ts: @/ alias, jsdom-WebGL-free
// (no WebGL canvas, no 3D engine import) — pure transform only. Golden literals are
// hard-coded (NOT re-derived from the fixture) so a regrouping bug fails loudly.
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import { mapDoneResponse } from '@/lib/result-mapper';
import type { DoneResponse } from '@/types/pack-contract';

const done = doneResponse as DoneResponse;

describe('mapDoneResponse round-trip (SC-1)', () => {
  it('round-trip recovers every type via typeKeyOf (no idToType map)', () => {
    const view = mapDoneResponse(done);
    // Sorted byType keys equal the captured fixture's three types — parse fallback.
    expect([...view.byType.keys()].sort()).toEqual(['D', 'F', 'T']);
  });

  it('round-trip O(1): every packed id appears in exactly one aggregate, summing to 31', () => {
    const view = mapDoneResponse(done);
    const allIds = [...view.byType.values()].flatMap((agg) => agg.itemIds);
    // Total of byType counts equals summary.items_packed (golden literal 31).
    const totalCount = [...view.byType.values()].reduce((n, agg) => n + agg.count, 0);
    expect(totalCount).toBe(31);
    expect(allIds).toHaveLength(31);
    // No id duplicated across aggregates.
    expect(new Set(allIds).size).toBe(31);
  });
});

describe('mapDoneResponse groups by type and pallet (SC-3)', () => {
  it('byType counts match the verified per-type totals D=11 / T=12 / F=8', () => {
    const view = mapDoneResponse(done);
    expect(view.byType.get('D')!.count).toBe(11);
    expect(view.byType.get('T')!.count).toBe(12);
    expect(view.byType.get('F')!.count).toBe(8);
  });

  it('regroups into 2 pallets with ids P001 / P002', () => {
    const view = mapDoneResponse(done);
    expect(view.pallets).toHaveLength(2);
    expect(view.pallets.map((p) => p.palletId)).toEqual(['P001', 'P002']);
  });

  it('surfaces raw cog + support_ratio unchanged (D-08, no Three.js remap, no bucketing)', () => {
    const view = mapDoneResponse(done);
    // cog passed through verbatim — identical numbers, not remapped to three space.
    expect(view.pallets[0].cog).toEqual(done.result.pallets[0].cog);
    // A sampled mapped item's support_ratio equals the source verbatim.
    const sourceItem = done.result.pallets[0].items[0];
    const mappedItem = view.pallets[0].items[0];
    expect(mappedItem.support_ratio).toBe(sourceItem.support_ratio);
  });
});

describe('mapDoneResponse multi-pallet', () => {
  it('each MappedPallet exposes utilisation + totalWeight + items[]; counts sum to 31', () => {
    const view = mapDoneResponse(done);
    let total = 0;
    for (const p of view.pallets) {
      expect(typeof p.utilisation).toBe('number');
      expect(typeof p.totalWeight).toBe('number');
      expect(Array.isArray(p.items)).toBe(true);
      total += p.items.length;
    }
    expect(total).toBe(31);
  });
});

describe('mapDoneResponse unpacked', () => {
  it('surfaces 7 unpacked items, passing item_id/dimensions/weight/reason raw', () => {
    const view = mapDoneResponse(done);
    expect(view.unpacked).toHaveLength(7);
    const src = done.result.unpacked_items[0];
    expect(view.unpacked[0].item_id).toBe(src.item_id);
    expect(view.unpacked[0].dimensions).toEqual(src.dimensions);
    expect(view.unpacked[0].weight).toBe(src.weight);
    expect(view.unpacked[0].reason).toBe(src.reason);
  });
});

describe('mapDoneResponse map-primary recovery (D-07 / Pitfall 2)', () => {
  it('an explicit idToType map beats the typeKeyOf parse fallback', () => {
    // Override one known fixture id (pallet-0 first item is T000) to a DIFFERENT
    // typeId than its prefix would produce. The override must show up in byType,
    // proving the map is PRIMARY and parse is FALLBACK.
    const idToType = new Map<string, string>([['T000', 'OVERRIDE']]);
    const view = mapDoneResponse(done, idToType);
    expect(view.byType.has('OVERRIDE')).toBe(true);
    expect(view.byType.get('OVERRIDE')!.itemIds).toContain('T000');
    // 'T' aggregate now has one fewer item (12 -> 11) since T000 moved to OVERRIDE.
    expect(view.byType.get('T')!.count).toBe(11);
  });
});

describe('mapDoneResponse non-mutating (Pitfall 5)', () => {
  it('does not inject a typeId property onto the source fixture items', () => {
    mapDoneResponse(done);
    const sourceItem = done.result.pallets[0].items[0] as Record<string, unknown>;
    expect('typeId' in sourceItem).toBe(false);
  });
});
