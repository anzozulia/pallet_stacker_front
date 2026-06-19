---
phase: quick-260619-r3x
plan: 01
subsystem: result-viewer
tags: [viewer, ui-revision, assembly-insight, code-split]
requires:
  - Phase 8 assembly-insight viewer (explode + layer focus, computeLayers model)
provides:
  - Explode binary toggle button (Assembled ⇄ Exploded)
  - Layers build-up-only +/- stepper cluster (no Isolate mode)
  - Row-click → build-up-to-layer seam (no isolate, no persistent selected cue)
affects:
  - src/lib/computeLayers.ts
  - src/components/viewer/Boxes.tsx
  - src/components/viewer/LayerControls.tsx
  - src/routes/ResultPage.tsx
  - src/components/result/PlacementList.tsx
  - src/components/result/PlacementList.test.tsx
  - e2e/assembly-insight.spec.ts
tech-stack:
  added: []
  patterns:
    - "Binary explode = 0|1 drives the existing layerIndex*explode*UNIT lift (no slider needed)"
    - "Build-up level k clamped [0..N], top collapses to null=All; readout `Layers 1–k / N`"
    - "Row-click builds UP to a box's layer via setFocusIndex(layer+1) — box becomes visible"
key-files:
  created: []
  modified:
    - src/lib/computeLayers.ts
    - src/components/viewer/Boxes.tsx
    - src/components/viewer/LayerControls.tsx
    - src/routes/ResultPage.tsx
    - src/components/result/PlacementList.tsx
    - src/components/result/PlacementList.test.tsx
    - e2e/assembly-insight.spec.ts
decisions:
  - "EXPLODE_FIXED_UNIT bumped 350→500 for a clearer exploded gap (no test asserts the literal)"
  - "Explode is a single role=switch toggle (aria-label \"Explode\"); onExplode still called with 0|1 so explodeNonce + cogVisible gate are unchanged"
  - "Layers build-up top of range = All (null); stepping past N collapses to All; readout `Layers 1–k / N`"
  - "Isolate mode + GHOST_OPACITY + persistent selected cue (selectedId/data-selected/ring) all removed; build-up is the only layer mode"
  - "Row-click renamed onIsolate→onRevealToLayer; builds UP to the clicked box's layer (no isolate)"
metrics:
  duration: ~15min
  completed: 2026-06-19
---

# Phase quick-260619-r3x Plan 01: Simplify Phase 8 Assembly-Insight Viewer Summary

Replaced the bulky Phase-8 viewer overlay (Explode slider + Build-up/Isolate mode toggle + Layers slider + persistent isolate selected-cue) with two compact controls — an Explode TOGGLE button and Layers +/− STEPPERS — and removed the Isolate mode entirely; the placement-row click now builds the stack UP to a box's layer instead of isolating it.

## What Changed

**Task 1 — Explode toggle + EXPLODE_FIXED_UNIT bump (commit f3f8c0f)**
- `computeLayers.ts`: `EXPLODE_FIXED_UNIT` 350 → 500; doc comments dropped the slider/isolate prose.
- `LayerControls.tsx`: replaced the Explode `<input type="range">` (and `{x}x` readout) with a single binary `role="switch"` toggle (`aria-label="Explode"`, accent-on / neutral-off pill). Readout now `Exploded` / `Assembled` / `No boxes`. `onExplode` still called with `0|1` so ResultPage's `explodeNonce` bump and `cogVisible = cogOn && explode === 0` gate are untouched.
- `e2e/assembly-insight.spec.ts`: explode helper clicks the toggle to reach the target binary state; explode scenarios assert toggle `aria-checked` + the `Exploded`/`Assembled` text (the `1.0x` assertion is gone).

