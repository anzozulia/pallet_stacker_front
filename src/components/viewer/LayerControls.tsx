// Bottom-center viewer control bar (L-04): the new Phase-8 assembly-insight cluster, layered over
// the <Canvas> as absolute-positioned DOM in the SAME pointer-events-none / pointer-events-auto
// convention ViewerOverlay uses. This bar now carries BOTH controls: the Explode portion (08-02 — a
// native `<input type="range">` with an `Assembled`/`{x}x` readout) AND the Layers focus portion
// (08-03 — a Build-up/Isolate mode toggle + a native Layers `<input type="range">` 0..N with an
// `All`/`Layer k / N` readout). Native ranges per RESEARCH "Don't Hand-Roll" — keyboard arrow
// operation + a11y come for free.
//
// `layerCount` drives the Layers range max AND the disabled states: `layerCount === 0` disables the
// whole bar (readout `No boxes`); `layerCount === 1` disables the Layers slider + mode toggle (a
// single layer can't be built up or isolated — readout `Single layer`), Explode stays usable.
//
// All labels/readouts are static literals or a number rendered as React text children only — never a
// raw-HTML sink (T-08-XSS / the locked escaped-text rule).

import clsx from 'clsx';

export interface LayerControlsProps {
  // Current explode amount, 0..1. 0 = Assembled (byte-identical, SC-3).
  explode: number;
  // Slider change handler — the single owner (ResultPage) bumps explode state + the explodeNonce.
  onExplode: (value: number) => void;
  // Number of base-z layers for the selected pallet (computeLayers). 0 → disabled "No boxes" bar;
  // 1 → "Single layer" (Layers slider + mode toggle disabled). Also the Layers range max.
  layerCount: number;
  // Layer-focus mode (D-08/D-09). `buildup` reveals cumulatively; `isolate` ghosts non-focused.
  focusMode: 'buildup' | 'isolate';
  // Mode toggle handler — ResultPage owns the focusMode state.
  onFocusMode: (mode: 'buildup' | 'isolate') => void;
  // 1-based focused layer, or null = "All" (the no-op default, D-08). The slider treats 0 as All.
  focusIndex: number | null;
  // Layers slider handler — null/0 = All; ResultPage maps the numeric value back to null at 0.
  onFocusIndex: (index: number | null) => void;
}

export function LayerControls({
  explode,
  onExplode,
  layerCount,
  focusMode,
  onFocusMode,
  focusIndex,
  onFocusIndex,
}: LayerControlsProps) {
  const empty = layerCount === 0;
  const single = layerCount === 1;
  // The Layers control is meaningful only with >=2 layers; disabled (but Explode stays usable) below.
  const focusDisabled = empty || single;
  // Explode readout (UI-SPEC): `No boxes` when empty, `Assembled` at exactly 0, else a unitless `x`.
  const explodeReadout = empty
    ? 'No boxes'
    : explode === 0
      ? 'Assembled'
      : `${explode.toFixed(1)}x`;
  // Layers readout (UI-SPEC Copywriting): `No boxes` / `Single layer` for the degenerate counts,
  // `All` at 0/null (the no-op default), else `Layer {k} / {N}` (k 1-based, floor-up, D-08).
  const layersReadout = empty
    ? 'No boxes'
    : single
      ? 'Single layer'
      : focusIndex == null || focusIndex === 0
        ? 'All'
        : `Layer ${focusIndex} / ${layerCount}`;

  return (
    // pointer-events-none wrapper so only the control cluster captures pointer events (matches
    // ViewerOverlay). Anchored bottom-center (L-04), clear of the bottom-left hints + bottom-right
    // presets.
    <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 select-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-[var(--color-d-border)] bg-[#1a2030]/90 px-[10px] py-[6px] font-mono text-xs leading-tight backdrop-blur">
        {/* Explode portion (08-02, unchanged). */}
        <span className="font-semibold text-[var(--color-d-text)]">Explode</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={explode}
          disabled={empty}
          onChange={(e) => onExplode(e.currentTarget.valueAsNumber)}
          aria-label="Explode amount"
          aria-valuetext={explodeReadout}
          // Accent fill + thumb on a #1a2030 track (UI-SPEC Color: accent ONLY for the slider).
          // accent-color tints both the filled track and the thumb natively; disabled dims it.
          className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-[#0c0f17] accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="w-[68px] text-right tabular-nums text-[var(--color-d-text-2)]">
          {explodeReadout}
        </span>

        {/* Divider between the two control clusters. */}
        <span aria-hidden="true" className="h-4 w-px bg-[var(--color-d-border)]" />

        {/* Layers focus portion (08-03): Build-up/Isolate mode toggle + a Layers range 0..N. The
            mode toggle is two role=switch pills (ViewerOverlay active/inactive class pair); only the
            active mode is accent-filled. Disabled together when there are <2 layers. */}
        <span className="font-semibold text-[var(--color-d-text)]">Layers</span>
        <div className={clsx('flex gap-1', focusDisabled && 'pointer-events-none opacity-50')}>
          {(['buildup', 'isolate'] as const).map((mode) => {
            const on = focusMode === mode;
            const label = mode === 'buildup' ? 'Build-up' : 'Isolate';
            return (
              <button
                key={mode}
                type="button"
                role="switch"
                aria-checked={on}
                aria-pressed={on}
                disabled={focusDisabled}
                onClick={() => onFocusMode(mode)}
                className={clsx(
                  'cursor-pointer rounded-[5px] border px-[7px] py-[3px] text-[11px] leading-tight transition-colors disabled:cursor-not-allowed',
                  on
                    ? 'border-[rgba(124,116,255,0.6)] bg-accent text-white'
                    : 'border-[var(--color-d-border)] bg-[#1a2030] text-[var(--color-d-text-2)] hover:bg-[#222a3d] hover:text-[var(--color-d-text)]',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input
          type="range"
          min={0}
          max={layerCount}
          step={1}
          value={focusIndex ?? 0}
          disabled={focusDisabled}
          onChange={(e) => {
            const v = e.currentTarget.valueAsNumber;
            onFocusIndex(v === 0 ? null : v);
          }}
          aria-label="Layer focus"
          aria-valuetext={layersReadout}
          className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-[#0c0f17] accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="w-[80px] text-right tabular-nums text-[var(--color-d-text-2)]">
          {layersReadout}
        </span>
      </div>
    </div>
  );
}
