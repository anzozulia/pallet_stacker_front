---
phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer
plan: 03
subsystem: ui
tags: [three, r3f, layers, focus, isolate, build-up, e2e, code-split]

requires:
  - phase: 08-01-computeLayers-foundation
    provides: "computeLayers/LayerModel base-z banding + itemToLayer lookup (the D-12 row→layer map), all three-free"
  - phase: 08-02-explode-slice
    provides: "Boxes per-layer wrapper groups + explode damp; LayerControls bottom-center bar; CameraPresets explodeNonce-decoupled re-fit; ResultPage explode state/CoG-hide gate; assembly-insight.spec.ts (5 explode scenarios)"
provides:
  - "Boxes per-layer focus appearance: pure layerAppearance(layerIndex, focusMode, focusIndex) → {visible,opacity}; build-up HIDES upper layers (group not rendered), isolate GHOSTS non-focused to GHOST_OPACITY (0.15); transparent only when opacity<1 (byte-identical default)"
  - "LayerControls extended: Build-up/Isolate role=switch mode toggle + a Layers native range (0..N) with All / Layer k / N / Single layer / No boxes readouts; aria-label 'Layer focus'"
  - "PlacementList row-click → onIsolate(item_id) seam + a persistent selected cue (border-accent ring-1 ring-accent + data-selected) DISTINCT from the transient hover cue"
  - "ResultPage focusMode/focusIndex/selectedId state, a selectPallet wrapper resetting explode+focus on switch (camera preserved, no nonce bump), and the row-click→isolate handler via layerModel.itemToLayer"
  - "assembly-insight.spec.ts extended to 10 scenarios: +build-up-hides, +isolate-dims, +row-click→isolate, +reset-on-switch, +full-compose"
affects: []

tech-stack:
  added: []
  patterns:
    - "Per-layer focus is a PURE derivation: layerAppearance(layerIndex, focusMode, focusIndex) drives BOTH the wrapper-group `visible` and the per-mesh transparent/opacity — never recolours (colour/emissive stay with heatmap/hover so both read THROUGH the ghost)"
    - "transparent={opacity < 1} guard (Pitfall 5): opacity 1 keeps transparent FALSE so the All default is byte-identical to the assembled view with no transparency sort artifacts"
    - "Reset-on-switch resets explode STATE to 0 WITHOUT bumping explodeNonce — the nonce bump would fire the explode re-fit against the new pallet's just-re-measured bbox and snap the camera (the no-snap-on-switch contract, D-05/D-02)"
    - "Row-click→isolate maps item_id via the Plan-01 layerModel.itemToLayer with a `li != null` guard (a missing mapping is a no-op) — the placement list becomes a layer remote"

key-files:
  created: []
  modified:
    - src/components/viewer/Boxes.tsx
    - src/components/viewer/LayerControls.tsx
    - src/components/result/PlacementList.tsx
    - src/components/result/PlacementList.test.tsx
    - src/routes/ResultPage.tsx
    - e2e/assembly-insight.spec.ts

key-decisions:
  - "layerAppearance is an EXPORTED pure helper (RESEARCH Pattern 2): focusIndex==null → {visible:true,opacity:1}; buildup → visible for layerIndex<=focusIndex-1, hidden above; isolate → focused solid, others GHOST_OPACITY. The All default reproduces Plan-02 byte-identically (SC-3)"
  - "Ghosting sets ONLY transparent/opacity on the meshStandardMaterial; colour/emissive (heatmap + hover) and the <Edges> are untouched so both compose THROUGH the ghost (Pitfall 4 / SC-4)"
  - "GHOST_OPACITY=0.15 is a 3D-material constant (UI-SPEC ~0.12-0.18), not a design token"
  - "selectPallet resets explode→0, focus→Build-up/All, selectedId→null on switch but does NOT bump explodeNonce (Rule 1 fix below): a nonce bump re-fired the explode re-fit against the new pallet's bbox and snapped the camera, regressing camera-unchanged-on-switch"
  - "Persistent selected cue uses border-accent ring-1 ring-accent (+ data-selected attribute for the e2e); the hover cue stays border-accent bg-accent-weak — selected and hover are visually distinct, both can apply"
  - "The Layers slider treats 0 as 'All' (null) — onFocusIndex maps value 0 back to null so the no-op default is exactly focusIndex null"
  - "layerCount===1 disables the Layers slider + mode toggle (Single layer); layerCount===0 disables the whole bar (No boxes); Explode stays usable at count 1"

