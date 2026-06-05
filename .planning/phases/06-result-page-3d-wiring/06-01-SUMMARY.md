---
phase: 06-result-page-3d-wiring
plan: 01
subsystem: ui
tags: [react, three, result-page, derivation, code-split, tdd, golden-test]

# Dependency graph
requires:
  - phase: 02-coordinate-mapping
    provides: mapping.ts (DECK_TOP_Y deck height, the empirically-locked axis convention)
  - phase: 03-pure-transform-core
    provides: result-mapper.ts (ResultView/MappedPallet view model), pack-contract.ts (Cog/PalletDims/InputSummary)
provides:
  - summarise(view, maxPallets?) -> JobSummary whole-job aggregation (RESULT-03)
  - mapCog(cog,{L,W}) -> [x,y,z] three-space CoG point with cog.z up-axis (DIAG-01)
  - supportColor(ratio) -> ordered colour-blind-considerate hex scale (DIAG-02)
  - DECK_TOP_Y exported from mapping.ts (shared deck height for boxes + CoG marker)
  - --color-pos / --color-warn result-rail @theme tokens
affects: [06-02, 06-03, 06-04, 06-05, result-page, summary-block, cog-marker, heatmap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure src/lib derivation module: zero runtime imports (three type-only at most) so it stays outside the lazy /result chunk (C-04)"
    - "Co-located golden test asserts hand-stated literals (not formula re-derivation) so a formula bug fails loudly"
    - "Synthetic-input test for a derivation whose only fixture is degenerate (all support_ratio===1, Pitfall 4)"

key-files:
  created:
    - src/lib/result-summary.ts
    - src/lib/result-summary.test.ts
    - src/lib/cog-map.ts
    - src/lib/cog-map.test.ts
    - src/lib/support-scale.ts
    - src/lib/support-scale.test.ts
  modified:
    - src/lib/mapping.ts
    - src/styles.css

key-decisions:
  - "summarise preserves the RAW utilisation product (72.81); rounding/formatting is the component's job, never the pure fn (D-03)"
  - "totalWeightKg is summed across ALL pallets (whole-job scope, D-03), not per-pallet"
  - "mapCog uses the cog.z up-axis with NO half-dimension term and explicitly never routes through mapPlacement (a CoG is already a centre point)"
  - "DECK_TOP_Y promoted from private const to export so the CoG marker and boxes share one deck height"
  - "support scale is blue→teal→amber→magenta→brown (colour-blind-considerate), not a red↔green ramp; always paired with numeric N% in UI"
  - "--color-warn ported for parity but stays UNUSED on pallet rows (D-04)"

patterns-established:
  - "Pattern 1: pure derivation modules carry the config-tally three-free/code-split header rationale verbatim"
  - "Pattern 2: golden tests assert literal expected values, never values re-derived from the implementation formula"
  - "Pattern 3: degenerate-fixture derivations are proven against SYNTHETIC inputs that exercise the full range"

requirements-completed: [RESULT-03, DIAG-01, DIAG-02]

# Metrics
duration: 3min
completed: 2026-06-05
---

# Phase 6 Plan 01: Result-Page Pure Derivations Summary

**Three three-free `src/lib/` derivations — whole-job `summarise` (golden 211 kg / 72.81% / 2 pallets / 7-of-38), the `mapCog` CoG point-map on the empirically-confirmed cog.z up-axis, and an ordered colour-blind-considerate `supportColor` heatmap scale — each golden-tested, with `DECK_TOP_Y` exported and the two missing rail tokens ported.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-05T09:40:35Z
- **Completed:** 2026-06-05T09:43:26Z
- **Tasks:** 3
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- `summarise()` aggregates the captured fixture to the exact whole-job golden totals (211 kg Σ weight, 72.81% utilisation, 2 pallets, 7 unpacked of 38 total items) with `maxPallets` passed through only when supplied.
- `mapCog()` maps both fixture pallets' CoG to the hand-computed three-space literals ([-8.403, 597.059, -31.303] for P001, [-117.391, 482.609, -60.87] for P002) using the empirically-confirmed cog.z up-axis with no spurious half-dimension offset.
- `supportColor()` buckets a support ratio in [0,1] onto a perceptually ordered, colour-blind-considerate hex scale; proven distinct/ordered against synthetic ratios because the fixture's support_ratio is uniformly 1.0.
- `DECK_TOP_Y` exported from `mapping.ts` (shared deck height); `--color-pos` / `--color-warn` rail tokens ported with no other token churn.
- All three modules stay `three`-free — the code-split gate is green (three lives only in the lazy ResultPage chunk).

## Task Commits

Each task was committed atomically (TDD RED→GREEN, both phases in one commit per task):

1. **Task 1: Whole-job summary aggregation + golden test (RESULT-03)** - `57b577a` (feat)
2. **Task 2: Export DECK_TOP_Y + CoG point-map + golden test (DIAG-01)** - `7a315a6` (feat)
3. **Task 3: Support-ratio colour scale + rail tokens (DIAG-02)** - `b3d078a` (feat)

_TDD note: each task's failing test was authored and confirmed RED before the implementation, then committed together once GREEN._

## Files Created/Modified

- `src/lib/result-summary.ts` - `summarise()` + `JobSummary` interface; whole-job aggregation, raw utilisation product
- `src/lib/result-summary.test.ts` - golden test asserting fixture literals 211/72.81/2/7/38 + maxPallets pass-through
- `src/lib/cog-map.ts` - `mapCog()`; cog.z up-axis CoG point-map, do-NOT-route-through-mapPlacement warning
- `src/lib/cog-map.test.ts` - golden test asserting P001/P002 literal arrays + no-half-dim-offset proof
- `src/lib/support-scale.ts` - `supportColor()`; ordered colour-blind-considerate 5-bucket hex scale, clamped [0,1]
- `src/lib/support-scale.test.ts` - synthetic-input golden test (distinctness/ordering) + all-1.0 fixture smoke
- `src/lib/mapping.ts` - `DECK_TOP_Y` promoted from private const to `export`
- `src/styles.css` - added `--color-pos: #16a34a` and `--color-warn: #d97706` rail tokens

## Decisions Made

None beyond the plan — all key decisions (raw utilisation product, whole-job weight sum, cog.z up-axis with no half-dim term, shared DECK_TOP_Y, colour-blind scale, warn-token-unused) were specified in the plan and followed as written. Captured in frontmatter `key-decisions` for STATE propagation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The fixture's uniform `support_ratio === 1` (Pitfall 4) was anticipated by the plan; the support-scale distinctness/ordering assertions use synthetic ratios as instructed, with a single smoke assertion over the all-1.0 fixture.

## Known Stubs

None. All three derivations are fully implemented pure functions backed by golden/synthetic tests; no placeholder data, empty returns, or TODO markers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The three pure derivations every Wave 2–5 UI slice consumes are proven and locked: `summarise` (SummaryBlock), `mapCog` (CogMarker), `supportColor` (heatmap), plus the shared `DECK_TOP_Y` and rail tokens.
- Code-split gate green and typecheck clean — the eager entry chunk stays three-free, so downstream UI plans can safely import these from `src/lib/`.
- Carry-forward concern (unchanged): the InstancedMesh ~100–200 box threshold remains an estimate to verify empirically in a later wave.

## Verification

- `npx vitest run src/lib/result-summary.test.ts src/lib/cog-map.test.ts src/lib/support-scale.test.ts src/lib/mapping.test.ts` — 4 files / 15 tests green
- `npm run typecheck` — clean (DECK_TOP_Y export consumed by cog-map.ts type-checks)
- `npm run build && node scripts/check-code-split.mjs` — code-split gate PASSED (three only in lazy ResultPage chunk; entry chunk three-free)

## Self-Check: PASSED

All 9 created/modified files present on disk; all 3 task commits (57b577a, 7a315a6, b3d078a) found in git log.

---
*Phase: 06-result-page-3d-wiring*
*Completed: 2026-06-05*
