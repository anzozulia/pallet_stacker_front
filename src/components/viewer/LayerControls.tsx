// Bottom-center viewer control bar (L-04): the Phase-8 assembly-insight cluster, layered over the
// <Canvas> as absolute-positioned DOM in the SAME pointer-events-none / pointer-events-auto
// convention ViewerOverlay uses. This bar carries TWO compact controls: an Explode TOGGLE button
// (On/Off, no state-word readout) and a Layers build-up − / readout / + STEPPER cluster (build-up is
// the only layer mode). The stepper is CIRCULAR: All → 1 → 2 → … → (N-1) → All, wrapping both ways,
// so `+` from All reveals layer 1 and never lands on a 0/"no boxes" state.
//
// `layerCount` drives the build-up range top (= All) AND the disabled states: `layerCount === 0`
// disables the whole bar (readout `No boxes`); `layerCount === 1` disables the Layers steppers (a
// single layer can't be built up — readout `Single layer`), Explode stays usable.
//
// All labels/readouts are static literals or a number rendered as React text children only — never a
// raw-HTML sink (T-08-XSS / the locked escaped-text rule).

import clsx from 'clsx';

export interface LayerControlsProps {
  // Current explode amount, 0 or 1. 0 = Assembled (byte-identical, SC-3); 1 = Exploded (full gap).
  explode: number;
  // Toggle handler — called with the NEW numeric explode (0 or 1). The single owner (ResultPage)
  // bumps explode state + the explodeNonce so the camera re-frames on every toggle.
  onExplode: (value: number) => void;
  // Number of base-z layers for the selected pallet (computeLayers). 0 → disabled "No boxes" bar;
  // 1 → "Single layer" (Layers steppers disabled). Also the top of the build-up range (= All).
  layerCount: number;
  // 1-based revealed-up-to layer, or null = "All" (the no-op default, D-08).
  focusIndex: number | null;
  // Layers stepper handler — receives the next level (1..N-1) or null = All (the stepper wraps here).
  onFocusIndex: (index: number | null) => void;
}

export function LayerControls({
  explode,
  onExplode,
  layerCount,
  focusIndex,
  onFocusIndex,
}: LayerControlsProps) {
  const empty = layerCount === 0;
  const single = layerCount === 1;
  // The Layers control is meaningful only with >=2 layers; disabled (but Explode stays usable) below.
  const focusDisabled = empty || single;
  // Explode is a binary toggle: pressed = Exploded (explode 1), unpressed = Assembled (0).
  const exploded = explode > 0;
  // Build-up level. All = the full N-layer stack; the partial levels are 1..N-1 (level N ≡ All).
  // null = All (the no-op default, D-08).
  const atAll = focusIndex == null || focusIndex >= layerCount;
  const level = focusIndex ?? layerCount;
  // Layers readout (UI-SPEC Copywriting): `No boxes` / `Single layer` for the degenerate counts,
  // `All` for the full stack, else `1–{k} / {N}` (k 1-based, floor-up). The word "Layers" is dropped
  // from the partial states to keep the bar compact.
  const layersReadout = empty
    ? 'No boxes'
    : single
      ? 'Single layer'
      : atAll
        ? 'All'
        : `1–${level} / ${layerCount}`;

  // Circular build-up stepper. Cycle: All → 1 → 2 → … → (N-1) → All, wrapping both directions.
  // From All, `+` reveals layer 1 and `−` jumps to the last partial level; stepping past either end
  // of the partial range collapses back to All. The 0/"no boxes" state is intentionally unreachable.
  const step = (delta: number) => {
    const maxPartial = layerCount - 1; // All represents the full N-layer state, so partials cap at N-1
    if (atAll) {
      onFocusIndex(delta > 0 ? 1 : maxPartial);
      return;
    }
    const next = level + delta;
    onFocusIndex(next < 1 || next > maxPartial ? null : next);
  };

  return (
    // pointer-events-none wrapper so only the control cluster captures pointer events (matches
    // ViewerOverlay). Anchored bottom-center (L-04), clear of the bottom-left hints + bottom-right
    // presets.
    <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 select-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-[var(--color-d-border)] bg-[#1a2030]/90 px-[10px] py-[6px] font-mono text-xs leading-tight backdrop-blur">
        {/* Explode portion: a single binary toggle button (Assembled ⇄ Exploded), accent-on /
            neutral-off pill. role=switch + aria-checked so it reads as a toggle; aria-label stays
            "Explode" so existing flows can target it by name. */}
        <span className="font-semibold text-[var(--color-d-text)]">Explode</span>
        <button
          type="button"
          role="switch"
          aria-checked={exploded}
          aria-label="Explode"
          disabled={empty}
          onClick={() => onExplode(exploded ? 0 : 1)}
          className={clsx(
            'cursor-pointer rounded-[5px] border px-[7px] py-[3px] text-[11px] leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            exploded
              ? 'border-[rgba(124,116,255,0.6)] bg-accent text-white'
              : 'border-[var(--color-d-border)] bg-[#1a2030] text-[var(--color-d-text-2)] hover:bg-[#222a3d] hover:text-[var(--color-d-text)]',
          )}
        >
          {exploded ? 'On' : 'Off'}
        </button>

        {/* Divider between the two control clusters. */}
        <span aria-hidden="true" className="h-4 w-px bg-[var(--color-d-border)]" />

        {/* Layers focus portion: a compact − / readout / + stepper cluster (build-up is the only
            layer mode). `+` reveals one more layer floor-up, `−` one fewer; the top of the range
            collapses to All. Disabled together when there are <2 layers. */}
        <span className="font-semibold text-[var(--color-d-text)]">Layers</span>
        <div className={clsx('flex items-center gap-1.5', focusDisabled && 'opacity-50')}>
          <button
            type="button"
            aria-label="Reveal one fewer layer"
            disabled={focusDisabled}
            onClick={() => step(-1)}
            className="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-[5px] border border-[var(--color-d-border)] bg-[#1a2030] text-[13px] leading-none text-[var(--color-d-text-2)] transition-colors hover:bg-[#222a3d] hover:text-[var(--color-d-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            −
          </button>
          <span className="w-[92px] text-center tabular-nums text-[var(--color-d-text-2)]">
            {layersReadout}
          </span>
          <button
            type="button"
            aria-label="Reveal one more layer"
            disabled={focusDisabled}
            onClick={() => step(1)}
            className="grid h-[22px] w-[22px] cursor-pointer place-items-center rounded-[5px] border border-[var(--color-d-border)] bg-[#1a2030] text-[13px] leading-none text-[var(--color-d-text-2)] transition-colors hover:bg-[#222a3d] hover:text-[var(--color-d-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
