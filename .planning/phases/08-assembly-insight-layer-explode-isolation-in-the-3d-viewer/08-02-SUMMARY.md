---
phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer
plan: 02
subsystem: ui
tags: [three, r3f, explode, layers, camera, maath, animation, e2e, code-split]

requires:
  - phase: 08-01-computeLayers-foundation
    provides: "computeLayers/LayerModel base-z banding + EXPLODE_FIXED_UNIT (shared explode unit) + inflateBboxForExplode camera helper, all three-free; maath promoted to a direct dep"
  - phase: 06-result-viewer
    provides: "ResultPage single-Canvas carrier, Boxes per-box meshes, CameraPresets bboxRef-decoupled preset animation, ViewerOverlay chrome, result-viewer.spec.ts stubbed Configure->Run->/result harness"
provides:
  - "LayerControls bottom-center overlay bar (Explode native range slider; structured for Plan 03's Layers slider + mode toggle)"
  - "Boxes per-layer explode offset (grouped by itemToLayer, maath easing.damp per-frame, byte-identical at 0) consuming the shared EXPLODE_FIXED_UNIT"
  - "CameraPresets explodeNonce-keyed re-fit effect (inflateBboxForExplode + bboxRef) — explode re-frames, pallet switch does not"
  - "ResultPage explode/explodeNonce state + layerModel/explodeExtraHeight derivation + CoG-hide gate (cogVisible = cogOn && explode===0) + window.__cogVisible deterministic e2e hook"
  - "e2e/assembly-insight.spec.ts — five named explode scenarios against the stubbed flow"
affects: [08-03-layers-focus-slice]

tech-stack:
  added: []
  patterns:
    - "Per-layer wrapper <group> (not per-mesh) lifted as a unit via useFrame + maath easing.damp — the animation is imperative-per-frame on group refs, React state stays untouched"
    - "Single shared EXPLODE_FIXED_UNIT imported by BOTH Boxes (visual offset) and ResultPage (camera extra-height) so the camera lift cannot diverge from the visual offset"
    - "Decoupled camera re-fit: a second useEffect keyed ONLY on [explodeNonce, preset, camera], reading bboxRef.current — explode re-frames, a pallet switch (measureNonce) never does (D-02 preserved)"
    - "Deterministic e2e visibility hook (window.__cogVisible) written from an effect on the SAME boolean the render gate uses — the test asserts the real gate, not a console-error proxy"

key-files:
  created:
    - src/components/viewer/LayerControls.tsx
    - e2e/assembly-insight.spec.ts
  modified:
    - src/components/viewer/Boxes.tsx
    - src/components/viewer/CameraPresets.tsx
    - src/routes/ResultPage.tsx

key-decisions:
  - "Boxes groups mapped boxes by layerModel.itemToLayer into per-layer wrapper groups (<=4 for the fixture); each group's position.y is damped toward layerIndex * explode * EXPLODE_FIXED_UNIT each frame — at explode 0 every target is 0 so the assembled stack is byte-identical (no offset, no transparent, SC-3)"
  - "The explode re-fit is a SECOND CameraPresets effect mirroring the preset effect's anim shape but keyed on explodeNonce only; it reads bboxRef.current and inflates via inflateBboxForExplode so a pallet switch never re-frames (D-05/D-02/Pitfall 1)"
  - "explodeExtraHeight = max(0, layers.length-1) * explode * EXPLODE_FIXED_UNIT — the same shared constant Boxes uses, so the camera frames exactly the inflated stack"
  - "CoG visibility is one decision (cogVisible = cogOn && explode===0) consumed by both the render gate and the window.__cogVisible e2e hook; the window write moved into an effect to satisfy react-hooks/immutability (no mutation in render body)"
  - "layerModel computed as a plain const AFTER the redirect guard (not a hook) so hook order stays stable; computeLayers is pure + cheap (<=19 items on an already-settled result)"
  - "Pallet-switch explode reset deferred to Plan 03 per the plan (D-03) — explode persists across a switch in this slice"

patterns-established:
  - "Pattern: assembly-insight controls live in a single bottom-center LayerControls bar (L-04) following ViewerOverlay's pointer-events-none/auto + pill conventions; Plan 03 extends the same bar without restructuring"
  - "Pattern: explode animation is per-layer-group imperative damping in useFrame, never per-mesh and never React re-render churn"

