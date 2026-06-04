---
phase: 04-config-form-local-persistence
plan: 02
subsystem: ui
tags: [pure-logic, validation, box-fit, tally, vitest, tdd]

# Dependency graph
requires:
  - phase: 04-01
    provides: BoxType.label field + PalletConfig/RotationMode contract types; config schema + DEFAULT_CONFIG
  - phase: 03-pure-transform-core
    provides: src/lib/ house style (request-builder named-constant + interface-return + Record-totality conventions)
provides:
  - "src/lib/box-fit.ts: orientationsFor + checkAllBoxesFit (conservative D-01 hard-block feasibility check)"
  - "src/lib/config-tally.ts: tallyCatalog + LARGE_UNIT_THRESHOLD (NaN-safe live unit/weight tally, BOX-05/D-03)"
  - golden Vitest suites pinning conservative-fit semantics and NaN-safe tally
affects: [config-form, run-gate, footer-bar, catalog-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure src/lib decision functions (type-only imports, three/React/IO-free) consumed by the form footer + Run gate"
    - "never-exhaustive switch over RotationMode so adding a mode is a compile error"
    - "Number.isFinite coercion to 0 for mid-edit NaN fields (soft editing behaviour, D-04)"

key-files:
  created:
    - src/lib/box-fit.ts
    - src/lib/box-fit.test.ts
    - src/lib/config-tally.ts
    - src/lib/config-tally.test.ts
  modified: []

key-decisions:
  - "uprightOnly returns ONE orientation; footprintFits' either-axis-alignment check covers the 90 degree base turn (no redundant W x L entry)"
  - "overThreshold is STRICTLY greater-than LARGE_UNIT_THRESHOLD (1000 units → false, 1001 → true)"
  - "checkAllBoxesFit is conservative: rejects only the genuinely-impossible; the solver stays authoritative"

patterns-established:
  - "Pattern: pure feasibility/tally functions in src/lib with co-located golden *.test.ts, type-only @/types/config imports, three-free"
  - "Pattern: NaN-safe reduce (Number.isFinite ? value : 0) for live form-driven aggregates"

requirements-completed: [BOX-05, BOX-06]

# Metrics
duration: 9min
completed: 2026-06-04
---

# Phase 4 Plan 02: Box-Fit Check + Config Tally Summary

**Conservative rotation/overhang/height-aware box-fit feasibility check (D-01) and a NaN-safe live unit/weight tally with the >1000-unit large-job flag (BOX-05/D-03), both pure and pinned by golden Vitest suites.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-04T20:01:00Z
- **Completed:** 2026-06-04T20:02:50Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 created

## Accomplishments

- `orientationsFor` + `checkAllBoxesFit`: a conservative D-01 hard-block check that respects rotation mode (`fixed`/`uprightOnly`/`free`), `maxOverhang`, and max stack height, returning `{ ok, failures: [{index, id, message}] }`. The `switch (rotation)` ends with a `never` default so adding a `RotationMode` is a compile error.
- `tallyCatalog` + `LARGE_UNIT_THRESHOLD`: a NaN-safe live tally returning `{ types, units, estKg, overThreshold }`, coercing mid-edit non-finite quantity/weight to 0 so the footer never renders `NaN`.
- 15 golden tests across both suites (9 fit + 6 tally), including the four reference cases (exact-fit, overhang-edge, too-tall-but-rotatable free-vs-fixed, 2000mm typo) and the 1000/1001 threshold boundary.
- Both modules are pure (type-only `@/types/config` imports, three-free) preserving the code-split build gate.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: box-fit feasibility check (D-01)** — `92f9c54` (test, RED) → `5347058` (feat, GREEN)
2. **Task 2: config tally + large-job threshold (BOX-05/D-03)** — `ff91630` (test, RED) → `9c311cd` (feat, GREEN)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `src/lib/box-fit.ts` — `orientationsFor` (rotation-mode orientation enumeration, never-exhaustive), `footprintFits` (deck fit in either axis alignment + overhang), `checkAllBoxesFit` (per-box `{index,id,message}` failures, conservative).
- `src/lib/box-fit.test.ts` — golden suite: orientations per mode, exact-fit, overhang within/beyond, too-tall-but-rotatable (free passes / fixed fails), uprightOnly footprint turn, 2000mm typo all-mode fail, aggregate failures.
- `src/lib/config-tally.ts` — `LARGE_UNIT_THRESHOLD = 1000`, `CatalogTally` interface, `tallyCatalog` (Number.isFinite coercion, Math.round on estKg, strict `>` threshold).
- `src/lib/config-tally.test.ts` — golden suite: counts + estKg rounding, threshold boundary, NaN-safety, empty catalog, exported constant.

## Decisions Made

- `uprightOnly` returns a single orientation — `footprintFits` already tries both deck-axis alignments, so an explicit `W×L` entry would be redundant (matches RESEARCH design note).
- `overThreshold` is strictly greater-than `LARGE_UNIT_THRESHOLD`: exactly 1000 units → `false`, 1001 → `true`.
- The fit check is conservative by design — it blocks only genuinely-impossible boxes; the packing solver remains the authority on real non-fits (Phase 6 unpacked panel explains them).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the TDD RED→GREEN discipline with the reference algorithms from RESEARCH; no REFACTOR commit was needed (GREEN implementations were already house-style-clean).

## Issues Encountered

None. Selecting the too-tall-but-rotatable golden dimensions required care (the deck, not just the height, must admit a rotated footprint); the worked-out case is `600×700×1000` on a `1000×800×900` pallet, documented inline in the test.

## Threat Surface

No new threat surface. Both functions are pure over already-validated in-memory config (no network, storage, or DOM). Per the threat register, T-4-03 (box-fit verdict correctness) is mitigated by the golden tests pinning conservative semantics.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The two pure decision functions the form footer and Run gate depend on (RESEARCH Patterns 5 & 6) are ready to wire into the config form.
- Remaining Phase 4 work: the config form UI, the dynamic box catalog (`useFieldArray`), live footer wiring (`useWatch` → `tallyCatalog`), the Run gate (`checkAllBoxesFit` → `setError`), and versioned localStorage persistence.

## Self-Check: PASSED

All 4 created files verified present on disk; all 4 task commits (`92f9c54`, `5347058`, `ff91630`, `9c311cd`) verified in git history. Full Vitest suite (64 tests) and `tsc -b --noEmit` both pass.

---
*Phase: 04-config-form-local-persistence*
*Completed: 2026-06-04*