patterns-established:
  - "Pattern: layer-focus visibility/opacity is a pure per-layer derivation applied to the SAME explode wrapper groups — never a second scene graph"
  - "Pattern: reset-on-switch changes control STATE but never triggers a camera re-fit (no nonce bump) — the camera-preservation contract holds across both explode and focus resets"

requirements-completed: [RESULT-07]

duration: ~22min
completed: 2026-06-19
---

# Phase 8 Plan 03: Layers Focus Slice Summary

**The Layers control delivered end-to-end: a Build-up/Isolate mode toggle + a 0..N Layers slider that either reveals the pallet cumulatively from the floor (build-up HIDES upper layers) or isolates one layer (isolate DIMS the rest to translucent ghosts), wired so a placement-list row click jumps the viewer to that box's isolated layer with a persistent selected cue, a pallet switch resets both explode and focus while preserving the camera, and everything composes simultaneously with explode, presets, CoG/heatmap, and the existing hover — with the All/Build-up default byte-identical to the assembled view (SC-3).**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-06-19
- **Tasks:** 3
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- **Boxes** gained `focusMode` + `focusIndex` props, a `GHOST_OPACITY` (0.15) constant, and an exported pure `layerAppearance(layerIndex, focusMode, focusIndex)` helper (RESEARCH Pattern 2). The returned `visible` drops a hidden build-up layer's wrapper group out of the scene entirely; the returned `opacity` ghosts a non-focused isolate layer via `transparent={opacity < 1}` + `opacity` on the existing material. Colour/emissive (heatmap + hover) and `<Edges>` are untouched so both read through the ghost (Pitfall 4 / SC-4); at `focusIndex == null` every layer is `{visible:true, opacity:1}` so `transparent` stays false and the default is byte-identical (Pitfall 5 / SC-3).
- **LayerControls** added a Build-up/Isolate `role="switch"` mode toggle (the ViewerOverlay active/inactive class pair, accent only on the active mode) and a native Layers `<input type="range">` (0..`layerCount`, `aria-label="Layer focus"`, `aria-valuetext` mirroring the readout). Readout copy: `All` at 0/null, `Layer {k} / {N}` when focused, `Single layer` at count 1, `No boxes` at count 0; count 1 disables the focus controls while Explode stays usable, count 0 disables the bar. The Explode portion from Plan 02 is unchanged.
- **PlacementList** added `onIsolate?: (itemId) => void` + `selectedId?` props, an `onClick={() => onIsolate?.(item.item_id)}` alongside the unchanged one-way hover seam, and a persistent selected cue (`border-accent ring-1 ring-accent` + `data-selected`) distinct from the transient hover cue (`border-accent bg-accent-weak`). C-04 import discipline preserved (no three).
- **ResultPage** owns `focusMode`/`focusIndex`/`selectedId` state, passes them to `<Boxes>`/`<LayerControls>`/`<PlacementList>`, wraps the pallet-switch path in a `selectPallet` that resets explode + focus + selection (D-11), and wires the row-click→isolate handler that maps `item_id` through `layerModel.itemToLayer` (with a `li != null` guard) into an Isolate focus (D-12). `onHover` is untouched.
- **e2e** (`assembly-insight.spec.ts`) extended from 5 to 10 named scenarios: the new build-up-hides, isolate-dims, row-click→isolate (selected cue + hover-unchanged), reset-on-switch (readouts return to Assembled/All, camera unchanged), and full compose (build-up + explode + preset + CoG + heatmap, zero console errors).

## Task Commits

1. **Task 1: Per-layer build-up hide + isolate ghost opacity in Boxes** — `ef7094f` (feat)
2. **Task 2: Layers slider + Build-up/Isolate toggle; PlacementList row-click → isolate** — `8cda50b` (feat)
3. **Task 3: ResultPage focus state + reset-on-switch + row-click→isolate; layers e2e** — `462de95` (feat)

## Files Created/Modified
- `src/components/viewer/Boxes.tsx` — `focusMode`/`focusIndex` props, `GHOST_OPACITY`, exported `layerAppearance` helper; `visible` on the wrapper group + `transparent={opacity<1}`/`opacity` on the material.
- `src/components/viewer/LayerControls.tsx` — Build-up/Isolate role=switch toggle + Layers range (0..N) with the All/Layer k/N/Single layer/No boxes readouts; Explode portion unchanged.
- `src/components/result/PlacementList.tsx` — `onIsolate` + `selectedId` props, row `onClick`, persistent selected cue distinct from hover.
- `src/components/result/PlacementList.test.tsx` — +2 cases: onIsolate click fires with item_id; selectedId marks the row (`data-selected` + `ring-accent`).
- `src/routes/ResultPage.tsx` — focus state, `selectPallet` reset-on-switch (no nonce bump), row-click→isolate via `layerModel.itemToLayer`.
- `e2e/assembly-insight.spec.ts` — +5 named scenarios (build-up-hides, isolate-dims, row-click→isolate, reset-on-switch, full compose).

