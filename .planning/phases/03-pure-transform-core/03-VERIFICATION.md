---
phase: 03-pure-transform-core
verified: 2026-06-04T13:43:30Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 3: Pure Transform Core Verification Report

**Phase Goal:** The pure, IO-free transform layer is complete and fully unit-tested: the request-builder expands per-type quantities into uniquely-identified boxes and maps the three rotation modes, and the result-mapper regroups results by type and per pallet and surfaces diagnostics.
**Verified:** 2026-06-04T13:43:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Given a config, the request-builder expands each box type's quantity into individual boxes with stable unique `TYPE#index` IDs and a round-trip test maps fixture results back to their type in O(1) | ✓ VERIFIED | `buildPackRequest` emits deterministic `${typeId}-${index}` ids; `idToType` Map provides O(1) recovery; 13 passing tests including `expands quantity`, `ids are unique`, `deterministic across rebuilds`, `round-trip` assertions with golden literals `Da-0`/`Tb-1`/`Fc-0` |
| 2 | Each box type's rotation choice maps to exactly one of the API's three modes (`all` / `this_side_up` / `none`) in the built request | ✓ VERIFIED | `ROTATION_TO_API: Record<RotationMode, ApiRotation>` typed for compile-time totality; `rotationToApi('free')==='all'`, `'uprightOnly'==>'this_side_up'`, `'fixed'==>'none'`; rotation test `maps the 3 domain modes to exactly all/this_side_up/none` passes; 3 targets verified distinct |
| 3 | The result-mapper groups packed boxes by type and by pallet and exposes per-pallet CoG and per-box support-ratio fields from the fixture | ✓ VERIFIED | `mapDoneResponse` single-pass dual-axis regrouping; 9 passing tests assert byType D=11/T=12/F=8, 2 pallets P001/P002, `cog` deep-equal to source fixture, `support_ratio` === source value verbatim |
| 4 | All transform functions have co-located passing unit tests and import zero React or IO modules | ✓ VERIFIED | `grep` returns 0 hits for `three`/`react`/`fs`/`path` in all four phase files; full suite 36/36 passing; `npm run typecheck` exits 0 |

**Score:** 4/4 truths verified

### CR-01 Risk Assessment (from 03-REVIEW.md)

**Finding:** The code review flagged `typeKeyOf('Da-0') === 'Da-'` (not `'Da'`) because the regex `/^[^\d]+/` treats `-` as non-digit and includes it. The PRIMARY recovery path (`idToType.get(id)`) correctly returns `'Da'`; only the FALLBACK path (`typeKeyOf`) would produce `'Da-'` for builder-format ids.

**Verification:**

Confirmed by direct execution: `typeKeyOf('Da-0')` returns `'Da-'`, not `'Da'`. The two channels disagree for builder-emitted ids.

**Impact assessment on SC-1 / SC-3:**

SC-1 (O(1) round-trip) is defined as: *"a round-trip test maps fixture results back to their type in O(1)"*. The fixture uses ids in `D000`/`T000`/`F011` format (digit-adjacent, no separator), for which `typeKeyOf` correctly returns `'D'`/`'T'`/`'F'`. The result-mapper test exercises exactly this path (no `idToType` argument, fixture input) and passes with correct `['D','F','T']` keys — the SC-1 round-trip requirement as literally stated holds.

SC-3 (regroup by type and pallet) is verified against the fixture: byType counts D=11/T=12/F=8 are correct.

**The defect is a latent cross-phase risk, not a blocker for the Phase 3 goal as stated.** The Phase 3 goal requires the builder's PRIMARY path (`idToType`) to be correct (it is) and the fixture-based round-trip to work (it does). The FALLBACK's disagreement with the PRIMARY for builder-format ids becomes observable only when `mapDoneResponse` is called without an `idToType` map AND the input contains builder-produced ids (i.e. Phase 5 wires them end-to-end without threading the map). This scenario is explicitly out of scope for Phase 3.

