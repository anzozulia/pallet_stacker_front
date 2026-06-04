// Pure, IO-free result-shaping boundary: the captured `done` response -> a grouped
// view model for the Phase 6 result page. Regroups packed boxes by TYPE and by PALLET
// in a single pass, recovering each item's type map-PRIMARY / parse-FALLBACK (D-07).
//
// This module is the DATA-shaping seam only. Coordinate/visual derivation is Phase 6's
// job (D-08): cog and support_ratio are surfaced RAW — never remapped into Three.js
// space, never bucketed into support tiers. byType keys are plain strings that feed
// colorForType (palette.ts) cleanly so the Phase 6 legend stays stable.
//
// Keep this module free of any runtime `three`/React/IO import so it stays outside the
// lazy /result chunk and does not threaten the code-split build gate (SC-4).

import { typeKeyOf } from './mapping';
import type {
  Cog,
  DoneResponse,
  InputSummary,
  PlacementOut,
  UnpackedItem,
} from '@/types/pack-contract';

/** Per-type aggregate: how many of a box type packed, their combined weight + ids. */
export interface TypeAggregate {
  typeId: string;
  count: number;
  totalWeight: number;
  itemIds: string[];
}

/** One pallet's view: raw placements (each tagged with its recovered typeId) + raw cog. */
export interface MappedPallet {
  palletId: string;
  utilisation: number;
  cog: Cog;
  totalWeight: number;
  items: Array<PlacementOut & { typeId: string }>;
}

/** The full grouped result view model fed to the Phase 6 result page. */
export interface ResultView {
  summary: InputSummary;
  pallets: MappedPallet[];
  byType: Map<string, TypeAggregate>;
  unpacked: UnpackedItem[];
}

/**
 * Regroup a captured `done` response by type AND by pallet in a single pass.
 *
 * Type recovery is map-PRIMARY, parse-FALLBACK: an explicit `idToType` entry wins;
 * otherwise the leading non-digit prefix (`typeKeyOf`) is used. cog + support_ratio
 * are passed through RAW (D-08). The transform never mutates the input — each item is
 * SPREAD into a new object, never assigned onto (Pitfall 5).
 */
export function mapDoneResponse(done: DoneResponse, idToType?: Map<string, string>): ResultView {
  const recoverType = (id: string): string => idToType?.get(id) ?? typeKeyOf(id);

  const byType = new Map<string, TypeAggregate>();

  const pallets: MappedPallet[] = done.result.pallets.map((p) => ({
    palletId: p.pallet_id,
    utilisation: p.utilisation,
    cog: p.cog, // RAW — no Three.js remap (D-08)
    totalWeight: p.total_weight,
    items: p.items.map((it) => {
      const typeId = recoverType(it.item_id);

      // Fold into the by-type aggregate (second grouping axis), same pass.
      let agg = byType.get(typeId);
      if (!agg) {
        agg = { typeId, count: 0, totalWeight: 0, itemIds: [] };
        byType.set(typeId, agg);
      }
      agg.count += 1;
      agg.totalWeight += it.weight;
      agg.itemIds.push(it.item_id);

      return { ...it, typeId }; // SPREAD — never mutate the source item
    }),
  }));

  return {
    summary: done.result.input_summary,
    pallets,
    byType,
    unpacked: done.result.unpacked_items,
  };
}