## Decisions Made
- `layerAppearance` is pure + exported (RESEARCH Pattern 2); the All default reproduces Plan-02 byte-identically.
- Ghosting sets only transparent/opacity — colour/emissive/Edges untouched so heatmap + hover compose through the ghost.
- `selectPallet` resets explode/focus STATE but does NOT bump explodeNonce, preserving the camera on switch.
- Selected cue (ring) is distinct from the hover cue (weak bg); both may apply.
- The Layers slider maps value 0 → null so "All" is exactly the no-op `focusIndex null` default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `selectPallet` must NOT bump `explodeNonce` on a pallet switch**
- **Found during:** Task 3 (e2e run — both the pre-existing `camera-unchanged-on-switch` AND the new `reset-on-switch` failed with camera drift of ~49 / ~463 units).
- **Issue:** The plan's reset-on-switch text instructed bumping `explodeNonce` on switch ("so the camera re-fits back to the assembled frame"). But CameraPresets' explode re-fit effect reads `bboxRef.current`, which the measure effect updates to the NEW pallet's bbox on the same switch — so bumping `explodeNonce` re-framed the camera toward the new pallet's frame, snapping it. This directly regressed the Plan-02 `camera-unchanged-on-switch` contract (D-05/D-02/Pitfall 1).
- **Fix:** Removed the `setExplodeNonce` bump from `selectPallet`; it now resets `explode` STATE to 0 (silently returning the boxes to assembled) plus focus + selection, but never triggers a re-fit. The next Explode interaction starts from 0 with `explodeExtraHeight` 0 — the assembled frame — exactly as the plan intended, without the snap.
- **Files modified:** `src/routes/ResultPage.tsx`
- **Commit:** `462de95`

## Issues Encountered
None beyond the Rule 1 fix above.

## User Setup Required
None — no external service configuration required.

## Verification Results
- `npx tsc -b --noEmit` — exit 0 (type-clean across the new focus props + wiring).
- `npx vitest run` — full suite 237/237 green (235 baseline + 2 new PlacementList cases, no regression).
- `npx vitest run src/components/result/PlacementList.test.tsx` — 5/5 green.
- `npx playwright test e2e/assembly-insight.spec.ts` — 10/10 green (5 explode + 5 layers: build-up-hides / isolate-dims / row-click→isolate / reset-on-switch / full compose; camera-unchanged-on-switch passes).
- `npx eslint` (all changed files) — exit 0 (one expected `react-refresh/only-export-components` WARNING on Boxes.tsx from exporting `layerAppearance` per the plan's artifact spec — 0 errors, hook passes).
- `npm run build && node scripts/check-code-split.mjs` — exit 0; `three` absent from the entry chunk (`index-*.js`), present only in the lazy `ResultPage-*.js`. LayerControls + PlacementList stayed three-free.

## Threat Surface Scan
No new network endpoints, auth paths, file access, or schema changes. The threat register's `mitigate` dispositions hold: LayerControls readouts + the PlacementList selected cue are static literals + numbers rendered as React text children only (T-08-XSS); `focusIndex` is bounded to 0..layerCount and `layerAppearance` is pure with a null no-op + the `itemToLayer` lookup guarded by `li != null` (T-08-DOS); reset-on-switch sets explode state to 0 WITHOUT a nonce bump so the switch never re-frames the camera (T-08-REG), asserted by the camera-unchanged-on-switch + reset-on-switch e2e.

## Next Phase Readiness
- RESULT-07 is complete end-to-end: a user can read a dense pallet layer by layer (build it up from the floor, or isolate-and-ghost any single layer) and use the placement list as a layer remote. SC-3 (default no-op), SC-4 (full compose matrix), and the D-11/D-12 integration are all closed. This is the final slice of Phase 8.

## Self-Check: PASSED

All modified files exist on disk and all three task commits (`ef7094f`, `8cda50b`, `462de95`) are present in git history.

---
*Phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer*
*Completed: 2026-06-19*
