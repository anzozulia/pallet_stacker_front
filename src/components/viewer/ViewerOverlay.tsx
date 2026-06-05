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
}

const PRESETS: PresetKind[] = ['ISO', 'TOP', 'FRONT'];

export function ViewerOverlay({
  title,
  dims,
  subline,
  legend,
  active,
  onSelect,
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

      {/* Legend — top-right */}
      <div data-viewer-legend className="absolute right-6 top-6 flex flex-col items-end gap-2">
        {legend.map(([key, color]) => (
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
                'rounded-md border px-[10px] py-[6px] font-mono text-xs leading-tight transition-colors',
                isActive
                  ? 'border-[rgba(124,116,255,0.6)] bg-[rgba(99,90,245,0.32)] text-white'
                  : 'border-[var(--color-d-border)] bg-white/5 text-[var(--color-d-text-2)] hover:bg-white/10 hover:text-[var(--color-d-text)]',
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
