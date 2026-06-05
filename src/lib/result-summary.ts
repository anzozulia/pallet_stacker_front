// Pure whole-job summary aggregation for the result-page summary block (RESULT-03 / D-03).
// IO-free, jsdom-testable: this module imports NOTHING at runtime (no `three`, no React, no
// IO) so it stays outside the lazy /result chunk and never threatens the code-split build
// gate (C-04). The `ResultView` import is type-only.
//
// Scope is WHOLE-JOB (D-03): utilisation/packed/unpacked come from the job-level
// input_summary; total weight is summed across ALL pallets. Rounding/formatting is the
// component's job — this pure function preserves the raw utilisation product (e.g. 72.81),
// so a downstream display bug never silently re-rounds the golden value.

import type { ResultView } from './result-mapper';

/** Whole-job summary: pallets used, optional cap, utilisation %, unpacked, totals. */
export interface JobSummary {
  palletsUsed: number;
  maxPallets?: number;
  utilisationPct: number;
  unpacked: number;
  totalItems: number;
  totalWeightKg: number;
}

/**
 * Aggregate a mapped result view into a whole-job summary.
 *
 * Reads `view.summary` (the job-level `InputSummary`): `palletsUsed = pallets_used`,
 * `utilisationPct = total_volume_utilisation * 100` (RAW product, no rounding),
 * `unpacked = items_unpacked`, `totalItems = items_packed + items_unpacked`. Total weight
 * is summed across every pallet (D-03 whole-job scope). `maxPallets` is passed through only
 * when supplied — undefined otherwise.
 */
export function summarise(view: ResultView, maxPallets?: number): JobSummary {
  const s = view.summary;
  const totalWeightKg = view.pallets.reduce((kg, p) => kg + p.totalWeight, 0);
  return {
    palletsUsed: s.pallets_used,
    maxPallets,
    utilisationPct: s.total_volume_utilisation * 100,
    unpacked: s.items_unpacked,
    totalItems: s.items_packed + s.items_unpacked,
    totalWeightKg,
  };
}
