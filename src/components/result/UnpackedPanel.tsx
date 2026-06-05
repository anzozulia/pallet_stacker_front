// Conditional whole-job Unpacked panel rail block (RESULT-06 / D-06): the items the solver could not
// place, shown ONLY when there are any. Whole-job scope — its content does NOT change when the
// selected pallet changes, and it is non-interactive (no mesh link).
//
//   - unpacked.length > 0 → a `Could not pack` block with a right mono `{N} items` count; each row
//     mirrors the BoxRow head: mono `{item_id}`, the recovered `{type}` (idToType ?? typeKeyOf, C-03),
//     dims `{l}·{w}·{h} mm`, `{weight} kg`, and the `{reason}` rendered as PLAIN React text.
//   - unpacked.length === 0 → the block is OMITTED and a calm single-line `All items packed ✓`
//     affordance shows using the --color-pos token (text/checkmark, never a fill).
//
// Security (V5 / T-06-07): the API `reason` / `item_id` strings render as React text children only —
// NEVER via a raw-HTML sink (mirrors the Phase-5 ErrorCard escaped-text rule).
//
// Code-split gate (C-04): imports ONLY React/clsx + typeKeyOf + the contract types + the Card-chrome
// SectionLabel — NO three/r3f/drei and NO viewer module.
import SectionLabel from '@/components/SectionLabel';
import { typeKeyOf } from '@/lib/mapping';
import type { UnpackedItem } from '@/types/pack-contract';

interface UnpackedPanelProps {
  /** The whole-job unpacked items (view.unpacked). */
  unpacked: UnpackedItem[];
  /** Optional map-PRIMARY type recovery (C-03); falls back to typeKeyOf when absent. */
  idToType?: Map<string, string>;
}

export default function UnpackedPanel({ unpacked, idToType }: UnpackedPanelProps) {
  // All-packed affordance (D-06): omit the block, show a calm positive single line.
  if (unpacked.length === 0) {
    return <p className="font-mono text-[12px] text-[var(--color-pos)]">All items packed ✓</p>;
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-[var(--card-body-padding)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <SectionLabel>Could not pack</SectionLabel>
        <span className="font-mono text-[10.5px] text-text-3">{unpacked.length} items</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {unpacked.map((item) => {
          // map-PRIMARY / parse-FALLBACK type recovery (C-03) — do NOT re-derive id parsing.
          const type = idToType?.get(item.item_id) ?? typeKeyOf(item.item_id);
          const { L, W, H } = item.dimensions;

          return (
            <div
              key={item.item_id}
              data-unpacked-row
              className="rounded-[12px] border border-border bg-surface px-4 py-3"
            >
              {/* Head: id-tag · type · spacer · weight */}
              <div className="flex items-center gap-2.5">
                <span className="rounded-[5px] border border-border bg-surface-2 px-[7px] py-0.5 font-mono text-[10.5px] text-text-3">
                  {item.item_id}
                </span>
                <span className="font-mono text-[10.5px] text-text-3">{type}</span>
                <div className="flex-1" />
                <span className="font-mono text-[12px] tabular-nums text-text-2">
                  {item.weight} kg
                </span>
              </div>

              {/* Meta line: dims + reason (reason as PLAIN text — V5 / T-06-07) */}
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[11px] tabular-nums text-text-2">
                  {L}·{W}·{H} mm
                </span>
                <span className="font-mono text-[11px] text-text-3">{item.reason}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
