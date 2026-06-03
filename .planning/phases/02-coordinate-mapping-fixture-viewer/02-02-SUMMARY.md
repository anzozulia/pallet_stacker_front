---
phase: 02-coordinate-mapping-fixture-viewer
plan: 02
subsystem: ui
tags: [react-three-fiber, drei, three, webgl, vite, tailwind, playwright, camera-presets]

# Dependency graph
requires:
  - phase: 02-01
    provides: mapPlacement (golden-locked coordinate mapping), colorForType (deterministic palette), assertWithinEnvelope, the committed pack-done-response.json fixture
  - phase: 01-02
    provides: lazy code-split /result route + r3f <Canvas data-testid="r3f-canvas"> shell, scripts/check-code-split.mjs build gate
provides:
  - "The interactive /result 3D fixture viewer: wood pallet + per-type-coloured edged boxes, dark overlay chrome (header + legend + control hints), and animated ISO/TOP/FRONT bbox-fit camera presets"
  - "presetFromBbox + distanceLimitsFromBbox — pure, jsdom-testable bbox→camera-vector math (no three runtime import)"
  - "Dark 3D-overlay @theme token group (--color-d-bg / -d-border / -d-text / -d-text-2)"
  - "e2e/result-viewer.spec.ts — Playwright Canvas-mount smoke + ISO/TOP/FRONT preset-reframe e2e"
affects: [phase-06-result-page-3d-wiring]

# Tech tracking
tech-stack:
  added: []  # no new packages — drei/r3f/three/clsx were Phase-1 supply-chain-approved
  patterns:
    - "Camera presets derived from the live scene Box3 (THREE.Box3().setFromObject), never the mockup's hardcoded vectors (D-11)"
    - "CameraPresets owns ALL bbox-derived framing — no drei <Bounds> wrapper (the two conflicted)"
    - "Overlay chrome is absolute-positioned DOM over the Canvas (pointer-events:none except buttons), not drei <Html>"
    - "All three/r3f/drei imports confined to the lazy ResultPage subtree to keep three out of the index chunk"

key-files:
  created:
    - src/lib/camera-presets.ts
    - src/lib/camera-presets.test.ts
    - src/components/viewer/Pallet.tsx
    - src/components/viewer/Boxes.tsx
    - src/components/viewer/CameraPresets.tsx
    - src/components/viewer/ViewerOverlay.tsx
    - e2e/result-viewer.spec.ts
  modified:
    - src/styles.css
    - src/routes/ResultPage.tsx

key-decisions:
  - "Camera presets computed from the live scene Box3, not the mockup's hardcoded camera vectors (D-11) — presets scale with the fixture bbox"
  - "Removed the conflicting drei <Bounds fit clip observe> wrapper so CameraPresets is the single owner of bbox-derived framing — Bounds was re-fitting and cancelling the preset re-targeting"
  - "Widened FRAMING_K 2.0 → 2.6 so the 45° fov frame clears the scene top with margin (clipping fix)"
  - "Overlay is plain absolute DOM (pointer-events:none except buttons), not drei <Html>, per RESEARCH Open Question 2"
  - "Whole-fixture type set (3 rows D/F/T) drives the legend + palette, derived over ALL pallets' items, not just pallet 0"

patterns-established:
  - "Pure camera-preset math (bbox → position/target tuples + min/maxDistance) lives in src/lib and is unit-tested in jsdom; the one three runtime use (Box3.setFromObject) stays inside the lazy viewer subtree"
  - "Preset e2e asserts DISTINCT camera positions + differing canvas PNGs across ISO/TOP/FRONT — a deterministic regression guard against a non-reframing build"

requirements-completed: [RESULT-01, RESULT-02]

# Metrics
duration: ~18min
completed: 2026-06-04
---

# Phase 2 Plan 02: drei Fixture Viewer + Camera Presets Summary

**The /result route now renders the golden-mapped fixture as an explorable drei 3D scene — wood pallet, per-type-coloured edged boxes, dark overlay chrome (legend + control hints + ISO/TOP/FRONT), and animated bbox-fit camera presets — completing the RESULT-01 viewer half and all of RESULT-02.**

