---
phase: 02-coordinate-mapping-fixture-viewer
verified: 2026-06-04T01:46:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 2: Coordinate Mapping & Fixture Viewer Verification Report

**Phase Goal:** The single highest-risk piece — the pure function mapping the API's coordinate space (z-up, pallet-corner origin) into Three.js mesh transforms — is locked against a real captured API response and proven visually in a static 3D scene that matches the design mockup.
**Verified:** 2026-06-04T01:46:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A real `done` response (2 pallets, 7 unpacked, 3-cycle perm [2,0,1]) is committed as a golden fixture | VERIFIED | `src/lib/__fixtures__/pack-done-response.json` confirmed via node: status=done, pallets=2, unpacked=7, D003 has perm [2,0,1] |
| 2 | Golden-value Vitest tests assert exact mapped position+size for the non-rotated (T000) and rotated (D003) cases, plus a dev-mode AABB sanity assertion passing over all pallet-0 boxes | VERIFIED | `npx vitest run src/lib/` → 13/13 pass; T000 asserts size [250,700,250] center [-375,450,-275]; D003 asserts size [150,300,600] center [-425,950,-100] with load-bearing comment; AABB envelope loops all pallet-0 items, expects 0 violations |
| 3 | The /result route renders fixture pallet 0 as a 3D wood pallet with boxes coloured by type and a legend (D/F/T), visually matching design/result.html | VERIFIED (human-approved) | Human checkpoint completed and approved 2026-06-04 (preset-reframe defect found and fixed during this checkpoint). Playwright e2e also asserts D/F/T legend rows visible |
| 4 | A user can orbit, zoom, pan, and switch ISO/TOP/FRONT camera presets, each visibly reframing the scene (auto-fit to the fixture bbox) | VERIFIED | `npx playwright test e2e/result-viewer.spec.ts` → 2/2 pass. Strengthened preset e2e asserts DISTINCT camera positions per preset (MIN_CAM_DELTA=1) and differing canvas PNGs across ISO/TOP/FRONT; assertion confirmed to fail on a simulated non-reframing regression (received distance 0) |
| 5 | three/r3f/drei stay isolated in the lazy /result chunk (code-split gate passes) | VERIFIED | `npm run build && node scripts/check-code-split.mjs` exits 0: "entry chunk(s) (three-free): index-D-1OnNUf.js / three lives in lazy chunk(s): ResultPage-CM5m6Way.js" |
| 6 | `mapPlacement` and `colorForType` are pure and import three only as a type (if at all) | VERIFIED | grep on `src/lib/mapping.ts`, `src/lib/palette.ts`, `src/lib/camera-presets.ts` shows only `import type { PalletDims, PlacementOut }` in mapping.ts; palette.ts and camera-presets.ts have zero three imports |

**Score:** 6/6 truths verified

---

