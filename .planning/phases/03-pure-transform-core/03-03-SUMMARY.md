---
phase: 03-pure-transform-core
plan: 03
subsystem: transform
tags: [typescript, result-mapper, view-model, code-split, tdd]

# Dependency graph
requires:
  - phase: 03-pure-transform-core
    plan: 01
    provides: done-response contract (DoneResponse/PlacementOut/PalletResult/UnpackedItem/InputSummary/Cog) in src/types/pack-contract.ts
  - phase: 02-coordinate-mapping
    provides: typeKeyOf parse-fallback recovery in src/lib/mapping.ts
provides:
  - mapDoneResponse(done, idToType?) -> ResultView grouped view model in src/lib/result-mapper.ts
  - ResultView / MappedPallet / TypeAggregate view-model interfaces
affects: [06-result-page, 05-api-client]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-pass dual-axis regrouping (by-type Map folded inside the by-pallet map())"
    - "Map-primary / parse-fallback id->type recovery (idToType?.get(id) ?? typeKeyOf(id))"
    - "Non-mutating transform via object spread (never assign typeId onto source)"
    - "Raw diagnostic pass-through (cog, support_ratio) — visual derivation deferred to Phase 6 (D-08)"

key-files:
  created:
    - src/lib/result-mapper.ts
    - src/lib/result-mapper.test.ts
  modified: []

key-decisions:
  - "cog + support_ratio surfaced RAW from the mapper; Three.js remap / support bucketing is Phase 6's job (D-08)"
  - "byType keys are plain typeKeyOf strings so colorForType dedupes+sorts them cleanly — Phase 6 legend stays stable"
  - "Type recovery is map-PRIMARY (idToType) / parse-FALLBACK (typeKeyOf); proven by an override test (D-07)"
  - "Transform is non-mutating (spread each item, never assign typeId onto source) — Pitfall 5"

patterns-established:
  - "Single-pass regroup: build byType Map while mapping pallets, no second iteration"
  - "Pure src/lib transform imports zero three/React/IO to hold the code-split build gate (SC-4)"

requirements-completed: [PACK-02, BOX-04]

# Metrics
duration: 6min
completed: 2026-06-04
---

# Phase 3 Plan 03: Result-Mapper Vertical Summary

**`mapDoneResponse` regroups a captured `done` response by box type AND by pallet in a single pass — map-primary / parse-fallback id→type recovery, raw cog + support_ratio pass-through, non-mutating — delivering the consuming end of the SC-1 round-trip and all of SC-3.**

## Performance
- **Duration:** ~6 min
- **Started:** 2026-06-04T10:29:Z (approx)
- **Completed:** 2026-06-04T10:35:45Z
- **Tasks:** 2 (TDD RED → GREEN)
- **Files modified:** 2 (2 created, 0 modified)

## Accomplishments
- Wrote a fixture-grounded failing test suite (RED) encoding the SC-1 round-trip (byType keys `['D','F','T']`), SC-3 dual grouping (byType D=11/T=12/F=8, 2 pallets P001/P002), raw cog + support_ratio pass-through (D-08), multi-pallet, 7 unpacked, map-primary override, and non-mutation — 9 tests, all golden-literal (counts hard-coded, not re-derived).
- Implemented `mapDoneResponse(done, idToType?) -> ResultView` with single-pass dual-axis regrouping: the `byType` Map is folded inside the `pallets.map()` pass (no second iteration). Type recovery is map-primary / parse-fallback (`idToType?.get(id) ?? typeKeyOf(id)`).
- Exported the `ResultView` / `MappedPallet` / `TypeAggregate` view-model interfaces (D-08 shape); cog and support_ratio surface raw with no Three.js remap and no support bucketing.
- Verified the code-split build gate (SC-4) stays green: `result-mapper` imports zero `three`/React/IO and never leaks into the entry chunk.

## Task Commits

Each task was committed atomically (TDD gates):

1. **Task 1 (RED): failing result-mapper suite** - `aaf56c8` (test)
2. **Task 2 (GREEN): implement mapDoneResponse** - `446fa46` (feat)

## Files Created/Modified
- `src/lib/result-mapper.ts` - `mapDoneResponse` + `ResultView`/`MappedPallet`/`TypeAggregate`; single-pass dual-axis regroup, map-primary/parse-fallback recovery, raw diagnostic pass-through, non-mutating. Zero three/React/IO imports.
- `src/lib/result-mapper.test.ts` - 9 tests: SC-1 round-trip, SC-3 dual grouping + raw diagnostics, multi-pallet, unpacked, map-primary override, non-mutation. jsdom-WebGL-free, golden literals.

## Decisions Made
- cog + support_ratio are passed through RAW; coordinate/visual derivation (Three.js remap, support tiers) is Phase 6's responsibility (D-08).
- byType keys equal what `colorForType` consumes (plain `typeKeyOf` strings) — keeps the Phase 6 legend stable.
- id→type recovery is map-PRIMARY (`idToType`) / parse-FALLBACK (`typeKeyOf`), proven by an explicit `T000 -> 'OVERRIDE'` test that moves T's count 12→11 (D-07).
- The transform never mutates its input — each item is spread into a new `{ ...it, typeId }` object (Pitfall 5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test cast through `unknown` to satisfy tsc**
- **Found during:** Task 2 (GREEN), at the `npm run typecheck` acceptance gate.
- **Issue:** The non-mutation test cast `done.result.pallets[0].items[0] as Record<string, unknown>` failed `tsc` with TS2352 (insufficient type overlap; `PlacementOut` has no string index signature).
- **Fix:** Changed the cast to `as unknown as Record<string, unknown>` (the TS-sanctioned double-cast for `'typeId' in obj` reflection). The test file was authored in Task 1 but its tsc error only surfaced at the Task 2 typecheck gate; fixed and folded into the GREEN commit.
- **Files modified:** `src/lib/result-mapper.test.ts`
- **Commit:** `446fa46`

## Issues Encountered
None beyond the deviation above. Full suite (36 tests across mapping/palette/camera-preset/result-mapper) green; typecheck clean; code-split gate PASSED (three lives only in the lazy ResultPage chunk, entry chunk three-free).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The result-mapper seam is ready: Phase 6's result page can feed a real `done` response through `mapDoneResponse` and get its grouped view model (byType + pallets + unpacked), independent of the request-builder.
- byType keys are colorForType-compatible — the Phase 6 legend can be driven directly off `[...view.byType.keys()]`.
- Phase 5 still owns runtime (zod) validation of network `done` responses at the trust boundary (T-03-06, tracked not addressed here — intentional Phase-3 gap).
- Phase 6 owns the coordinate/visual derivation that `mapPlacement` (Phase 2) provides; the mapper deliberately does not call it (D-08).

## Self-Check: PASSED
- FOUND: src/lib/result-mapper.ts
- FOUND: src/lib/result-mapper.test.ts
- FOUND commit: aaf56c8
- FOUND commit: 446fa46

---
*Phase: 03-pure-transform-core*
*Completed: 2026-06-04*
