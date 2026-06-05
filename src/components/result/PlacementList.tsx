// Per-selected-pallet Placement list rail block (RESULT-05 / D-11 / DIAG-02): one card per box in
// the SELECTED pallet's `items`, mirroring the BoxRow visual language — a stable per-type swatch
// (colorForType by typeId), the mono `{item_id}`, a rotation tag `{orientation.name}`, a right mono
// `{weight} kg`, the `{typeId}` sub-line, and a three-cell field grid: Size (post-orientation dims),
// Position (the API min-corner), and Support % (ALWAYS shown — DIAG-02, never hidden behind hover).
//
// Hover (D-11) is a ONE-WAY progressive enhancement: onMouseEnter → onHover(item_id),
// onMouseLeave → onHover(null). ResultPage feeds that id to <Boxes> as `hoveredId`, which lights the
// matching mesh declaratively. The hovered card itself gets an accent border + accent-weak bg. Every
// datum is fully readable WITHOUT hovering (a11y / UI-SPEC focus=hover parity) — hover only adds the
// mesh glow, it never reveals otherwise-hidden information.
//
// The placement note is the CORRECTED min-corner label (C-01): the locked Phase-2 semantics make
// `position` the box MIN CORNER, so the mockup's "box-centre" copy is wrong and is not used here.
//
// Security (V5 / T-06-07): every API string (item_id, orientation.name, typeId) renders as React
// text children only — never via a raw-HTML sink.
//
// Code-split gate (C-04): imports ONLY React/clsx + the palette/contract types + the
// Card-chrome SectionLabel — NO three/r3f/drei and NO viewer module, so the rail stays out of the
// heavy bundle even though it lives inside the lazy /result subtree.
import clsx from 'clsx';
import { useState } from 'react';
import SectionLabel from '@/components/SectionLabel';
import type { PlacementOut } from '@/types/pack-contract';

interface PlacementListProps {
  /** The selected pallet's placements, each tagged with its recovered typeId (from MappedPallet). */
  items: Array<PlacementOut & { typeId: string }>;
  /** Stable type→colour map (the SAME map as the legend / box tint), keyed by typeId. */
  palette: Map<string, string>;
  /** The selected pallet's label (pallet_id, with a `Pallet N` fallback) for the right-side count. */
  palletLabel: string;
  /** One-way hover link (D-11): the hovered item_id, or null on leave. Drives the mesh emissive. */
  onHover: (id: string | null) => void;
}

/** One field cell: a small uppercase mono label over a mono tabular-nums value. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-3">
        {label}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-text-2">{value}</span>
    </div>
  );
}

export default function PlacementList({
  items,
  palette,
  palletLabel,
  onHover,
}: PlacementListProps) {
  // Local hover id only drives this block's own accent cue; the mesh glow is owned by the parent
  // (onHover → ResultPage state → Boxes). Kept one-way (D-11) — no inbound highlight from the mesh.
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-[var(--card-body-padding)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <SectionLabel>Placement</SectionLabel>
        <span className="font-mono text-[10.5px] text-text-3">
          {palletLabel} · {items.length} items
        </span>
      </div>

      {/* Min-corner note (C-01) — corrected from the mockup's "box-centre". */}
      <p className="mt-2 font-mono text-[10.5px] text-text-3">
        positions are box min-corner · mm · origin = pallet corner
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {items.map((item) => {
          const swatch = palette.get(item.typeId) ?? '#6d63f5';
          const isHovered = hovered === item.item_id;
          const { L, W, H } = item.dimensions;
          const { x, y, z } = item.position;

          return (
            <div
              key={item.item_id}
              data-placement-card
              onMouseEnter={() => {
                setHovered(item.item_id);
                onHover(item.item_id);
              }}
              onMouseLeave={() => {
                setHovered(null);
                onHover(null);
              }}
              className={clsx(
                'rounded-[12px] border px-4 py-3 transition-colors duration-150',
                isHovered ? 'border-accent bg-accent-weak' : 'border-border bg-surface',
              )}
            >
              {/* Head: swatch · id-tag · rotation tag · spacer · weight */}
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  style={{ background: swatch }}
                  className="h-[13px] w-[13px] flex-none rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                />
                <span className="rounded-[5px] border border-border bg-surface-2 px-[7px] py-0.5 font-mono text-[10.5px] text-text-3">
                  {item.item_id}
                </span>
                <span className="rounded-[5px] bg-accent-weak px-[7px] py-0.5 font-mono text-[10.5px] text-accent-text">
                  {item.orientation.name}
                </span>
                <div className="flex-1" />
                <span className="font-mono text-[12px] tabular-nums text-text-2">
                  {item.weight} kg
                </span>
              </div>

              {/* Sub-line: recovered type id */}
              <div className="mt-1 font-mono text-[10.5px] text-text-3">{item.typeId}</div>

              {/* Field grid: Size · Position · Support (Support always shown — DIAG-02) */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Field label="Size L·W·H" value={`${L}·${W}·${H}`} />
                <Field label="Position x,y,z" value={`${x}, ${y}, ${z}`} />
                <Field label="Support" value={`${(item.support_ratio * 100).toFixed(0)}%`} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
