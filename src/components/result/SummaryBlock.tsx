// Whole-job Summary rail block (RESULT-03 / D-03): a 2×2 stat grid — Pallets used,
// Utilisation (with an accent fill bar), Unpacked, and Total weight — aggregated from the
// pure `summarise(view, maxPallets)` derivation (06-01). WHOLE-JOB scope: it reads the
// job-level input_summary + Σ pallet weight, so it does NOT change on a pallet switch (D-03).
//
// Formatting lives HERE (the pure `summarise` preserves the raw utilisation product, 06-01):
// counts render as integers, utilisation + weight to 1 decimal, all values mono tabular-nums.
//
// Code-split gate (C-04): imports ONLY React + the pure `summarise` + SectionLabel — no 3D
// renderer and no viewer module, so the rail stays out of the heavy bundle even though it lives
// inside the lazy /result subtree.
import SectionLabel from '@/components/SectionLabel';
import { summarise } from '@/lib/result-summary';
import type { ResultView } from '@/lib/result-mapper';

interface SummaryBlockProps {
  view: ResultView;
  /** options.max_pallets when available — shown as the small `/ {maxPallets}` denominator. */
  maxPallets?: number;
}

/** One stat cell: a mono tabular-nums Display value + an optional affix over an uppercase label. */
function Stat({
  label,
  value,
  affix,
  children,
}: {
  label: string;
  value: string;
  affix?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[22px] font-semibold leading-[1.1] tabular-nums text-text">
          {value}
        </span>
        {affix ? <span className="font-mono text-xs tabular-nums text-text-3">{affix}</span> : null}
      </div>
      {children}
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-3">{label}</span>
    </div>
  );
}

export default function SummaryBlock({ view, maxPallets }: SummaryBlockProps) {
  const s = summarise(view, maxPallets);
  // Named constant (UI-SPEC): utilisation fill bar 4px tall, max-width 120px, accent fill on a
  // neutral #edeef1 track (the same track grey LoadingPage uses), clamped to [0, 100]%.
  const utilWidth = Math.max(0, Math.min(100, s.utilisationPct));

  return (
    // Card surface/border/radius chrome (reusing the same @theme tokens as Card.tsx) headed by the
    // mono uppercase accent-dot SectionLabel — the whole-job rail block.
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-[var(--card-body-padding)] shadow-[var(--shadow)]">
      <SectionLabel>Summary</SectionLabel>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6">
        <Stat
          label="Pallets used"
          value={String(s.palletsUsed)}
          affix={s.maxPallets !== undefined ? `/ ${s.maxPallets}` : undefined}
        />
        <Stat label="Utilisation" value={`${s.utilisationPct.toFixed(1)} %`}>
          <div
            className="mt-1 h-1 max-w-[120px] overflow-hidden rounded-full bg-[#edeef1]"
            aria-hidden="true"
          >
            <div
              data-util-fill
              className="h-full rounded-full bg-accent"
              style={{ width: `${utilWidth}%` }}
            />
          </div>
        </Stat>
        <Stat label="Unpacked" value={`${s.unpacked} / ${s.totalItems}`} />
        <Stat label="Total weight" value={`${s.totalWeightKg.toFixed(1)} kg`} />
      </div>
    </section>
  );
}
