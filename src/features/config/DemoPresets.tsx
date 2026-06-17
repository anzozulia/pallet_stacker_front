// The demo-preset picker shown at the TOP of the Configure page (above the page H1). A
// labelled "Try a demo" section with a wrapping row of clickable preset cards — each click
// prefills the whole config form via the parent's `onPick(buildPresetConfig(preset))`.
//
// Presentational only: takes `onPick` and renders. The pallet envelope is fixed by
// buildPresetConfig; this component only surfaces the box-catalog variants.
//
// Code-split gate (C-05): imports ONLY React, @/features/config/demo-presets,
// @/types/config (+ clsx) — never three/r3f/drei or any viewer module, so it stays in the
// eager `/` chunk.
import SectionLabel from '@/components/SectionLabel';
import { DEMO_PRESETS, buildPresetConfig } from '@/features/config/demo-presets';
import type { PackConfig } from '@/types/config';

type DemoPresetsProps = {
  onPick: (config: PackConfig) => void;
};

export default function DemoPresets({ onPick }: DemoPresetsProps) {
  return (
    <section aria-label="Demo presets" className="mb-10 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <SectionLabel>Try a demo</SectionLabel>
        <p className="text-xs text-text-3">
          Prefill a vetted catalog — the pallet stays 1200×800×1800.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 max-[720px]:flex-col">
        {DEMO_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => onPick(buildPresetConfig(preset))}
            className="flex min-w-[200px] flex-1 cursor-pointer flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-accent hover:bg-accent-weak"
          >
            <span className="text-sm font-semibold text-text">{preset.name}</span>
            <span className="text-xs leading-relaxed text-text-3">{preset.description}</span>
            <span className="mt-0.5 font-mono text-[10.5px] text-text-3">
              {preset.boxTypes.length} box {preset.boxTypes.length === 1 ? 'type' : 'types'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