**Verification note — forward risk:** Phase 5 or 6 must thread the `idToType` map from `buildPackRequest` through to `mapDoneResponse`, or fix `typeKeyOf` to strip trailing separators (`/^([^\d-]+)/` or equivalent), before the fallback path is reliable for real API responses. CR-01 is a real defect that will surface at integration if not addressed. The REVIEW.md fix recommendation (change the regex to `/^([^\d-]+)/`) is correct and low-risk.

The review finding IN-02 is also confirmed: the test at `request-builder.test.ts:111` uses `box.id.split('-')[0]` (which returns `'Da'`) rather than `typeKeyOf(box.id)` (which returns `'Da-'`) to verify the round-trip. The test gives passing confidence but does not detect the PRIMARY/FALLBACK divergence for builder-format ids.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/config.ts` | App config model: `PackConfig`, `BoxType`, `PalletConfig`, `RotationMode` | ✓ VERIFIED | All 4 exports present; zero runtime imports; 64 lines |
| `src/types/pack-contract.ts` | API request + consolidated response contract | ✓ VERIFIED | All 11 interfaces present (`PackRequest`, `BoxRequest`, `PackOptions` + 8 response types); zero runtime imports; 139 lines |
| `src/lib/fixture-types.ts` | Re-export shim `export * from '@/types/pack-contract'` | ✓ VERIFIED | Single-line shim only; no interface declarations; 5 importers compile unchanged via typecheck |
| `src/lib/request-builder.ts` | `buildPackRequest`, `rotationToApi`, `BAKED_OPTIONS` | ✓ VERIFIED | All exports present; 94 lines (min_lines: 35); zero runtime imports |
| `src/lib/request-builder.test.ts` | 13 tests covering PACK-02 + BOX-04 | ✓ VERIFIED | 178 lines (min_lines: 40); 13/13 passing; contains `expands quantity`, `ids are unique`, `deterministic`, `rotation` test names |
| `src/lib/result-mapper.ts` | `mapDoneResponse`, `ResultView`, `MappedPallet`, `TypeAggregate` | ✓ VERIFIED | All exports present; 88 lines (min_lines: 30); zero runtime imports |
| `src/lib/result-mapper.test.ts` | 9 tests covering SC-1 round-trip + SC-3 dual grouping | ✓ VERIFIED | 101 lines (min_lines: 35); 9/9 passing; contains `round-trip`, `groups by type and pallet`, `multi-pallet`, `unpacked` test names |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/fixture-types.ts` | `src/types/pack-contract.ts` | `export * from '@/types/pack-contract'` | ✓ WIRED | Shim present; all 5 importers resolve via typecheck |
| `src/lib/request-builder.ts` | `src/types/config.ts` | `import type ... from '@/types/config'` | ✓ WIRED | Present at line 12 |
| `src/lib/request-builder.ts` | `src/types/pack-contract.ts` | `import type ... from '@/types/pack-contract'` | ✓ WIRED | Present at line 13 |
| `src/lib/result-mapper.ts` | `./mapping` | `import { typeKeyOf } from './mapping'` | ✓ WIRED | Present at line 13; fallback channel in `recoverType` |
| `src/lib/result-mapper.ts` | `src/types/pack-contract.ts` | `import type ... from '@/types/pack-contract'` | ✓ WIRED | Present at lines 14-20 |
| `src/lib/result-mapper.test.ts` | `src/lib/__fixtures__/pack-done-response.json` | `import doneResponse from '...'` | ✓ WIRED | Present at line 5; fixture counts verified (31 packed, 7 unpacked, 2 pallets) |
| `mapping.ts` | `./fixture-types` | `import type { PalletDims, PlacementOut } from './fixture-types'` | ✓ WIRED | Resolves through shim; locked Phase 2 file unchanged |

### Data-Flow Trace (Level 4)

These are pure transform modules with no async data sources. Data flows synchronously from typed inputs to typed outputs. The fixture JSON files (`pack-request.json`, `pack-done-response.json`) are compile-time imports used only in tests.