## Performance

- **Duration:** ~18 min (first impl commit 00:11:48 → last impl commit 00:29:31, +finalization)
- **Started:** 2026-06-04T00:11:48+03:00
- **Completed:** 2026-06-04
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments

- The `/result` viewer renders fixture pallet 0 as a wood pallet (slats + blocks, ground plane, drei grid) with lighting, soft PCF shadows, and fog, matching `design/result.html`.
- Per-pallet-0 items render as individual `<mesh>` boxes positioned via Plan-01's `mapPlacement`, tinted by `colorForType`, with drei `<Edges>` — no InstancedMesh (19 meshes, well under the threshold).
- Dark overlay chrome: top-left header (pallet name + `1000 × 800 × 1000 mm` dims tag), top-right legend (3 swatch+name rows D/F/T derived from the whole-fixture type set), bottom-left control hints, bottom-right ISO/TOP/FRONT buttons with active-state toggle.
- Orbit/zoom/pan via drei `<OrbitControls makeDefault enableDamping>` with a polar clamp (cannot orbit beneath the ground plane), min/maxDistance derived from the scene radius.
- ISO/TOP/FRONT presets animate the camera to bbox-derived positions via `presetFromBbox` — TOP straight down, FRONT axis-aligned elevation, ISO three-quarter — auto-fit to the live scene Box3, never hardcoded vectors.
- three/r3f/drei stay isolated in the lazy ResultPage chunk: the code-split build gate (`scripts/check-code-split.mjs`) confirms three is absent from `index-*`.
- Human visual + camera-feel sign-off obtained (approved) after a found-and-fixed preset-reframe defect.

## Task Commits

1. **Task 1: dark-overlay @theme tokens + pure camera-preset math** — `e601d34` (feat)
2. **Task 2: drei viewer scene (pallet, boxes, controls, presets) on /result** — `b8e78c9` (feat)
3. **Task 3: Playwright Canvas-mount + ISO/TOP/FRONT preset e2e** — `65b5b8a` (test)
4. **Task 4: human-verify checkpoint** — approved (no code change)

**Gate-defect fix (during Task 4 verification):**
- `3e8e5ce` (fix) — presets reframe camera: drop conflicting `<Bounds>`, widen framing
- `92fe9ea` (fix) — strengthen preset e2e to fail on non-reframing regression
- `c33069c` (fix) — correct stale Bounds claim in preset-guard comment

**Progress/checkpoint docs:** `a7fb80d`, `8ea0038`

**Plan metadata:** (this finalization docs commit)

## Files Created/Modified

- `src/lib/camera-presets.ts` - Pure bbox→camera math: `presetFromBbox(bbox, 'ISO'|'TOP'|'FRONT')` (FRAMING_K 2.6) + `distanceLimitsFromBbox` (r*0.4…r*4); no three/react runtime import
- `src/lib/camera-presets.test.ts` - Unit tests: TOP overhead, FRONT axis-aligned, ISO 3-quarter, distance-scales-with-bbox, target===centre
- `src/components/viewer/Pallet.tsx` - Wood pallet model (slats + blocks), ground plane, grid
- `src/components/viewer/Boxes.tsx` - Per-box meshes from `mapPlacement` + `colorForType` + drei `<Edges>`; whole-fixture type set; dev-only `assertWithinEnvelope`
- `src/components/viewer/CameraPresets.tsx` - drei OrbitControls + animated ISO/TOP/FRONT presets from the live scene Box3 (sole three runtime use in the viewer)
- `src/components/viewer/ViewerOverlay.tsx` - Absolute DOM chrome: header + legend + control hints + preset buttons (clsx active toggle)
- `e2e/result-viewer.spec.ts` - Canvas-mount smoke (no WebGL errors) + preset-reframe e2e (distinct positions + differing PNGs)
- `src/styles.css` - Added the D-08 dark-overlay @theme tokens (existing font/accent tokens intact)
- `src/routes/ResultPage.tsx` - Replaced the empty Canvas body with the full viewer scene (preserved 100dvh wrapper + `data-testid="r3f-canvas"`)

