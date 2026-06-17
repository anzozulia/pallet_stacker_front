// Single-select Pallet switcher rail block (RESULT-04 / D-04 / D-05): one row per generated
// pallet — a leading index chip, the API pallet label, mono meta `{boxes} boxes · {kg} kg`, and a
// right-side neutral `{fill}%` mini bar. Selecting a row drives the selected-pallet index in
// ResultPage (which swaps the rendered pallet on the one persistent Canvas).
//
// A11y (UI-SPEC): the rows form a single-select group — each row is a real <button> with
// `aria-pressed`, exactly one selected. The selected cue is NON-colour-only (accent border + inset
// ring + a FILLED index chip), so it is perceivable without colour. Enter/Space select (native
// button keyboard semantics + an explicit handler mirroring Switch.tsx).
//
// D-04 (honest-over-pretty): fill% renders NEUTRALLY regardless of value — NO amber/warn
// treatment, NO client-side fill threshold. The solver decides placement; we never imply a
// quality judgement it did not make.
//
// Code-split gate (C-04): imports ONLY React/clsx + the MappedPallet type — no 3D renderer and no
// viewer module, so the rail stays out of the heavy bundle.
import clsx from 'clsx';
import SectionLabel from '@/components/SectionLabel';
import type { MappedPallet } from '@/lib/result-mapper';

interface PalletSwitcherProps {
  pallets: MappedPallet[];
  selected: number;
  onSelect: (index: number) => void;
}

export default function PalletSwitcher({ pallets, selected, onSelect }: PalletSwitcherProps) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-[var(--card-body-padding)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <SectionLabel>Pallets</SectionLabel>
        <span className="font-mono text-[10.5px] text-text-3">{pallets.length} generated</span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {pallets.map((p, i) => {
          const isSelected = i === selected;
          // Label fallback is `Pallet N` (1-based) — never A/B/C (D-05).
          const label = p.palletId || `Pallet ${i + 1}`;
          // Neutral fill% (D-04) — clamped, shown as an integer.
          const fillPct = Math.max(0, Math.min(100, p.utilisation * 100));

          function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onSelect(i);
            }
          }

          return (
            <button
              key={p.palletId || i}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(i)}
              onKeyDown={handleKeyDown}
              className={clsx(
                'flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-left transition-colors duration-150',
                isSelected
                  ? 'border-accent bg-accent/15 ring-1 ring-inset ring-accent'
                  : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              {/* Index chip — 26×26 radius-7, FILLED accent when selected (non-colour-only cue). */}
              <span
                aria-hidden="true"
                className={clsx(
                  'grid h-[26px] w-[26px] flex-none place-items-center rounded-[7px] font-mono text-xs font-semibold tabular-nums',
                  isSelected ? 'bg-accent text-white' : 'bg-[#eceef1] text-text-2',
                )}
              >
                {i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">{label}</span>
                <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-text-3">
                  {p.items.length} boxes · {p.totalWeight} kg
                </span>
              </span>

              {/* Right: neutral fill% + a 46×3px neutral mini fill bar (D-04 — never amber). */}
              <span className="flex flex-none flex-col items-end gap-1">
                <span className="font-mono text-[11px] tabular-nums text-text-2">
                  {fillPct.toFixed(0)}%
                </span>
                <span
                  aria-hidden="true"
                  className="h-[3px] w-[46px] overflow-hidden rounded-full bg-[#edeef1]"
                >
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${fillPct}%` }}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