| Artifact | Data Source | Produces Real Data | Status |
|----------|-------------|-------------------|--------|
| `request-builder.ts` | `PackConfig` arg (synchronous, typed) | Yes — expands to `PackRequest` + `idToType` | ✓ FLOWING |
| `result-mapper.ts` | `DoneResponse` arg (synchronous, typed) | Yes — regroups to `ResultView` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 36 tests pass | `npm test` | 36 passed (6 test files) | ✓ PASS |
| request-builder 13 tests | `npm test -- src/lib/request-builder.test.ts` | 13 passed | ✓ PASS |
| result-mapper 9 tests | `npm test -- src/lib/result-mapper.test.ts` | 9 passed | ✓ PASS |
| TypeScript compilation | `npm run typecheck` | Exit 0, no errors | ✓ PASS |

### Probe Execution

No probes declared for this phase. Step 7c: SKIPPED (no probe-*.sh files declared or found for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PACK-02 | Plans 03-01, 03-02, 03-03 | App expands each box type's quantity into individual, uniquely-identified boxes before calling the API | ✓ SATISFIED | `buildPackRequest` loop (line 62) + golden-id test + idToType Map; REQUIREMENTS.md marks `[x]` Complete |
| BOX-04 (mapping half) | Plans 03-01, 03-02 | Rotation mode maps to API `rotations` string union | ✓ SATISFIED | `ROTATION_TO_API: Record<RotationMode, ApiRotation>` with compile-time totality; 3 rotation tests pass; REQUIREMENTS.md note confirms Phase 3 delivers the mapping half |

**Orphaned requirements check:** REQUIREMENTS.md Phase 3 distribution lists `PACK-02 (+ BOX-04 mapping)`. Both are covered. No orphaned requirements.

**Note on BOX-04 traceability:** REQUIREMENTS.md assigns BOX-04 to Phase 4 (user-facing rotation choice) but explicitly notes Phase 3 delivers the underlying mapping. Both plans (03-01, 03-02) declare `requirements: [PACK-02, BOX-04]`. This is documented intent, not a gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

All five phase-3 modified/created files scanned for `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`, `return null`, `return {}`, `return []` — zero hits. No hardcoded empty data, no console-only handlers, no placeholder implementations.

### Human Verification Required

None. All phase behaviors are verifiable programmatically:

- Type correctness: verified by `npm run typecheck` (exit 0)
- Transformation correctness: verified by 36 unit tests with golden literals
- Purity boundary: verified by grep across all 4 phase modules (0 runtime imports)
- Fixture data accuracy: verified by parsing `pack-done-response.json` directly (31 packed, 7 unpacked, 2 pallets, D=11/T=12/F=8)

### Gaps Summary

No blocking gaps. Phase goal is achieved.

**Forward risks (non-blocking, tracked from 03-REVIEW.md):**

1. **CR-01 (risk, not blocker):** `typeKeyOf` FALLBACK returns `'Da-'` for builder-format ids `'Da-0'`, while the PRIMARY `idToType.get('Da-0')` correctly returns `'Da'`. The two channels disagree. This is masked in Phase 3 because: (a) the result-mapper test uses fixture ids (`D000` format) where `typeKeyOf` works correctly, and (b) the request-builder test uses `split('-')[0]` instead of `typeKeyOf` to check the round-trip. The defect will surface in Phase 5/6 integration if `idToType` is not threaded from builder to mapper. Fix: update `typeKeyOf` regex to `/^([^\d-]+)/` (strip trailing separator), or ensure `idToType` is always threaded. Add a cross-module test asserting `typeKeyOf(makeItemId(t, i)) === t`.

2. **IN-02 (test gap):** `request-builder.test.ts:111` uses `box.id.split('-')[0]` for the O(1) recovery assertion instead of `typeKeyOf`, giving false confidence that the two channels agree. This should be supplemented with an assertion `typeKeyOf(id) === idToType.get(id)` to surface CR-01 at the builder level.

3. **WR-01/WR-02/WR-03/WR-04 (warnings):** No runtime guards on `BoxType.id` format (duplicate ids, digit-leading, hyphen-containing) and no guard on fractional/negative `quantity`. These are accepted input preconditions for Phase 3 per D-04 (validation deferred to Phase 5); Phase 4 form validation will enforce the constraints at the UX layer.

---

_Verified: 2026-06-04T13:43:30Z_
_Verifier: Claude (gsd-verifier)_