**Task 2 — Build-up-only layers + steppers; remove Isolate (commit 02f2897)**
- `Boxes.tsx`: deleted `GHOST_OPACITY` and the `focusMode` prop; `layerAppearance(layerIndex, focusIndex)` is build-up only (opacity always 1, `transparent={false}`). Removed the opacity/transparent plumbing.
- `LayerControls.tsx`: removed the Build-up/Isolate mode toggle and the Layers range; added a compact `−` / readout / `+` stepper cluster. Level `k = focusIndex ?? layerCount`, clamped `[0..N]`; the top collapses to `null` (All). Readout: `No boxes` / `Single layer` / `All` / `Layers 1–k / N`. Steppers carry `aria-label="Reveal one more layer"` / `"Reveal one fewer layer"`; `+` disabled at All, `−` disabled at 0, whole cluster disabled when `layerCount <= 1`.
- `ResultPage.tsx`: removed `focusMode` state; dropped `focusMode`/`onFocusMode` from the `<LayerControls>` and `focusMode` from the `<Boxes>` prop lists; `selectPallet` no longer sets a mode.

**Task 3 — Row-click → build-up + remove selected cue + tests (commit 4c34162)**
- `ResultPage.tsx`: removed `selectedId` state; the row-click seam (renamed `onIsolate` → `onRevealToLayer`) maps `id → layer` and calls `setFocusIndex(li + 1)` to build UP through the clicked box's layer (guarded `li != null`, T-08-DOS). Dropped the `selectedId` prop from `<PlacementList>`.
- `PlacementList.tsx`: removed the `selectedId` prop, `isSelected` derivation, `data-selected` attribute, and the `ring-accent` selected branch. Card className collapses to hover (`border-accent bg-accent-weak`) vs resting (`border-border bg-surface`). One-way hover unchanged. `onClick` calls `onRevealToLayer`.
- `PlacementList.test.tsx`: dropped the persistent-selected-cue test; renamed the row-click test to assert `onRevealToLayer('T000')`.
- `e2e/assembly-insight.spec.ts`: replaced the layers slider helpers with a `−` stepper helper; deleted both isolate scenarios; reworked build-up (`−` once → `Layers 1–1 / 2`, canvas differs from All), row-click → build-up (canvas differs, hover still works, no `data-selected`), reset-on-switch (toggle + stepper → Assembled/All on switch, camera preserved), and full-compose around the toggle + steppers.

## Deviations from Plan

None — plan executed as written. One process note: the pre-commit lint-staged hook lints `e2e/**`, so the layer-stepper e2e helpers (unused until Task 3) could not be introduced early in Task 1's e2e edit. Task 1 kept the existing layers slider helpers intact and only swapped the explode helper; Task 3 then introduced the stepper helpers as it reworked the layer scenarios. Net code is identical to the plan; only the intermediate commit boundary differed to keep each commit hook-green. Descriptive comments that mentioned "Isolate"/"isolate" were reworded (e.g. "build-up only", "no dim-the-rest mode") so the plan's strict residue grep is clean.

## Verification — GATE (all green)

| Command | Result |
| ------- | ------ |
| `npm run typecheck` | PASS (`tsc -b --noEmit`, clean) |
| `npm run lint` | PASS — 0 errors (2 pre-existing react-refresh warnings in Boxes.tsx export + router.tsx, unrelated) |
| `npm test` | PASS — 34 files, 236 tests |
| `npx playwright test e2e/assembly-insight.spec.ts` | PASS — 9/9 |
| `npm run build && node scripts/check-code-split.mjs` | PASS — three lives only in the lazy `ResultPage` chunk; entry chunk three-free |

Code-split invariant held: `three` stays in the lazy `/result` chunk; `computeLayers`, `LayerControls`, and `PlacementList` remain three-free (no three/r3f/drei import added).

## Known Stubs

None.

## Self-Check: PASSED

- Files modified exist and committed:
  - src/lib/computeLayers.ts, src/components/viewer/Boxes.tsx, src/components/viewer/LayerControls.tsx, src/routes/ResultPage.tsx, src/components/result/PlacementList.tsx, src/components/result/PlacementList.test.tsx, e2e/assembly-insight.spec.ts — all present.
- Commits exist: f3f8c0f, 02f2897, 4c34162 (verified in `git log`).
