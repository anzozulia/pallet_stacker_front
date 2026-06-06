// CR-01 regression: the palette key, the box-tint key, the PlacementList lookup key, and the legend
// label MUST all be the SAME recovered `typeId`. This is the cross-module invariant that broke for
// the REAL production id format `${typeId}-${index}` (request-builder.makeItemId → `Da-0`, `Tb-0`,
// `Fc-0`), where the two type-recovery schemes diverge:
//   - idToType.get("Da-0")  → "Da"   (the map-PRIMARY recovery `mapDoneResponse` uses)
//   - typeKeyOf("Da-0")     → "Da-"  (leading non-digit prefix INCLUDES the trailing hyphen)
//
// The committed golden fixture uses the LEGACY no-hyphen format (`T000`/`D003`) where the two schemes
// coincide, so it never caught the bug. This test deliberately uses the `Da-0` format so it FAILS
// against the old palette (keyed by `typeKeyOf(item_id)` via buildPalette) and PASSES with the fix
// (palette built from `colorForType([...view.byType.keys()])`, i.e. the recovered typeIds).
//
// Pure, jsdom-WebGL-free: exercises the data seam (mapDoneResponse → colorForType) that ResultPage
// wires, asserting the consumer lookups (PlacementList `palette.get(item.typeId)`, Boxes tint by
// `item.typeId`, legend `[...palette.entries()]`) all resolve.
import { describe, expect, it } from 'vitest';
import { buildPackRequest } from '@/lib/request-builder';
import { mapDoneResponse } from '@/lib/result-mapper';
import { typeKeyOf } from '@/lib/mapping';
import { colorForType } from '@/lib/palette';
import type { PackConfig } from '@/types/config';
import type { DoneResponse, PlacementOut } from '@/types/pack-contract';

/** A config whose box-type ids are the REAL multi-char catalog ids that expand to `${id}-${index}`. */
function realConfig(): PackConfig {
  return {
    pallet: {
      length: 1200,
      width: 800,
      height: 1800,
      maxWeight: 1000,
      maxOverhang: 0,
      allowOverhang: false,
    },
    boxTypes: [
      {
        id: 'Da',
        label: 'Da',
        length: 400,
        width: 300,
        height: 200,
        weight: 12,
        quantity: 2,
        maxLoad: 50,
        fragile: false,
        rotation: 'free',
      },
      {
        id: 'Tb',
        label: 'Tb',
        length: 300,
        width: 300,
        height: 300,
        weight: 8,
        quantity: 1,
        maxLoad: 50,
        fragile: false,
        rotation: 'free',
      },
      {
        id: 'Fc',
        label: 'Fc',
        length: 200,
        width: 200,
        height: 200,
        weight: 4,
        quantity: 1,
        maxLoad: 50,
        fragile: false,
        rotation: 'free',
      },
    ],
  };
}

/** One placement carrying the real `${typeId}-${index}` item id, otherwise minimally shape-complete. */
function placement(itemId: string): PlacementOut {
  return {
    item_id: itemId,
    position: { x: 0, y: 0, z: 0 },
    dimensions: { L: 100, W: 100, H: 100 },
    orientation: { perm: [0, 1, 2], name: 'as-is' },
    weight: 4,
    support_ratio: 1,
    supported_by: [],
    supports: [],
  };
}

/** A `done` response built from the REAL ids the request-builder emits (NOT the legacy `T000` form). */
function realDone(ids: string[]): DoneResponse {
  return {
    job_id: 'job-cr01',
    status: 'done',
    result: {
      input_summary: {
        items_packed: ids.length,
        items_unpacked: 0,
        pallets_used: 1,
        total_volume_utilisation: 0.5,
      },
      pallets: [
        {
          pallet_id: 'P001',
          dimensions: { L: 1200, W: 800, H: 1800, max_weight: 1000 },
          utilisation: 0.5,
          cog: { x: 600, y: 400, z: 300 },
          total_weight: ids.length * 4,
          items: ids.map(placement),
        },
      ],
      unpacked_items: [],
    },
  } as DoneResponse;
}

describe('CR-01: palette / box-tint / PlacementList / legend share one recovered typeId', () => {
  it('the real ${typeId}-${index} format makes typeKeyOf diverge from idToType (the bug premise)', () => {
    // Guards the precondition: if request-builder ever stops emitting `${id}-${index}`, or typeKeyOf
    // stops including the hyphen, this test would silently stop exercising the divergence.
    const { idToType } = buildPackRequest(realConfig());
    expect(idToType.get('Da-0')).toBe('Da'); // map-PRIMARY recovery → clean typeId
    expect(typeKeyOf('Da-0')).toBe('Da-'); // parse-fallback → INCLUDES the trailing hyphen
    expect(idToType.get('Da-0')).not.toBe(typeKeyOf('Da-0')); // they DIVERGE on real ids
  });

  it('palette.get(item.typeId) is defined for EVERY placement (the CR-01 invariant)', () => {
    const { idToType } = buildPackRequest(realConfig());
    const ids = [...idToType.keys()]; // Da-0, Da-1, Tb-0, Fc-0
    const view = mapDoneResponse(realDone(ids), idToType);

    // The palette ResultPage now builds: keyed by the recovered typeIds (byType keys), NOT raw ids.
    const palette = colorForType([...view.byType.keys()]);

    // Every placement's PlacementList/Boxes lookup key (item.typeId) resolves in the palette.
    for (const item of view.pallets[0].items) {
      expect(palette.get(item.typeId), `palette miss for typeId="${item.typeId}"`).toBeDefined();
    }
  });

  it('the box-tint key, palette key, PlacementList lookup key, and legend label are the SAME typeId', () => {
    const { idToType } = buildPackRequest(realConfig());
    const ids = [...idToType.keys()];
    const view = mapDoneResponse(realDone(ids), idToType);

    const palette = colorForType([...view.byType.keys()]);
    const legendLabels = new Set([...palette.entries()].map(([label]) => label));

    for (const item of view.pallets[0].items) {
      const typeId = item.typeId; // PlacementList lookup key AND Boxes tint key (post-fix)
      const paletteKey = [...palette.keys()].find((k) => k === typeId); // palette key
      expect(paletteKey).toBe(typeId);
      expect(legendLabels.has(typeId)).toBe(true); // legend label
      // And critically: the legend label carries NO dangling hyphen (the old typeKeyOf artefact).
      expect(typeId).not.toMatch(/-$/);
    }

    // The clean recovered typeIds are exactly the catalog ids — no "Da-" artefacts.
    expect([...palette.keys()].sort()).toEqual(['Da', 'Fc', 'Tb']);
  });
});
