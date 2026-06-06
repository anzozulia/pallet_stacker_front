// Dark overlay chrome layered over the <Canvas> as absolute-positioned DOM (NOT
// drei <Html>, per RESEARCH Open Question 2 — screen-anchored chrome is cleaner as
// plain DOM). pointer-events:none everywhere except the interactive preset buttons.
//
// Per-selected-pallet chrome: pallet name + dimensions tag + the computed sub-line
// (`{N} boxes placed · {fill}% fill · {kg} kg`, D-03), a legend row per whole-result
// type, control hints, and the ISO/TOP/FRONT buttons. The right rail (Summary /
// Switcher / Placement) is sibling DOM in ResultPage, not part of this overlay.

import clsx from 'clsx';
import type { PresetKind } from '@/lib/camera-presets';

export interface ViewerOverlayProps {
  title: string;
  // Pallet 0 footprint dims (integer mm) for the dimensions tag.
  dims: { L: number; W: number; H: number };
  // Computed per-selected-pallet sub-line (D-03): `{N} boxes placed · {fill}% fill · {kg} kg`.
  // Optional so the overlay stays usable without it; rendered under the dims tag when present.
  subline?: string;
  // Legend rows: [typeKey, hexColor] in stable sorted order.
  legend: [string, string][];
  active: PresetKind;
  onSelect: (preset: PresetKind) => void;
  // CoG marker toggle (DIAG-01 / D-10): ON shows the per-pallet CoG marker + drop-line. Default ON.
  cogOn: boolean;
  onToggleCog: () => void;
  // Support-heatmap toggle (DIAG-02 / D-10): ON recolours boxes by support ratio and swaps the
  // legend to the support-scale key. Default OFF — by-type colouring is the default.
  heatmapOn: boolean;
  onToggleHeatmap: () => void;
}

const PRESETS: PresetKind[] = ['ISO', 'TOP', 'FRONT'];

// The support-scale legend key (mirrors src/lib/support-scale.ts buckets, best→worst). Shown in
// place of the by-type swatches when the heatmap is ON, so colour is paired with a labelled scale.
const SUPPORT_KEY: [string, string][] = [
  ['well supported', '#1d4ed8'],
  ['good', '#0ea5a3'],
  ['moderate', '#d97706'],
  ['weak', '#db2777'],
  ['low support', '#7c2d12'],
];

export function ViewerOverlay({
  title,
  dims,
  subline,
  legend,
  active,
  onSelect,
  cogOn,
  onToggleCog,
  heatmapOn,
  onToggleHeatmap,
}: ViewerOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Header — top-left: title + dims tag, with the computed per-pallet sub-line beneath (D-03). */}
      <div className="absolute left-6 top-6 flex flex-col gap-1.5">
        <div className="flex items-center gap-4">
          <span className="font-sans text-base font-semibold leading-tight text-[var(--color-d-text)]">
            {title}
          </span>
          <span className="rounded-[5px] border border-[var(--color-d-border)] bg-white/5 px-2 py-1 font-mono text-xs font-normal leading-tight text-[var(--color-d-text-2)]">
            {dims.L} {'×'} {dims.W} {'×'} {dims.H} mm
          </span>
        </div>
        {subline ? (
          <span className="font-mono text-xs font-normal leading-tight text-[var(--color-d-text-2)]">
            {subline}
          </span>
        ) : null}
      </div>

      {/* Legend — top-right. When the support heatmap is ON, swap the by-type swatches for the
          support-scale key (well-supported → low-support) so colour is paired with a label. */}
      <div data-viewer-legend className="absolute right-6 top-6 flex flex-col items-end gap-2">
        {(heatmapOn ? SUPPORT_KEY : legend).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <span
              className="inline-block rounded-[2px]"
              style={{ width: 9, height: 9, backgroundColor: color }}
            />
            <span className="font-mono text-xs font-normal leading-tight text-[var(--color-d-text-2)]">
              {key}
            </span>
          </div>
        ))}
      </div>

      {/* Control hints — bottom-left */}
      <div className="absolute bottom-6 left-6 flex gap-4 font-mono text-xs leading-tight opacity-85">
        {[
          ['drag', 'orbit'],
          ['scroll', 'zoom'],
          ['right-drag', 'pan'],
        ].map(([verb, action]) => (
          <span key={verb}>
            <span className="font-semibold text-[var(--color-d-text)]">{verb}</span>{' '}
            <span className="font-normal text-[var(--color-d-text-2)]">{action}</span>
          </span>
        ))}
      </div>

      {/* Diagnostic toggles — top-center: Centre of gravity (DIAG-01, default ON) +
          Support heatmap (DIAG-02, default OFF). role=switch with the visible label as the
          accessible name; aria-checked + aria-pressed reflect on/off (UI-SPEC a11y). */}
      <div
        data-viewer-toggles
        className="pointer-events-auto absolute left-1/2 top-6 flex -translate-x-1/2 gap-2"
      >
        {(
          [
            ['Centre of gravity', cogOn, onToggleCog],
            ['Support heatmap', heatmapOn, onToggleHeatmap],
          ] as const
        ).map(([label, on, onToggle]) => (
          <button
            key={label}
            type="button"
            role="switch"
            aria-checked={on}
            aria-pressed={on}
            onClick={onToggle}
            className={clsx(
              'cursor-pointer rounded-md border px-[10px] py-[6px] font-mono text-xs leading-tight transition-colors',
              on
                ? 'border-[rgba(124,116,255,0.6)] bg-accent text-white'
                : 'border-[var(--color-d-border)] bg-[#1a2030] text-[var(--color-d-text-2)] hover:bg-[#222a3d] hover:text-[var(--color-d-text)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Preset buttons — bottom-right (the only interactive chrome) */}
      <div className="pointer-events-auto absolute bottom-6 right-6 flex gap-2">
        {PRESETS.map((p) => {
          const isActive = p === active;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              className={clsx(
                'cursor-pointer rounded-md border px-[10px] py-[6px] font-mono text-xs leading-tight transition-colors',
                isActive
                  ? 'border-[rgba(124,116,255,0.6)] bg-accent text-white'
                  : 'border-[var(--color-d-border)] bg-[#1a2030] text-[var(--color-d-text-2)] hover:bg-[#222a3d] hover:text-[var(--color-d-text)]',
              )}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
