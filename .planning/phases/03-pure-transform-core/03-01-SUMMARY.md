---
phase: 03-pure-transform-core
plan: 01
subsystem: api
tags: [typescript, types, api-contract, pack-api, code-split]

# Dependency graph
requires:
  - phase: 02-coordinate-mapping
    provides: hand-written done-response interfaces in src/lib/fixture-types.ts (Vec3, PlacementOut, DoneResponse, etc.)
provides:
  - App config model (PackConfig, BoxType, PalletConfig, RotationMode) in src/types/config.ts
  - POST /api/v1/pack request contract (PackRequest, BoxRequest, PackOptions) in src/types/pack-contract.ts
  - Consolidated done-response contract moved to src/types/pack-contract.ts behind a re-export shim
affects: [03-02-request-builder, 03-03-result-mapper, 04-config-form, 05-api-client]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure zero-runtime-import type modules in src/types/ (grep-0 purity gate for code-split)"
    - "Re-export shim preserving an established import path across a file move (no edits to importers)"

key-files:
  created:
    - src/types/config.ts
    - src/types/pack-contract.ts
  modified:
    - src/lib/fixture-types.ts

key-decisions:
  - "RotationMode app union is 'free' | 'uprightOnly' | 'fixed' (D-05/D-06); maps to API 'all' | 'this_side_up' | 'none' in Plan 02"
  - "PackConfig carries only maxPallets; time_budget_s/seed/support_ratio are baked in the request-builder (D-03), not user-facing"
  - "fixture-types.ts reduced to a re-export shim (D-02) instead of rewriting the 5 importers — two are locked Phase-2 runtime components"

patterns-established:
  - "Pure contract types in src/types/ import nothing runtime, enforced by grep-0 purity criterion"
  - "Barrel re-export shim (export * from '@/types/pack-contract') preserves @/lib/fixture-types path"

requirements-completed: [PACK-02, BOX-04]

# Metrics
duration: 3min
completed: 2026-06-04
---

# Phase 3 Plan 01: Pure Transform Core Types Summary

**Canonical app config model (PackConfig/BoxType/PalletConfig/RotationMode) and the POST /api/v1/pack request+response contract, with the Phase-2 done-response interfaces consolidated into src/types/ behind a zero-edit re-export shim.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-04T10:25:19Z
- **Completed:** 2026-06-04T10:27:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- Declared the canonical in-memory app config model (`PackConfig`, `BoxType`, `PalletConfig`, `RotationMode` union) as pure hand-written TS with zero runtime imports — the shape Phase 4's form fills.
- Declared the POST /api/v1/pack request contract (`PackRequest`, `BoxRequest`, `PackOptions`) matching the captured `pack-request.json` shape, including the verified `rotations` API union.
- Consolidated the Phase-2 done-response interfaces into `src/types/pack-contract.ts` and reduced `src/lib/fixture-types.ts` to a single re-export shim — all 5 existing importers compile unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the app config model in src/types/config.ts** - `e860080` (feat)
2. **Task 2: Define request+response contract in src/types/pack-contract.ts and shim fixture-types.ts** - `5bd4e65` (feat)

## Files Created/Modified
- `src/types/config.ts` - App config model: RotationMode union, PalletConfig, BoxType, PackConfig (pure interfaces, zero runtime imports)
- `src/types/pack-contract.ts` - API request side (PackRequest/BoxRequest/PackOptions) + consolidated response side (DoneResponse/PlacementOut/PalletResult/etc., moved verbatim)
- `src/lib/fixture-types.ts` - Reduced to `export * from '@/types/pack-contract';` re-export shim (preserves path for mapping.ts, mapping.test.ts, palette.test.ts, Boxes.tsx, ResultPage.tsx)

## Decisions Made
- `RotationMode` is the closed app-side union `'free' | 'uprightOnly' | 'fixed'` (D-05/D-06); the API-side `rotations` union `'all' | 'this_side_up' | 'none'` lives on `BoxRequest`, and the mapping between them is deferred to Plan 02.
- `PackConfig` carries only `maxPallets` as the user-facing option; the baked options (`time_budget_s`, `seed`, `support_ratio`) live in `PackOptions` (sent contract) but are set by the builder, not the config model (D-03).
- Chose the re-export shim over rewriting the 5 importers (D-02) because two (`Boxes.tsx`, `ResultPage.tsx`) are locked Phase-2 runtime components.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Typecheck passed after each task; the full existing test suite (14 tests across mapping/palette/camera-preset) stayed green after the type consolidation, proving the file move broke nothing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shared contract seam is ready: Plans 03-02 (request-builder) and 03-03 (result-mapper) can now import from `src/types/config.ts` and `src/types/pack-contract.ts` in parallel.
- Purity gate (SC-4) satisfied: both new type files have zero `three`/`react`/`fs`/`path` imports — the code-split boundary is preserved.
- Phase 5 still owns runtime (zod) validation of network responses at the trust boundary (T-03-02, tracked not addressed here).

## Self-Check: PASSED
- FOUND: src/types/config.ts
- FOUND: src/types/pack-contract.ts
- FOUND: src/lib/fixture-types.ts (shim)
- FOUND commit: e860080
- FOUND commit: 5bd4e65

---
*Phase: 03-pure-transform-core*
*Completed: 2026-06-04*