### Human-Verified Items

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Visual fidelity to design/result.html (coloured boxes on wood pallet, soft shadows, grid, fog, legend 3 rows, dark overlay header, dims tag) | APPROVED 2026-06-04 | Developer ran `npm run build && npm run preview`, compared side-by-side with design/result.html, approved after preset-reframe defect was found and fixed in the same session |
| 2 | Camera feel: damping smooth, polar clamp prevents sub-ground orbit | APPROVED 2026-06-04 | Same developer sign-off as above |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/__fixtures__/pack-done-response.json` | Real done response, 2 pallets, 7 unpacked, D003 perm [2,0,1] | VERIFIED | All checklist items pass: status=done, pallets.length=2, unpacked_items.length=7, D003 orientation.perm=[2,0,1] |
| `src/lib/__fixtures__/pack-request.json` | Committed capture request | VERIFIED | File exists |
| `src/lib/fixture-types.ts` | Exports DoneResponse, PlacementOut, PalletDims, Vec3, BoxDims, Orientation | VERIFIED | All 8 named interfaces exported; zero three/react imports; DoneResult and UnpackedItem also exported |
| `src/lib/mapping.ts` | Exports mapPlacement, assertWithinEnvelope, typeKeyOf, MappedBox; no runtime three import; min 25 lines | VERIFIED | 81 lines; all exports present; only `import type` from fixture-types (no three); dev-mode guard on assertWithinEnvelope |
| `src/lib/mapping.test.ts` | Golden non-rotated + rotated + AABB-envelope tests; contains "non-rotated" | VERIFIED | 4 describe blocks; exact literal values asserted; rotated case marked "LOAD-BEARING PROOF" |
| `src/lib/palette.ts` | Exports colorForType, SEED_COLORS; no three/react import | VERIFIED | Both exports present; zero external imports |
| `src/lib/palette.test.ts` | Determinism + whole-fixture seed-assignment + extension tests | VERIFIED | 3 describe blocks; derives type set from whole fixture; asserts D=#6d63f5, F=#0ea5a3, T=#e0892b |
| `src/lib/camera-presets.ts` | Exports presetFromBbox; no three/react runtime import | VERIFIED | Exports presetFromBbox, distanceLimitsFromBbox, types; zero runtime three/react imports |
| `src/lib/camera-presets.test.ts` | 4 preset math tests | VERIFIED | 5 tests across 2 describe blocks; all relational assertions pass |
| `src/routes/ResultPage.tsx` | Contains data-testid="r3f-canvas"; imports fixture; renders pallet 0 | VERIFIED | data-testid="r3f-canvas" present; imports pack-done-response.json; renders DATA.result.pallets[0] |
| `src/components/viewer/Boxes.tsx` | Calls mapPlacement and colorForType | VERIFIED | Both imported and called on lines 17-18, 28, 49 |
| `src/components/viewer/CameraPresets.tsx` | drei OrbitControls + animated presets from scene Box3 | VERIFIED | OrbitControls with makeDefault, enableDamping, dampingFactor=0.08, maxPolarAngle; animated via useFrame lerp; Box3.setFromObject for real bbox |
| `src/components/viewer/ViewerOverlay.tsx` | Dark header + legend + control hints + preset buttons | VERIFIED | All 4 sections present; uses clsx for active-state toggle; pointer-events:none except preset buttons |
| `src/styles.css` | Contains --color-d-bg and the 3 other d-* tokens inside @theme | VERIFIED | All 4 D-08 tokens present: --color-d-bg, --color-d-border, --color-d-text, --color-d-text-2; existing font/accent tokens intact (not duplicated) |
| `e2e/result-viewer.spec.ts` | Contains goto('/result') and presets test group | VERIFIED | Console-error collector before goto; `test.describe('presets', ...)` catches -g presets; asserts active-state toggle + distinct camera positions + differing canvas PNGs |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/mapping.test.ts` | `src/lib/mapping.ts` | `from '@/lib/mapping'` | WIRED | Import present; golden assertions on literal captured numbers |
| `src/lib/palette.test.ts` | `src/lib/palette.ts` | `from '@/lib/palette'` | WIRED | Import present; seed-assignment test asserts exact hex values |
| `src/components/viewer/Boxes.tsx` | `src/lib/mapping.ts` | `import { ..., mapPlacement, ... } from '@/lib/mapping'` | WIRED | Imported and called on each pallet item |
| `src/components/viewer/Boxes.tsx` | `src/lib/palette.ts` | `import { colorForType } from '@/lib/palette'` | WIRED | Imported; called in buildPalette |
| `src/routes/ResultPage.tsx` | `src/lib/__fixtures__/pack-done-response.json` | `import doneResponse from '@/lib/__fixtures__/pack-done-response.json'` | WIRED | Imported; DATA.result.pallets[0] rendered |
| `e2e/result-viewer.spec.ts` | `/result` | `page.goto('/result')` | WIRED | Both tests navigate to /result; canvas visible assertion passes |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Boxes.tsx` | `pallet.items` | `pack-done-response.json` (committed fixture, bundled at build time) | Yes — 19 real items from the API capture | FLOWING |
| `ViewerOverlay.tsx` | `legend`, `dims`, `title` | `ResultPage.tsx` → buildPalette(DATA) → fixture pallet 0 dims | Yes — derived from real fixture data | FLOWING |
| `CameraPresets.tsx` | `bbox` | `Box3().setFromObject(boxesRef.current)` — measured from real rendered boxes | Yes — computed from real scene geometry post-mount | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest 13/13 pass | `npx vitest run src/lib/` | 3 files, 13 tests, 0 failures | PASS |
| TypeScript clean | `npx tsc -b --noEmit` | 0 errors | PASS |
| Production build succeeds | `npm run build` | Exit 0; 4 output files | PASS |
| Code-split gate | `node scripts/check-code-split.mjs` | "code-split check PASSED — three lives in lazy chunk ResultPage-CM5m6Way.js" | PASS |
| Playwright e2e 2/2 | `npx playwright test e2e/result-viewer.spec.ts` | 2 passed (10.4s) | PASS |

---

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Fixture node check | `node -e "const r=require('.../pack-done-response.json'); console.log(...)"`  | status=done, pallets=2, unpacked=7, perm [2,0,1] present | PASS |
| mapping golden (non-rotated) | `npx vitest run src/lib/mapping.test.ts -t "non-rotated"` | 1 test passed | PASS |
| mapping golden (rotated) | `npx vitest run src/lib/mapping.test.ts -t "rotated"` | 1 test passed; size [150,300,600], center [-425,950,-100] confirmed | PASS |
| mapping AABB envelope | `npx vitest run src/lib/mapping.test.ts -t "envelope"` | 1 test passed; 0 violations | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RESULT-01 | 02-01-PLAN.md, 02-02-PLAN.md | User can view a 3D visualization of the packed pallet, with boxes coloured by type and a legend | SATISFIED | Fixture renders pallet 0 with per-type colours; legend shows 3 rows (D/F/T); Playwright e2e asserts D/F/T legend visible; human-approved |
| RESULT-02 | 02-02-PLAN.md | User can orbit, zoom, and pan the 3D scene and switch between ISO / TOP / FRONT camera presets | SATISFIED | drei OrbitControls wired with damping + polar clamp; CameraPresets drives bbox-fit animated transitions; Playwright preset e2e asserts DISTINCT camera positions and differing canvas PNGs per preset |

Both requirements marked Complete in REQUIREMENTS.md traceability table. No orphaned requirements for Phase 2.

---

### Anti-Patterns Found

No TBD/FIXME/XXX markers found in any phase-2 files. No placeholder return values. No stub implementations. The code-review (02-REVIEW.md) identified 0 critical / 4 warnings / 3 info — all advisory, none blocking goal achievement.

Advisory items from 02-REVIEW.md (not blockers):

| Finding | File | Severity | Impact |
|---------|------|----------|--------|
| WR-01: spinHue produces near-identical colour for the 4th box type (i=3 hue spin lands 6deg from SEED_COLORS[2]) | `src/lib/palette.ts:21` | Warning | Affects legend readability with >3 box types; current fixture has exactly 3 types so this phase is unaffected |
| WR-02: assertWithinEnvelope test assertion is vacuously true (.not.toThrow when function never throws) | `src/lib/mapping.test.ts:69-72` | Warning | Violation branch uncovered; a console.error spy is needed for real coverage |
| WR-03: Pallet support-block z-offsets hardcoded at 90mm regardless of pallet width | `src/components/viewer/Pallet.tsx:71` | Warning | Parametric correctness issue for non-800mm pallets; no non-800mm fixture in scope |
| WR-04: Default bbox [0,0,0] / [1000,1000,1000] causes a brief camera snap before real bbox is measured | `src/components/viewer/CameraPresets.tsx:42-78` | Warning | Visual artifact; negligible in practice because the default bbox approximates the fixture; guard: initialise bbox as null |
| IN-01: useMemo with empty dep array on module-level constant is redundant | `src/routes/ResultPage.tsx:29` | Info | Code quality; no behavioural impact |
| IN-02: typeKeyOf silently degrades for numeric-prefixed item IDs | `src/lib/mapping.ts:55-58` | Info | Forward risk; no current fixture uses numeric prefixes |
| IN-03: waitForFunction settled-flag polling has a theoretical race window | `e2e/result-viewer.spec.ts:58-61` | Info | Negligible in practice (520ms animation, 100ms poll interval) |

None of these findings caused a goal failure — the four warnings are improvement opportunities for Phase 6 or a standalone clean-up task.

---

### Human Verification Required

None — all human verification items were completed and approved during the phase execution itself (02-02-PLAN Task 4 human checkpoint, approved 2026-06-04 after a preset-reframe defect was found and fixed in the same session). Visual fidelity and camera feel are not re-flagged per verification notes.

---

## Gaps Summary

No gaps. All 6 must-have truths verified by automated evidence (running tests, build gate, TypeScript check, Playwright e2e). Both RESULT-01 and RESULT-02 are satisfied. The phase goal is fully achieved.

---

_Verified: 2026-06-04T01:46:00Z_
_Verifier: Claude (gsd-verifier)_