requirements-completed: [RESULT-07]

duration: ~14min
completed: 2026-06-19
---

# Phase 8 Plan 02: Explode Slice Summary

**The Explode slider delivered end-to-end: a bottom-center native-range control that animates the solver's base-z layers apart (maath `easing.damp` per layer group), re-frames the camera to the growing stack (explodeNonce-decoupled re-fit), and hides the now-misleading CoG marker — while at 0/"Assembled" the scene is byte-identical to Phase 6 and a pallet switch never moves the camera.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-06-19
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- **Boxes** now groups the mapped boxes by their base-z layer (`computeLayers` `itemToLayer`) into per-layer wrapper `<group>`s and damps each group's `position.y` toward `layerIndex * explode * EXPLODE_FIXED_UNIT` every frame via `useFrame` + `maath` `easing.damp` (D-04 uniform additive gap, D-07 animated). At `explode === 0` every target is 0 → byte-identical assembled stack (SC-3); the hover-emissive + heatmap colour logic + `<Edges>` are untouched (SC-4), and `transparent` is never set in this plan.
- **CameraPresets** gained `explodeNonce` + `explodeExtraHeight` props and a NEW re-fit effect keyed ONLY on `[explodeNonce, preset, camera]` (never `bbox`, never `measureNonce`), reading `bboxRef.current`, inflating via `inflateBboxForExplode`, and building `anim.current` in the same shape the existing `useFrame` drives — so explode re-frames (D-05) but a pallet switch does not (D-02/Pitfall 1).
- **LayerControls** (new) is a bottom-center bar (`absolute bottom-6 left-1/2 -translate-x-1/2`) with a native `<input type="range">` (`aria-label="Explode amount"`, `aria-valuetext` mirroring the readout, keyboard-operable), an accent-filled slider on a `#0c0f17` track, and a readout reading `Assembled` at 0 / `{x}x` raised / `No boxes` when `layerCount === 0`. Structured so Plan 03 adds the Layers slider + mode toggle to the same bar without restructuring.
- **ResultPage** owns the new `explode` + `explodeNonce` state (the `presetNonce` idiom), derives `layerModel` (plain const after the guard) and `explodeExtraHeight` from the SHARED `EXPLODE_FIXED_UNIT`, wires `layerModel`+`explode` to `<Boxes>` and `explodeNonce`+`explodeExtraHeight` to `<CameraPresets>`, gates the CoG marker on `cogVisible = cogOn && explode === 0` (D-06), exposes `window.__cogVisible` from an effect as the deterministic e2e hook, and mounts `<LayerControls>` over the Canvas.
- **e2e** (`assembly-insight.spec.ts`) proves five independently-named scenarios against the stubbed Configure→Run→/result harness.

## Task Commits

1. **Task 1: Boxes per-layer explode offset (maath damp) + CameraPresets decoupled re-fit** — `dc075b2` (feat)
2. **Task 2: LayerControls Explode slider + ResultPage explode state/wiring + CoG-hide gate** — `d9caa07` (feat)
3. **Task 3: Route-intercepted explode e2e — five named scenarios** — `f853e4f` (test)

## Files Created/Modified
- `src/components/viewer/LayerControls.tsx` (new) — bottom-center Explode control bar; native range + readout, empty-state disable, Plan-03-ready structure.
- `e2e/assembly-insight.spec.ts` (new) — five named explode tests (assembled-default, explode-gaps, CoG-hidden, camera-on-switch, compose) on the stubbed flow.
- `src/components/viewer/Boxes.tsx` — per-layer grouping + `useFrame`/`easing.damp` offset; imports `EXPLODE_FIXED_UNIT` (no local literal).
- `src/components/viewer/CameraPresets.tsx` — `explodeNonce`/`explodeExtraHeight` props + the decoupled explode re-fit effect (inflateBboxForExplode + bboxRef).
- `src/routes/ResultPage.tsx` — explode state/derivation/wiring, CoG-hide gate, `window.__cogVisible` hook, `<LayerControls>` mount.

