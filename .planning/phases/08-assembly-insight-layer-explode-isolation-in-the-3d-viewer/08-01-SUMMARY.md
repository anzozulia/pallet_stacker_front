---
phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer
plan: 01
subsystem: ui
tags: [three, r3f, layers, explode, camera, maath, pure-logic, code-split]

requires:
  - phase: 02-coordinate-mapping
    provides: mapping.ts PlacementLike narrowing + DECK_TOP_Y convention (base-z = position.z)
  - phase: 02-camera-presets
    provides: camera-presets.ts Bbox/presetFromBbox/distanceLimitsFromBbox three-free sibling helpers
  - phase: 03-contract
    provides: src/types/pack-contract.ts PlacementOut (item_id, position Vec3, dimensions BoxDims)
provides:
  - "computeLayers(items) -> LayerModel { layers, itemToLayer } — base-z banding, floor-up, tall-box-by-base"
  - "LAYER_Z_TOLERANCE (5mm) jitter absorber + EXPLODE_FIXED_UNIT (350mm) single shared explode unit"
  - "inflateBboxForExplode(bbox, extraHeight) — grow-Y-only, recentre-upward, no-op-at-0 camera helper"
  - "maath promoted from transitive (drei) to a direct dependency"
affects: [08-02-explode-slice, 08-03-layers-focus-slice]

tech-stack:
  added: [maath@^0.10.8 (direct dep — was transitive via drei)]
  patterns:
    - "Pure three-free lib module for layer math (mirrors mapping.ts / cog-map.ts discipline) so the code-split gate stays green"
    - "Single shared constant (EXPLODE_FIXED_UNIT) lives in the three-free lib so Boxes + ResultPage import ONE value, never a duplicated literal"
    - "Golden-literal vitest assertions hand-stated against the committed fixture (not formula-re-derived)"

key-files:
  created:
    - src/lib/computeLayers.ts
    - src/lib/computeLayers.test.ts
  modified:
    - src/lib/camera-presets.ts
    - src/lib/camera-presets.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "computeLayers bands by BASE (position.z) only — a tall box at z=0 whose top reaches the next floor stays in band 0 (D-13); LAYER_Z_TOLERANCE=5 is a float-jitter absorber, NOT a height bridge"
  - "EXPLODE_FIXED_UNIT=350 (median fixture layer height) exported from the three-free lib as the SINGLE source of truth; Plan 02 tunes magnitude here only"
  - "inflateBboxForExplode grows only the Y extent + recentres up by extraHeight/2; extraHeight=0 is value-equal no-op (protects SC-3)"
  - "Degenerate (NaN) position.z / dimensions.H coerced to 0 so a malformed placement cannot produce NaN bands or a sort crash (T-08-DOS)"
  - "maath promoted to a direct dep (^0.10.8 matching the drei-resolved version); pinned react/r3f/drei/three quartet byte-unchanged"

patterns-established:
  - "Pattern: Phase-8 layer math is a pure, three-free src/lib module — later waves compose it, never re-derive banding"
  - "Pattern: shared explode magnitude is a single lib constant, not a per-component literal"

requirements-completed: [RESULT-07]

duration: ~6min
completed: 2026-06-19
---

# Phase 8 Plan 01: computeLayers Foundation Summary

**Pure base-z layer banding (`computeLayers`) + the grow-Y-only `inflateBboxForExplode` camera helper + the shared `EXPLODE_FIXED_UNIT` constant, all three-free, plus `maath` promoted to a direct dependency — the proven math foundation every later explode/isolate slice composes.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-19
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `computeLayers(items)` bands placements into floor-up layers by base-z, with a complete `itemToLayer` lookup for the D-12 placement-row click; tall boxes band by their BASE (D-13).
- Exported `LAYER_Z_TOLERANCE` (5mm jitter absorber) and `EXPLODE_FIXED_UNIT` (350mm) as the single shared explode-lift unit from the three-free lib, so Plan 02's Boxes offset and ResultPage camera extra-height import one value.
- `inflateBboxForExplode` grows only the bbox Y extent + recentres upward, no-op at explode 0 (SC-3).
- `maath` promoted from a transitive drei dependency to a direct one — phantom-dependency risk removed before any wave uses `maath.easing`.

## Task Commits

Each task was committed atomically (TDD tasks: RED test + GREEN impl in one commit each):

1. **Task 1: Pure computeLayers base-z banding + golden tests (SC-1) + EXPLODE_FIXED_UNIT** - `05cac3a` (feat)
2. **Task 2: Pure inflateBboxForExplode helper + golden cases (D-05)** - `c69dae7` (feat)
3. **Task 3: Promote maath to a direct dependency** - `c068eb0` (chore)

_Note: Tasks 1 and 2 followed RED → GREEN; the RED test and GREEN implementation were staged into a single atomic per-task commit._

## Files Created/Modified
- `src/lib/computeLayers.ts` - Pure three-free base-z banding: `computeLayers`, `Layer`, `LayerModel`, `LAYER_Z_TOLERANCE`, `EXPLODE_FIXED_UNIT`, `ItemLike`.
- `src/lib/computeLayers.test.ts` - 8 SC-1 golden assertions against `pack-done-response.json` (P001→2 layers, P002→4 layers, F003 tall-box-by-base, complete itemToLayer, empty model).
- `src/lib/camera-presets.ts` - Added pure `inflateBboxForExplode(bbox, extraHeight)`.
- `src/lib/camera-presets.test.ts` - 3 new golden cases (no-op at 0, grow-Y-only literals, upward-only growth).
- `package.json` / `package-lock.json` - `maath@^0.10.8` as a direct dependency.

## Decisions Made
- Banding is strictly by base-z; `LAYER_Z_TOLERANCE` is a jitter tolerance only (not a merge bridge). Verified against the integer-base fixture.
- `EXPLODE_FIXED_UNIT=350` lives in the three-free lib as the single tunable source of truth.
- NaN/degenerate inputs coerced to 0 (T-08-DOS mitigation).
- maath pinned to `^0.10.8` to match the drei-resolved lockfile version; quartet left untouched.

## Deviations from Plan

None - plan executed exactly as written. (The lockfile diff also reflects a pre-existing `palletize`→`pallet-packer` root-package name/license sync from quick-task 260618-eg4; no dependency-version churn.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results
- `npx vitest run src/lib/computeLayers.test.ts` — 8/8 green.
- `npx vitest run src/lib/camera-presets.test.ts` — 12/12 green (9 existing + 3 new).
- `npx vitest run` — full suite 235/235 green (224 baseline + 11 new, no regression).
- `npm run build && node scripts/check-code-split.mjs` — exit 0; three absent from the entry chunk (`index-*.js`), present only in the lazy `ResultPage-*.js`.
- `npm ls maath --depth=0` — `maath@0.10.8` listed as a direct dependency.
- `grep -v '^//' src/lib/computeLayers.ts | grep -c "import .* from 'three'"` → 0.

## Next Phase Readiness
- The shared layer model + explode constant + camera helper are ready for Plan 02 (explode slice) and Plan 03 (layers focus slice) to compose — no re-derivation of banding required.
- maath is a direct dep, so `maath.easing.damp` is safe to use in the explode/focus animation wiring.

## Self-Check: PASSED

All created files exist on disk and all four task/summary commits (05cac3a, c69dae7, c068eb0, a0749d6) are present in git history.

---
*Phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer*
*Completed: 2026-06-19*
