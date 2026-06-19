// Bottom-center viewer control bar (L-04): the new Phase-8 assembly-insight cluster, layered over
// the <Canvas> as absolute-positioned DOM in the SAME pointer-events-none / pointer-events-auto
// convention ViewerOverlay uses. This plan (08-02) implements ONLY the Explode portion — a label,
// a NATIVE `<input type="range">` (RESEARCH "Don't Hand-Roll": never a bespoke div-slider, so
// keyboard arrow operation + a11y come for free), and a right-side value readout that reads
// `Assembled` at 0 and a unitless `{x}.{y}x` when raised (UI-SPEC Copywriting Contract).
//
// The bar is structured so Plan 03 can add the Layers slider + mode toggle to the SAME cluster
// without restructuring; `layerCount` is already a prop (consumed by Plan 03's range max + the
// empty-state disable here). When `layerCount === 0` the bar renders disabled with a `No boxes`
// readout (UI-SPEC empty state).
//
// All labels/readouts are static literals or a `toFixed` number rendered as React text children
// only — never a raw-HTML sink (T-08-XSS / the locked escaped-text rule).

export interface LayerControlsProps {
  // Current explode amount, 0..1. 0 = Assembled (byte-identical, SC-3).
  explode: number;
  // Slider change handler — the single owner (ResultPage) bumps explode state + the explodeNonce.
  onExplode: (value: number) => void;
  // Number of base-z layers for the selected pallet (computeLayers). 0 → disabled "No boxes" bar.
  // Also the Plan-03 Layers-slider range max (accepted now so the bar shape is stable).
  layerCount: number;
}

export function LayerControls({ explode, onExplode, layerCount }: LayerControlsProps) {
  const empty = layerCount === 0;
  // Readout copy (UI-SPEC): `No boxes` when empty, `Assembled` at exactly 0, else a unitless `x`.
  const readout = empty ? 'No boxes' : explode === 0 ? 'Assembled' : `${explode.toFixed(1)}x`;

  return (
    // pointer-events-none wrapper so only the control cluster captures pointer events (matches
    // ViewerOverlay). Anchored bottom-center (L-04), clear of the bottom-left hints + bottom-right
    // presets.
    <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 select-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-[var(--color-d-border)] bg-[#1a2030]/90 px-[10px] py-[6px] font-mono text-xs leading-tight backdrop-blur">
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
          aria-valuetext={readout}
          // Accent fill + thumb on a #1a2030 track (UI-SPEC Color: accent ONLY for the slider).
          // accent-color tints both the filled track and the thumb natively; disabled dims it.
          className="h-1 w-40 cursor-pointer appearance-none rounded-full bg-[#0c0f17] accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="w-[68px] text-right tabular-nums text-[var(--color-d-text-2)]">
          {readout}
        </span>
      </div>
    </div>
  );
}
