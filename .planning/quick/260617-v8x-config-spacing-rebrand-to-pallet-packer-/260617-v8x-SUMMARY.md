---
phase: quick-260617-v8x
plan: 01
subsystem: config/loading/result-chrome + 3D-viewer
tags: [rebrand, ui-polish, 3d-viewer, bugfix, camera, cog]
requires: [quick-260607-1fa]
provides:
  - "Cross-page 'Pallet Packer' rebrand (no 'pack studio' sub-label)"
  - "Configure footer breathing room; Loading Cancel red-on-hover"
  - "Result legend showing type NAMES; wider rail / narrower viewer; distinct selected pallet card"
  - "Visible CoG overlay marker; snap-free preset camera transitions"
affects:
  - src/features/config/ConfigForm.tsx
  - src/routes/LoadingPage.tsx
  - src/routes/ResultPage.tsx
  - src/components/viewer/CogMarker.tsx
  - src/components/viewer/CameraPresets.tsx
  - src/components/result/PalletSwitcher.tsx
tech-stack:
  added: []
  patterns:
    - "Always-visible 3D overlay marker: meshBasicMaterial + depthTest/depthWrite=false + high renderOrder"
    - "Slerp orientation endpoints derived from three's Matrix4.lookAt(camera.up) so the slerp endpoint == OrbitControls' settled orientation (no end-snap)"
key-files:
  created: []
  modified:
    - src/features/config/ConfigForm.tsx
    - src/routes/LoadingPage.tsx
    - src/routes/ResultPage.tsx
    - index.html
    - src/components/Hello.tsx
    - src/components/Hello.test.tsx
    - src/components/result/PalletSwitcher.tsx
    - src/components/viewer/CogMarker.tsx
    - src/components/viewer/CameraPresets.tsx
decisions:
  - "Selected pallet card uses bg-accent/15 (Tailwind v4 opacity modifier) rather than a new token — minimal blast radius, distinctly purple-tinted vs the #edeef1/#ecebfd greys."
  - "Rail widened 440px -> 600px (clean value at the top of the 560-600 range), 1fr viewer shrinks ~15% on common 1400-1600px screens; <900px stack preserved."
metrics:
  duration: ~18m
  completed: 2026-06-17
  tasks: 3
  files: 9
---

# Phase quick-260617-v8x Plan 01: Config Spacing / Rebrand to Pallet Packer + Result Polish + 3D Bug Fixes Summary

