---
phase: 03-pure-transform-core
plan: 02
subsystem: transform
tags: [typescript, request-builder, pack-api, tdd, code-split, pure-transform]

# Dependency graph
requires:
  - phase: 03-pure-transform-core
    plan: 01
    provides: PackConfig/BoxType/PalletConfig/RotationMode (src/types/config.ts) + PackRequest/BoxRequest/PackOptions (src/types/pack-contract.ts)
provides:
  - buildPackRequest(config) -> { request, idToType } in src/lib/request-builder.ts (PACK-02)
  - rotationToApi(mode) + compile-total ROTATION_TO_API table (BOX-04 / SC-2)
  - BAKED_OPTIONS constant (time_budget_s=25, seed=7, support_ratio=0.8; D-03)
affects: [03-03-result-mapper, 04-config-form, 05-api-client]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-return transform: { request, idToType } so item_id type identity (D-07) is recoverable O(1) without parsing"
    - "Compile-time-total mapping via Record<RotationMode, ApiRotation> — tsc -b enforces exhaustive coverage"
    - "Deterministic ${typeId}-${index} id counter (no random/UUID) for stable-across-rebuilds ids (SC-1)"

key-files:
  created:
    - src/lib/request-builder.ts
    - src/lib/request-builder.test.ts
  modified: []

key-decisions:
  - "Item ids use ${typeId}-${index} (D-07); idToType Map is the PRIMARY type-recovery channel, typeKeyOf is only the parse-FALLBACK"
  - "typeKeyOf is NOT used to group/recover the builder's hyphenated ids — it returns 'Da-' for 'Da-0'; idToType is canonical (test-grouping bug fixed during GREEN)"
  - "Rotation table typed Record<RotationMode, ApiRotation> so adding a mode without a mapping is a compile error (totality is the control for T-03-04)"

patterns-established:
  - "Pure IO-free transform module in src/lib/ with grep-0 purity (no three/react/fs/path/random) — stays out of the lazy /result chunk (SC-4)"
  - "TDD RED (test commit) -> GREEN (feat commit) gate sequence per task"

requirements-completed: [PACK-02, BOX-04]

# Metrics
duration: 3min
completed: 2026-06-04
---

# Phase 3 Plan 02: Request-Builder Vertical Summary

**`buildPackRequest(config)` expands per-type quantities into unique, deterministic `${typeId}-${index}` ids and returns `{ request, idToType }` for O(1) type recovery, with a compile-time-total rotation table and baked options — a fixture-shaped POST /api/v1/pack body, test-first.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-04T10:28:43Z
- **Completed:** 2026-06-04T10:31:34Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- Wrote a failing, fixture-grounded test suite first (RED) encoding PACK-02 (quantity expansion, id uniqueness, determinism across rebuilds, O(1) idToType recovery) and BOX-04 (rotation table totality), then implemented to GREEN.
- `buildPackRequest` expands each box type's `quantity` into exactly N `BoxRequest`s with unique, deterministic `${typeId}-${index}` ids and returns a dual `{ request, idToType }` so the type-agnostic API's `item_id` channel (D-07) is recoverable in O(1) without re-parsing.
- `rotationToApi` + `ROTATION_TO_API: Record<RotationMode, ApiRotation>` maps the 3 domain modes to exactly `all`/`this_side_up`/`none`; `tsc -b` (run in `npm run build`) enforces total coverage.
- Built `options` bakes `time_budget_s=25/seed=7/support_ratio=0.8` (D-03) and remaps the camelCase pallet (`maxWeight`/`maxOverhang`) to API snake_case (`max_weight`/`max_overhang`); the built BoxRequest matches the captured `pack-request.json` box key set.
- Module is pure (grep-0: no three/react/fs/path/nanoid/uuid/random) — the code-split phase gate (`scripts/check-code-split.mjs`) stayed green, three still isolated to the lazy `/result` chunk.

## Task Commits

Each task was committed atomically (TDD gate sequence):