## Decisions Made
- Per-layer wrapper groups (not per-mesh) carry the explode offset; the damp is imperative-per-frame on group refs (no React re-render).
- The explode re-fit is a second effect keyed on `explodeNonce` only, mirroring the preset effect's anim shape; `bboxRef.current` + `inflateBboxForExplode` keep the frame correct without making `bbox`/`measureNonce` a dep (D-02).
- One `cogVisible` boolean feeds both the render gate and `window.__cogVisible`; the window write lives in an effect (react-hooks/immutability) so render stays side-effect-free.
- Pallet-switch explode reset deferred to Plan 03 per the plan (D-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `window.__cogVisible` write moved out of the render body**
- **Found during:** Task 2 (lint gate before commit)
- **Issue:** Writing `window.__cogVisible` inside an IIFE in the JSX render path tripped `react-hooks/immutability` ("Modifying a variable defined outside a component or hook is not allowed") — a blocking lint error that would fail the pre-commit hook.
- **Fix:** Computed `cogVisible = cogOn && explode === 0` once at the top of the component and moved the `window.__cogVisible` write into a `useEffect` keyed on `cogVisible`; the render gate now reads the same const. Deterministic hook + gate stay in lockstep.
- **Files modified:** `src/routes/ResultPage.tsx`
- **Commit:** `d9caa07`

**2. [Rule 1 - Bug] e2e heatmap control targeted by the wrong ARIA role**
- **Found during:** Task 3 (e2e run — scenario 5 timed out)
- **Issue:** The compose scenario located the Support-heatmap toggle via `getByRole('button', { name: 'Support heatmap' })`, but ViewerOverlay renders it as `role="switch"`, so the locator never resolved and the test timed out at 30s.
- **Fix:** Changed the locator to `getByRole('switch', { name: 'Support heatmap' })`. All five scenarios green.
- **Files modified:** `e2e/assembly-insight.spec.ts`
- **Commit:** `f853e4f`

_Note: the plan's per-task `npx tsc --noEmit` is a no-op under this project's `tsconfig` project-references layout (`files: []` root). The real typecheck is `tsc -b --noEmit` (the `typecheck` npm script) — used here and run green._

## Issues Encountered
None beyond the two auto-fixes above.

## User Setup Required
None — no external service configuration required.

## Verification Results
- `npx tsc -b --noEmit` — exit 0 (type-clean across the new props + wiring).
- `npx vitest run` — full suite 235/235 green (no regression).
- `npx vitest run src/routes/ResultPage.test.tsx` — 5/5 green (redirect-guard + render tests intact).
- `npx playwright test e2e/assembly-insight.spec.ts` — 5/5 named explode tests green (assembled / gaps / CoG-hidden / camera-on-switch / compose).
- `npx eslint` (all changed files) — exit 0.
- `npm run build && node scripts/check-code-split.mjs` — exit 0; `three` absent from the entry chunk (`index-*.js`), present only in the lazy `ResultPage-*.js` (maath + LayerControls stayed in the lazy chunk; computeLayers + EXPLODE_FIXED_UNIT stayed three-free).

## Threat Surface Scan
No new network endpoints, auth paths, file access, or schema changes. The threat register's `mitigate` dispositions hold: LayerControls labels/readouts are static literals + a `toFixed` number rendered as React text children only (T-08-XSS); the explode/camera math derives from the Plan-01-guarded `layerModel` + a bounded 0..1 slider with `inflateBboxForExplode` a 0 no-op (T-08-DOS); the decoupled `explodeNonce`-only re-fit prevents the switch regression (T-08-REG), asserted by the camera-unchanged-on-switch e2e.

## Next Phase Readiness
- The Explode slice is usable end-to-end on the real result. Plan 03 (Layers focus/isolation) composes on the same `layerModel`, extends the existing `LayerControls` bar (Layers slider + mode toggle), and lands the pallet-switch explode reset (D-03) before phase verification.

## Self-Check: PASSED

All created files exist on disk (`src/components/viewer/LayerControls.tsx`, `e2e/assembly-insight.spec.ts`) and all three task commits (`dc075b2`, `d9caa07`, `f853e4f`) are present in git history.

---
*Phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer*
*Completed: 2026-06-19*
