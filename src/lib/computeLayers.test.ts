import { describe, expect, it } from 'vitest';
// Wiring copied from cog-map.test.ts / mapping.test.ts: @/ alias proves resolution under
// Vitest, stays jsdom-WebGL-free (no Canvas / three import) — pure base-z banding only.
// Golden arrays are hand-stated LITERALS (NOT re-derived from the algorithm) so a banding
// bug fails loudly — same empirical discipline as the Phase-2 mapping risk. The base-z
// distribution comes from pack-done-response.json pallets[].items (verified: P001 -> z=0
// (12 boxes H=700) + z=700 (7 boxes H=300); P002 -> z=0 (5 boxes, mixed H=350/150) +
// z=150 (1) + z=350 (4) + z=700 (2)).
import { computeLayers, type ItemLike } from '@/lib/computeLayers';
import fixture from '@/lib/__fixtures__/pack-done-response.json';

const pallets = fixture.result.pallets;
const P001 = pallets.find((p) => p.pallet_id === 'P001')!.items as ItemLike[];
const P002 = pallets.find((p) => p.pallet_id === 'P002')!.items as ItemLike[];

describe('computeLayers (golden, SC-1 — base-z banding, floor-up, tall-box-by-base)', () => {
  it('bands fixture P001 into exactly 2 layers with baseZ [0, 700], index === i (literals)', () => {
    const { layers } = computeLayers(P001);
    expect(layers.length).toBe(2);
    expect(layers.map((l) => l.baseZ)).toEqual([0, 700]);
    expect(layers.map((l) => l.index)).toEqual([0, 1]);
  });

  it('bands fixture P002 into exactly 4 layers with baseZ [0, 150, 350, 700] ascending (literals)', () => {
    const { layers } = computeLayers(P002);
    expect(layers.length).toBe(4);
    expect(layers.map((l) => l.baseZ)).toEqual([0, 150, 350, 700]);
    expect(layers.map((l) => l.index)).toEqual([0, 1, 2, 3]);
  });

  it('a tall box (F003, H=350 at z=0 in P002) bands by its BASE -> layer 0, NOT 2', () => {
    const { itemToLayer } = computeLayers(P002);
    expect(itemToLayer.get('F003')).toBe(0);
  });

  it('single-layer synthetic: 3 items all at z=0 -> exactly 1 layer holding all ids', () => {
    const items: ItemLike[] = [
      { item_id: 'A', position: { x: 0, y: 0, z: 0 }, dimensions: { L: 100, W: 100, H: 100 } },
      { item_id: 'B', position: { x: 1, y: 0, z: 0 }, dimensions: { L: 100, W: 100, H: 200 } },
      { item_id: 'C', position: { x: 2, y: 0, z: 0 }, dimensions: { L: 100, W: 100, H: 100 } },
    ];
    const { layers, itemToLayer } = computeLayers(items);
    expect(layers.length).toBe(1);
    expect(layers[0].itemIds.sort()).toEqual(['A', 'B', 'C']);
    expect(itemToLayer.get('A')).toBe(0);
    expect(itemToLayer.get('B')).toBe(0);
    expect(itemToLayer.get('C')).toBe(0);
  });

  it('uneven-height band: the P002 z=0 band (mixed H=350/150) is ONE layer whose topZ === 350', () => {
    const { layers } = computeLayers(P002);
    // The base band holds F001-F004 (H=350) + D006 (H=150); topZ = max(0+350, 0+150) = 350.
    expect(layers[0].baseZ).toBe(0);
    expect(layers[0].topZ).toBe(350);
  });

  it('floating box: one box at z=150 between dense bands gets its OWN layer (gap > tolerance)', () => {
    const items: ItemLike[] = [
      { item_id: 'lo', position: { x: 0, y: 0, z: 0 }, dimensions: { L: 100, W: 100, H: 100 } },
      { item_id: 'mid', position: { x: 0, y: 0, z: 150 }, dimensions: { L: 100, W: 100, H: 50 } },
      { item_id: 'hi', position: { x: 0, y: 0, z: 700 }, dimensions: { L: 100, W: 100, H: 100 } },
    ];
    const { layers, itemToLayer } = computeLayers(items);
    expect(layers.length).toBe(3);
    expect(layers.map((l) => l.baseZ)).toEqual([0, 150, 700]);
    expect(itemToLayer.get('mid')).toBe(1);
  });

  it('itemToLayer is complete: size === items.length for both fixture pallets', () => {
    expect(computeLayers(P001).itemToLayer.size).toBe(P001.length);
    expect(computeLayers(P002).itemToLayer.size).toBe(P002.length);
  });

  it('empty input -> empty model (guards the UI "No boxes" disabled state)', () => {
    const { layers, itemToLayer } = computeLayers([]);
    expect(layers).toEqual([]);
    expect(itemToLayer.size).toBe(0);
  });
});
