---
phase: 02-coordinate-mapping-fixture-viewer
plan: 01
subsystem: api
tags: [coordinate-mapping, three.js, golden-fixture, vitest, tdd, pure-functions, palette]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Vitest + @/ alias config, jsdom-WebGL-free test convention, code-split gate (check-code-split.mjs)
provides:
  - Committed golden done-response fixture (2 pallets, 7 unpacked, types D/F/T, 3-cycle perm) under src/lib/__fixtures__/
  - Hand-written fixture TS types (DoneResponse/PlacementOut/PalletDims/Vec3/BoxDims/Orientation)
  - Pure, golden-tested mapPlacement (API z-up min-corner mm -> Three.js y-up box-centre)
  - typeKeyOf + dev-only assertWithinEnvelope (import.meta.env.DEV-gated AABB sanity)
  - Deterministic colorForType palette (seeded indigo/teal/amber + harmonious HSL extension)
affects: [02-02-viewer, result-page, plan-03-result-mapper, plan-06-placement-list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden-value Vitest tests assert exact captured numbers (literals, not formula-derived) so a regression fails loudly"
    - "Pure src/lib/ math modules import three only as `import type` (or not at all) to preserve the code-split build gate"
    - "Dev-only invariant assertions guarded by import.meta.env.DEV tree-shake from prod"

key-files:
  created:
    - src/lib/__fixtures__/pack-request.json
    - src/lib/__fixtures__/pack-done-response.json
    - src/lib/fixture-types.ts
    - src/lib/mapping.ts
    - src/lib/mapping.test.ts
    - src/lib/palette.ts
    - src/lib/palette.test.ts
  modified: []

key-decisions:
  - "mapPlacement consumes ONLY position (min-corner) + post-orientation dimensions; orientation.perm is NEVER re-applied (re-applying double-rotates) — pinned by the D003 rotated golden test"
  - "size = [L,H,W] (API L->x, H->y, W->z); center recentred on world origin in x/z with deck top at y=DECK_TOP_Y=100"
  - "Palette is deterministic via dedupe+sort; whole-fixture type set (not pallet-0) seeds the legend so all 3 swatches show"
  - "zod NOT used this phase — fixture types are hand-written; zod boundary validation deferred to Phase 5 live client"

patterns-established:
  - "Pattern: load-bearing rotated golden case (D003 -> size [150,300,600], center [-425,950,-100]) proves the locked coordinate risk is resolved"
  - "Pattern: AABB envelope invariant test loops all pallet-0 items, expects 0 violations"

requirements-completed: [RESULT-01]

# Metrics
duration: 3min
completed: 2026-06-03
---

# Phase 2 Plan 01: Coordinate Mapping + Golden Fixture Summary

**Pure, golden-tested API-to-Three.js coordinate mapping (min-corner z-up mm -> y-up box-centre, perm-not-applied) plus deterministic box-type palette, locked against a committed real multi-pallet `done` fixture.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-03T21:04:10Z
- **Completed:** 2026-06-03T21:07:21Z
- **Tasks:** 3
- **Files modified:** 7 (created)

## Accomplishments
- Committed the richest real `done` capture (2 pallets, 7 unpacked, types D/F/T, 3-cycle perm `[2,0,1]`) verbatim as the golden fixture, with the verify-before-locking checklist passing.
- Resolved THE product's highest-risk piece with an executable golden test: `mapPlacement` maps both the non-rotated (T000) and rotated (D003) cases to the exact captured numbers, proving `dimensions` is post-orientation and `orientation.perm` is not re-applied.
- AABB envelope invariant verified over all pallet-0 boxes (0 violations); a dev-only `assertWithinEnvelope` mirrors it at runtime and tree-shakes from prod.
- Deterministic `colorForType` palette seeded by the mockup's three colours, extended harmoniously for extra types; whole-fixture type set {D,F,T} maps to the three seeds in stable sorted order.
- Both pure modules (`mapping.ts`, `palette.ts`) carry no runtime `three` import, preserving the code-split build gate.

## Task Commits

Each task was committed atomically (TDD tasks have test -> feat commits):

1. **Task 1: Commit golden fixture + TS types** - `1ffd013` (feat)
2. **Task 2: Pure coordinate-mapping function** - `131fc76` (test, RED) -> `c1f63a7` (feat, GREEN)
3. **Task 3: Deterministic box-type palette** - `669d3ad` (test, RED) -> `1728f04` (feat, GREEN)

## Files Created/Modified
- `src/lib/__fixtures__/pack-request.json` - Committed capture request (reproducibility, D-03)
- `src/lib/__fixtures__/pack-done-response.json` - Golden done-response (2 pallets, 7 unpacked, D003 perm [2,0,1])
- `src/lib/fixture-types.ts` - Hand-written named-export interfaces typing the fixture shape (no three/react import)
- `src/lib/mapping.ts` - Pure mapPlacement / typeKeyOf / assertWithinEnvelope (type-only fixture import)
- `src/lib/mapping.test.ts` - Golden non-rotated + rotated + AABB-envelope tests
- `src/lib/palette.ts` - Deterministic SEED_COLORS + colorForType with HSL hue-spin extension
- `src/lib/palette.test.ts` - Determinism + whole-fixture seed-assignment + extension tests

## Decisions Made
- `mapPlacement` reads only `position` + `dimensions`; `perm` is diagnostic-only and never applied — the D003 rotated golden (`size [150,300,600]`, `center [-425,950,-100]`) is the load-bearing proof.
- `DECK_TOP_Y = 100` (blockH 78 + deckH 22) kept as a tunable module constant.
- Legend/palette derive the type set from the whole fixture (all pallets + unpacked), not pallet-0, so all three swatches appear (Pitfall 5 recommendation a).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworked hslToHex branch assignment to satisfy lint gate**
- **Found during:** Task 3 (palette implementation, GREEN commit)
- **Issue:** The pre-commit ESLint hook (`no-useless-assignment`) blocked the commit: `let r=0; g=0; b=0;` initializers were always overwritten by the exhaustive if/else hue chain.
- **Fix:** Replaced the mutable `let` + if/else with a single `const [r,g,b] = ...` ternary chain (exhaustive, no dead initial assignment).
- **Files modified:** src/lib/palette.ts
- **Verification:** All 4 palette tests still pass; `tsc -b --noEmit` clean; commit hook passes.
- **Committed in:** `1728f04` (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Cosmetic refactor to pass the project lint gate; no behavioural change, no scope creep. Output values identical.

## Issues Encountered
- None beyond the lint-gate deviation above. `resolveJsonModule` was not needed: Vite/Vitest resolve the fixture JSON import natively and `tsc -b --noEmit` passes as-is.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The data + math half of RESULT-01 is proven and locked. Plan 02-02 (the r3f/drei viewer) can now consume `mapPlacement` + `colorForType` directly, importing the fixture and pure modules with zero coordinate-risk ambiguity.
- Forward note: `orientation.name`/`perm` are intentionally NOT carried through `mapPlacement`; Plan 03's result-mapper / Plan 06's placement list should read them straight from the fixture/response, not re-derive.

## Self-Check: PASSED
- All 7 created files verified present on disk.
- All task commits verified in `git log`: 1ffd013, 131fc76, c1f63a7, 669d3ad, 1728f04.
- Full lib suite: 2 files, 8 tests passing. `tsc -b --noEmit` clean. No runtime `three` import in mapping.ts/palette.ts.

---
*Phase: 02-coordinate-mapping-fixture-viewer*
*Completed: 2026-06-03*
