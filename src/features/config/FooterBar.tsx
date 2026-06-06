// The sticky Configure-screen footer (BOX-05 / D-03). Renders, left-to-right:
//  - the live running total `{N} box types · {M} units · est. {K} kg` (mono, NaN-safe via
//    `tallyCatalog`), recomputed from `useWatch('boxTypes')`;
//  - a NON-blocking large-job advisory `Large job — {M} units may take longer to solve and
//    render.` shown only when `overThreshold` (units > 1000). Advisory tone (`--text-2`),
//    NEVER `--danger`; it never disables Run;
//  - the `Run packing` primary CTA (arrow-right icon), disabled while the form is invalid.
//
// The footer is a FULL-WIDTH sticky bottom bar that mirrors the page header (border-t + bg +
// backdrop, spanning the viewport). Its inner content is centred to the 960px form column.
// Drafts persist via the debounced autosave (useLocalStorageAutosave) — there is NO manual
// Save draft affordance (the autosave is the sole persistence path, D-07).
//
// The actual submit handler is owned by `ConfigForm` (Task 2) and passed in as a prop
// (`onRun`, `runDisabled`) so this component stays a pure presentation unit, independently
// testable in jsdom.
//
// Code-split gate (C-05): imports ONLY React, react-hook-form, `@/lib/config-tally`,
// and `@/types/config` — never three/r3f/drei or any viewer module.
import { useFormContext, useWatch } from 'react-hook-form';
import { tallyCatalog } from '@/lib/config-tally';
import type { PackConfig } from '@/types/config';

type FooterBarProps = {
  /** Submit handler from ConfigForm (handleSubmit(onValid)). */
  onRun: () => void;
  /** Disable the Run CTA while the form is invalid (D-06). */
  runDisabled?: boolean;
};

export default function FooterBar({ onRun, runDisabled = false }: FooterBarProps) {
  const { control } = useFormContext<PackConfig>();
  // Subscribe to just the catalog array and recompute the pure, NaN-safe tally.
  const boxTypes = useWatch({ control, name: 'boxTypes' }) ?? [];
  const { types, units, estKg, overThreshold } = tallyCatalog(boxTypes);

  return (
    // Full-width sticky bottom bar mirroring the header chrome (border-t + bg + backdrop). The
    // inner div re-centres the content to the 960px form column so it lines up with the cards.
    <div className="sticky bottom-0 z-20 border-t border-border bg-[rgba(255,255,255,0.82)] px-6 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[960px] items-center gap-4">
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
    </div>
  );
}
