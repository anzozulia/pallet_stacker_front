// The sticky Configure-screen footer (BOX-05 / D-03 / D-07). Renders, left-to-right:
//  - the live running total `{N} box types · {M} units · est. {K} kg` (mono, NaN-safe via
//    `tallyCatalog`), recomputed from `useWatch('boxTypes')`;
//  - a NON-blocking large-job advisory `Large job — {M} units may take longer to solve and
//    render.` shown only when `overThreshold` (units > 1000). Advisory tone (`--text-2`),
//    NEVER `--danger`; it never disables Run;
//  - a `Save draft` ghost button that flushes an immediate save and swaps its label to
//    `Saved ✓` for ~1.5s (the only visible auto-save affordance, D-07);
//  - the `Run packing` primary CTA (arrow-right icon), disabled while the form is invalid.
//
// The actual submit/flush handlers are owned by `ConfigForm` (Task 2) and passed in as
// props (`onRun`, `onSaveDraft`, `runDisabled`) so this component stays a pure presentation
// + local-confirmation unit, independently testable in jsdom.
//
// Code-split gate (C-05): imports ONLY React, react-hook-form, clsx, `@/lib/config-tally`,
// and `@/types/config` — never three/r3f/drei or any viewer module.
import { useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { tallyCatalog } from '@/lib/config-tally';
import type { PackConfig } from '@/types/config';

const SAVED_CONFIRM_MS = 1500;

type FooterBarProps = {
  /** Submit handler from ConfigForm (handleSubmit(onValid)). */
  onRun: () => void;
  /** Flush-save handler from ConfigForm (writes current values immediately). */
  onSaveDraft: () => void;
  /** Disable the Run CTA while the form is invalid (D-06). */
  runDisabled?: boolean;
};

export default function FooterBar({ onRun, onSaveDraft, runDisabled = false }: FooterBarProps) {
  const { control } = useFormContext<PackConfig>();
  // Subscribe to just the catalog array and recompute the pure, NaN-safe tally.
  const boxTypes = useWatch({ control, name: 'boxTypes' }) ?? [];
  const { types, units, estKg, overThreshold } = tallyCatalog(boxTypes);

  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSaveDraft() {
    onSaveDraft();
    setSaved(true);
    if (savedTimer.current !== null) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setSaved(false);
      savedTimer.current = null;
    }, SAVED_CONFIRM_MS);
  }

  return (
    <div className="sticky bottom-0 mt-8 mb-2 flex items-center gap-4 rounded-[var(--radius)] border-t border-border bg-surface px-6 py-4 pb-5">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-xs text-text-2">
          {types} box types · {units} units · est. {estKg} kg
        </span>
        {overThreshold ? (
          <span className="text-xs text-text-2">
            Large job — {units} units may take longer to solve and render.
          </span>
        ) : null}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={handleSaveDraft}
        className="cursor-pointer rounded-[var(--radius)] border border-border-strong bg-transparent px-4 py-2.5 text-sm font-semibold text-text-2 transition-colors duration-150 hover:bg-[#eceef1]"
      >
        {saved ? 'Saved ✓' : 'Save draft'}
      </button>

      <button
        type="button"
        onClick={onRun}
        disabled={runDisabled}
        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Run packing
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 8h9M8.5 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