Landed all 8 fixes (incl. the two real bugs) across the Configure / Loading / Result chrome and the 3D viewer: cross-page rebrand to "Pallet Packer", footer spacing, red Cancel hover, type-name legend, wider rail, a distinct selected pallet card, plus the now-visible Centre-of-gravity marker (#4) and the eliminated TOP-preset end-of-transition snap (#6) — full gate green.

## What Was Built

### Task A — cross-page chrome (commit fc1ea1b)
- **#2 rebrand:** all three topbars (Configure / Loading / Result) and `index.html` `<title>` now read "Pallet Packer"; the `<small>pack studio</small>` sub-label was deleted from each. `Hello.tsx` (+ its test) updated so no "Palletize" string remains anywhere except the untouched localStorage `STORAGE_KEY` `'palletize:config:v1'`.
- **#1 footer spacing:** `ConfigForm` `<main>` gained `pb-32` so the last box card clears the sticky full-width footer.
- **#3 Cancel hover:** LoadingPage Cancel button `hover:text-text` -> `hover:text-danger` (red).

### Task B — result rail / overlay (commit 676f46b)
- **#5 legend names:** the `legend` memo in `ResultPage` now maps each `[typeId, hex]` to `[typeToLabel?.get(typeId) ?? typeId, hex]` (deps now include `typeToLabel`). The `ViewerOverlay` `legend: [string, string][]` prop shape is unchanged; the by-type swatch row now shows labels. The `?? typeId` fallback is load-bearing — kept the e2e D/F/T legend assertions green.
- **#7 resize:** outer grid `grid-cols-[1fr_440px]` -> `grid-cols-[1fr_600px]`; `max-[900px]:grid-cols-1` stack preserved.
- **#8 selected card:** `PalletSwitcher` selected row fill `bg-accent-weak` -> `bg-accent/15`; accent border + inset ring + filled index chip (non-colour cues) preserved.

### Task C — 3D viewer bugs (commit ae069c8)
- **#4 CoG occlusion BUG:** the marker sat dead-centre inside the opaque box tower and was fully depth-occluded. `CogMarker` sphere switched to `meshBasicMaterial` with `depthTest={false} depthWrite={false}` + `renderOrder={999}` (radius 14 -> 18); the drei `<Line>` drop-line got `depthTest={false}` + `renderOrder={999}`. Both now paint over the boxes.
- **#6 TOP end-snap BUG:** the slerp orientation endpoints came from the pure `lookQuaternion`, whose degenerate-up handling (`altUp=[1,0,0]`) for the straight-down TOP view produced a different roll than three's own look-at that `OrbitControls.update()` reasserts on the settled frame — a ~90° snap. Fixed by deriving `fromQuat = camera.quaternion.clone()` and `toQuat = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(toPosVec, toTargetVec, camera.up))`. The `camera.up` match makes the slerp endpoint equal OrbitControls' settled orientation -> continuous handoff for TOP and every preset. `slerpQuat` still drives the per-frame interpolation; the pure `lookQuaternion`/`presetQuaternion` exports stay in `camera-presets.ts` (their unit tests gate them). D-02 `measureNonce` preservation and the `__cameraState` hook are intact.

## Verification

**Full gate — all green:**
- `npm test` — 201 passed (32 files) [unchanged count vs before, Hello test re-pointed to new wordmark]
- `npm run typecheck` — clean
- `npm run lint` — 0 errors (1 pre-existing unrelated `react-refresh` warning in `src/router.tsx`)
- `npm run build` — built (entry three-free; three in lazy `ResultPage` chunk)
- `node scripts/check-code-split.mjs` — PASSED (entry chunk three-free; three in lazy /result chunk)
- `npm run test:e2e` — 14 passed (incl. the preset-reframe + CoG-toggle tests)

**Bug eyeball (headless Playwright probe against the running :5173 dev server, then artifacts removed):**
- **#4 CoG marker IS now visible:** screenshot of the populated /result with CoG default-ON showed the white sphere clearly drawn over the box tower with its dashed drop-line down to the deck (previously invisible inside the stack). Same screenshot doubly confirmed #2 (Pallet Packer wordmark), #5 (D/F/T legend), #7 (wider rail / narrower viewer), and #8 (P001 card visibly purple-tinted and standing out from the grey P002 card + page bg).
- **#6 TOP no longer end-snaps:** after clicking TOP, the settled `__cameraState` was `position [0, 2681, -25]`, `target [0, 600, -25]` — a clean straight-down plan view (dx=0.0, dz=0.0, dy=+2081). The TOP screenshot showed the square box footprint square-on with correct roll (no twist). The position-direction sample into the settled frame stepped 0.00°, and the orientation endpoint now equals OrbitControls' settled orientation by construction (same `Matrix4.lookAt(camera.up)`). 0 console errors throughout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `Hello.test.tsx` assertion for the new wordmark**
- **Found during:** Task A
- **Issue:** `src/components/Hello.test.tsx` asserted `getByRole('heading', { name: 'Palletize' })`; after the rebrand `Hello.tsx` renders "Pallet Packer", so the test would have failed `npm test`.
- **Fix:** re-pointed the assertion (and test title) to "Pallet Packer". This is the changed-behaviour test the plan's Task-A grep excluded but the gate requires green.
- **Files modified:** src/components/Hello.test.tsx
- **Commit:** fc1ea1b

No other deviations — plan executed as written.

## Known Stubs

None. All eight fixes are wired to real behaviour/data; no placeholder or empty-data paths introduced.

## Self-Check: PASSED
- All modified files present on disk and committed.
- Commits fc1ea1b, 676f46b, ae069c8 exist on master.
- Full gate (test/typecheck/lint/build/check-code-split/test:e2e) green.
- No "Palletize" string remains except the untouched `STORAGE_KEY`.