1. **Task 1 (RED): failing request-builder suite** - `a3aa431` (test)
2. **Task 2 (GREEN): buildPackRequest + rotationToApi implementation** - `68b8f82` (feat)

## Files Created/Modified
- `src/lib/request-builder.ts` - `buildPackRequest`, `rotationToApi`, `BAKED_OPTIONS`, `ROTATION_TO_API`, `makeItemId` (pure, zero runtime imports).
- `src/lib/request-builder.test.ts` - 13 tests: PACK-02 expansion/uniqueness/golden-ids/determinism/idToType recovery, BOX-04 rotation table totality + per-box application, options block (D-03), pallet camelCase→snake_case, fixture key-shape, no-mutation.

## Decisions Made
- **idToType is the canonical recovery channel, not typeKeyOf.** The builder's ids are `${typeId}-${index}` (e.g. `Da-0`); `typeKeyOf` (leading non-digit prefix) returns `Da-` for `Da-0` because `-` is non-digit. So type grouping/recovery in tests and downstream MUST use `idToType` (PRIMARY); `typeKeyOf` remains only the parse-FALLBACK for the fixture's zero-padded `D000` style, and the test asserts only that ids are non-digit-leading so `typeKeyOf` can never emit a digit-leading garbage key (Pitfall 3 guard).
- **Rotation table typed `Record<RotationMode, ApiRotation>`** so totality is a compile-time control (mitigates T-03-04 without a runtime branch).
- **No random/UUID id source** — deterministic counter only, satisfying SC-1 (byte-identical ids across rebuilds) and mitigating T-03-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task-1 test used `typeKeyOf` to group the builder's hyphenated ids**
- **Found during:** Task 2 (GREEN) — 3 tests failed (`expands quantity`, `id format parse-fallback-safe`, `applies rotation table per box`).
- **Issue:** The RED test grouped/recovered types via `typeKeyOf(b.id)`, expecting `Da`. But `typeKeyOf` extracts the leading non-digit run, which for `Da-0` is `Da-` (hyphen is non-digit). This was a flaw in the test's recovery channel, not the implementation — `typeKeyOf` was designed for the fixture's `D000` (digit-adjacent) format, not the builder's `${typeId}-${index}` (D-07) format.
- **Fix:** Switched the grouping/recovery helpers in those tests to the PRIMARY channel `idToType.get(b.id)`, and rewrote the parse-fallback-safe test to assert the realistic guarantee (ids non-digit-leading ⇒ `typeKeyOf` never returns a digit-leading prefix). The `${typeId}-${index}` id format is the locked plan decision and golden-test target (`Da-0`), so the implementation was kept and the test corrected.
- **Files modified:** `src/lib/request-builder.test.ts`
- **Commit:** `68b8f82` (folded into the GREEN commit alongside the implementation)

## Issues Encountered
None beyond the test-grouping bug above. Typecheck passed, full suite 27/27 green, code-split gate green.

## TDD Gate Compliance
- RED gate present: `a3aa431` `test(03-02)` (suite failed: module not found).
- GREEN gate present: `68b8f82` `feat(03-02)` (suite passes 13/13).
- REFACTOR: not needed — implementation is minimal.

## User Setup Required
None - pure offline transform, no external service or config.

## Next Phase Readiness
- Vertical MVP slice complete: Phase 5's client could now call `buildPackRequest(config)` and POST a correct body even before the result-mapper (Plan 03) exists.
- Plan 03-03 (result-mapper) and downstream form/client work can import `buildPackRequest`/`rotationToApi` from `@/lib/request-builder` and the `idToType` Map for type recovery.
- SC-4 purity preserved: request-builder is grep-0 clean and stayed out of the entry chunk.

## Self-Check: PASSED
- FOUND: src/lib/request-builder.ts
- FOUND: src/lib/request-builder.test.ts
- FOUND commit: a3aa431
- FOUND commit: 68b8f82

---
*Phase: 03-pure-transform-core*
*Completed: 2026-06-04*