## Decisions Made

- Presets are derived from the live scene Box3, not the mockup's hardcoded camera vectors (D-11) — they scale with the fixture bbox.
- Removed the drei `<Bounds>` wrapper: it re-fit the camera and cancelled the preset re-targeting. CameraPresets is now the single owner of all bbox-derived framing.
- Overlay chrome is plain absolute-positioned DOM (not drei `<Html>`) per RESEARCH Open Question 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Camera presets did not reframe + scene top clipped**
- **Found during:** Task 4 (human-verify checkpoint)
- **Issue:** Clicking ISO/TOP/FRONT produced pixel-identical screenshots (no reframe), and the bbox framing clipped the top of the scene. Root cause: the plan's Task-2 instruction wrapped the boxes group in drei `<Bounds fit clip observe>`, which continuously re-fit the camera and overrode the `presetFromBbox` re-targeting; the framing factor was also too tight for the 45° fov.
- **Fix:** Removed the conflicting `<Bounds>` wrapper so `CameraPresets` owns all bbox-derived framing; widened `FRAMING_K` 2.0 → 2.6 to clear the frame with margin; added `gl.preserveDrawingBuffer` + a `window.__cameraState` hook to make reframing observable; strengthened `e2e/result-viewer.spec.ts` to assert ISO/TOP/FRONT yield DISTINCT camera positions AND differing canvas PNGs (verified to fail on a simulated non-reframing build — received distance 0). Corrected the now-stale `<Bounds>` claim in the preset-guard comment.
- **Files modified:** src/components/viewer/CameraPresets.tsx, src/lib/camera-presets.ts, src/routes/ResultPage.tsx, e2e/result-viewer.spec.ts
- **Verification:** vitest 13/13, tsc 0 errors, build + code-split gate PASS (three lazy-only), Playwright e2e 2/2 incl. the strengthened reframe assertion; human re-screenshot approved.
- **Committed in:** `3e8e5ce`, `92fe9ea`, `c33069c`

---

**Total deviations:** 1 auto-fixed (1 bug, across 3 commits)
**Impact on plan:** The fix was essential for RESULT-02 correctness (presets must visibly reframe). It removed a planned construct (`<Bounds>`) that conflicted with the preset driver rather than adding scope. No scope creep.

## Issues Encountered

- The drei `<Bounds>` auto-fit and the explicit `presetFromBbox` camera driver are mutually exclusive — Bounds silently won. Resolved by making CameraPresets the single framing owner (see deviation above). Captured as a pattern for Phase 6's persistent viewer.

## User Setup Required

None - no external service configuration required. The viewer renders a committed, build-time-bundled fixture; no runtime network, no secrets.

## Next Phase Readiness

- The full Phase 2 vertical slice is complete: the golden-locked mapping (Plan 01) now renders as an explorable, preset-switchable 3D scene (Plan 02). RESULT-01 and RESULT-02 delivered.
- Phase 6 (Result Page & 3D Wiring) inherits the viewer scaffolding: pallet/boxes/overlay components, the bbox-preset pattern, and the "CameraPresets owns framing, no Bounds" lesson. It will swap the committed fixture for a live mapped result and add the summary rail, multi-pallet switcher, placement list, unpacked panel, and CoG/support diagnostics.
- No blockers introduced. The Phase 2 mapping/orientation blocker (STATE.md) was resolved in Plan 01 and is not reopened here.

## Self-Check: PASSED

- All 9 plan files present on disk (7 created, 2 modified).
- All task + fix commits verified in git history (e601d34, b8e78c9, 65b5b8a, 3e8e5ce, 92fe9ea, c33069c, a7fb80d, 8ea0038).
- Re-confirmed at finalization: `npx vitest run src/lib/` 13/13 pass; `npx tsc -b --noEmit` 0 errors.

---
*Phase: 02-coordinate-mapping-fixture-viewer*
*Completed: 2026-06-04*
