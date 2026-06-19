---
phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer
verified: 2026-06-19T13:10:00Z
status: human_needed
score: 4/5
overrides_applied: 0
human_verification:
  - test: "Interactive frame rate while exploding and isolating on dense multi-layer demo presets"
    expected: "Dragging the Explode slider 0→max and scrubbing the Layers slider on the 4-layer P002 pallet produces no visible stutter at interactive rates (≥30 FPS perceived)"
    why_human: "True FPS / perceptual smoothness cannot be asserted reliably in jsdom or headless Playwright; this is a WebGL render-loop concern that requires a human watching the live viewer. Documented as SC-5 / Manual-Only in 08-VALIDATION.md."
---

# Phase 8: Assembly Insight — Layer Explode & Isolation in the 3D Viewer — Verification Report

**Phase Goal:** A densely-packed pallet is made legible via two composable controls sharing one pure layer model: an Explode slider that animates layers apart, and a Layers control that reveals cumulatively or isolates with dimming. Both derive from a pure, three-free `computeLayers(placements)` and compose with existing viewer features.
**Verified:** 2026-06-19T13:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pure `computeLayers(placements)` groups boxes into ordered layers by base-z with tolerance, unit-tested incl. single-layer / uneven-height / tall-floating cases, imports no three/r3f (code-split gate green) | VERIFIED | `src/lib/computeLayers.ts` is pure (only `import type` from pack-contract); 8 SC-1 golden assertions pass: P001→2 layers [0,700], P002→4 layers [0,150,350,700], F003 tall-box-by-base→layer 0, empty model, itemToLayer.size===items.length. `npx vitest run src/lib/computeLayers.test.ts` → 8/8. Code-split gate: `npm run build && node scripts/check-code-split.mjs` → exit 0, three absent from index chunk. |
| 2 | "Explode" control animates layers apart vertically; 0 reproduces the true assembled stack; CoG marker and pallet wireframe behave sensibly while exploded | VERIFIED | `src/components/viewer/Boxes.tsx` uses `useFrame` + `maath easing.damp` to animate per-layer groups toward `layerIndex * explode * EXPLODE_FIXED_UNIT`; at explode 0 every target is 0 (byte-identical). CoG gated on `cogOn && explode === 0` (ResultPage line 165); `window.__cogVisible` hook exposed for deterministic e2e. Pallet deck (`<Pallet>`) is independent of explode. e2e tests `assembled-default`, `explode-gaps`, `CoG-hidden-while-exploded` all pass (10/10 green). |
| 3 | "Layers" control reveals layers cumulatively (build-up) and/or isolates a single layer, dimming or hiding the rest; default is all-visible + assembled (no behavior change until used) | VERIFIED | `layerAppearance(layerIndex, focusMode, focusIndex)` returns `{visible:true, opacity:1}` at `focusIndex==null` (All default, byte-identical). Build-up hides layers above `focusIndex-1`; isolate ghosts non-focused to `GHOST_OPACITY=0.15`; `transparent=false` at opacity 1 (no sort artifacts). `LayerControls` carries both `Build-up`/`Isolate` role=switch toggle and a Layers native range with All/Layer k / N readouts. e2e `build-up-hides`, `isolate-dims`, `row-click→isolate`, `reset-on-switch` all pass. |
| 4 | New controls compose without regression with ISO/TOP/FRONT presets, CoG + support-heatmap toggles, pallet switcher, and placement-list hover highlighting | VERIFIED | `CameraPresets` explode re-fit keys only on `explodeNonce` (not bbox/measureNonce) preserving camera on switch. `selectPallet` is the single pallet-switch path and resets explode + focus + selectedId together. Hover emissive and heatmap colour are untouched by the focus/opacity logic (Pitfall 4). e2e `compose-with-preset+heatmap`, `reset-on-switch`, `full compose` all pass with zero console errors. PalletSwitcher `onSelect` exclusively calls `selectPallet` (confirmed — no bare `setSel` call outside `selectPallet`). CR-01 advisory from 08-REVIEW.md: the review correctly notes that `focusIndex` has no render-path clamp against layer count; however the only pallet-switch path in the current code is `selectPallet` (verified: `setSel` appears only inside `selectPallet`, and `PalletSwitcher onSelect={selectPallet}`), which resets `focusIndex` to null on every switch. The specific "stale focusIndex surviving a switch" scenario is not reachable today. Noted as a structural fragility (WARNING) but not a blocker. |
| 5 | Works on real multi-layer results (the demo presets) at interactive frame rates | UNCERTAIN — needs human | The e2e proves rendering (non-empty canvas PNG, zero WebGL errors) on the committed 2-pallet fixture with 4-layer P002. True FPS/perceptual smoothness under interactive drag is a manual-only check (SC-5, documented in 08-VALIDATION.md); headless Playwright cannot assert perceived frame rate. |

**Score:** 4/5 truths verified programmatically (SC-5 deferred to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/computeLayers.ts` | Pure base-z banding: `computeLayers`, `Layer`, `LayerModel`, `LAYER_Z_TOLERANCE`, `EXPLODE_FIXED_UNIT`, `ItemLike` | VERIFIED | 115 lines; exports all 6 named symbols; single `import type` from pack-contract; no runtime three |
| `src/lib/computeLayers.test.ts` | 8 SC-1 golden assertions against fixture + synthetic cases | VERIFIED | 79 lines; 8 tests, all green; P001/P002 literal baseZ arrays; F003 tall-box-by-base; empty model |
| `src/lib/camera-presets.ts` | Adds pure `inflateBboxForExplode(bbox, extraHeight)` | VERIFIED | `inflateBboxForExplode` exported at line 79; grows Y only, recentres up, no-op at 0; three-free |
| `src/components/viewer/Boxes.tsx` | Per-layer explode offset + `easing.damp`; `focusMode`/`focusIndex` props; `layerAppearance` helper; `GHOST_OPACITY`; `transparent={opacity<1}` guard | VERIFIED | Imports `easing` from maath; imports `EXPLODE_FIXED_UNIT` from computeLayers (no local literal); `layerAppearance` exported; per-layer groups; useFrame damp; material sets `transparent={opacity < 1}` |
| `src/components/viewer/LayerControls.tsx` | Bottom-center Explode + Layers sliders; Build-up/Isolate toggle; a11y; disabled states | VERIFIED | `absolute bottom-6 left-1/2 -translate-x-1/2`; `aria-label="Explode amount"`; `aria-label="Layer focus"`; `role="switch"` toggle; `Assembled`, `All`, `Single layer`, `No boxes` literals all present |
| `src/components/viewer/CameraPresets.tsx` | `explodeNonce`/`explodeExtraHeight` props; second effect keyed on explodeNonce only (not bbox/measureNonce) | VERIFIED | Props at lines 45-49; effect at lines 167-190 with `[explodeNonce, preset, camera]` dep array; `inflateBboxForExplode` called at line 171 |
| `src/components/result/PlacementList.tsx` | `onIsolate` + `selectedId` props; row `onClick`; persistent `ring-accent` cue; `data-selected` attribute | VERIFIED | Props at lines 38-40; `onClick={() => onIsolate?.(item.item_id)}`; `data-selected={isSelected || undefined}`; `border-accent ring-1 ring-accent` for selected vs `bg-accent-weak` for hover |
| `src/routes/ResultPage.tsx` | `focusMode`/`focusIndex`/`selectedId` state; `selectPallet` reset; `computeLayers` + `EXPLODE_FIXED_UNIT` imports; CoG gate; `window.__cogVisible` hook | VERIFIED | All state at lines 114-116; `selectPallet` at lines 153-159 resets all four; `computeLayers` + `EXPLODE_FIXED_UNIT` imported at line 39; `cogVisible = cogOn && explode === 0` at line 165; effect at line 166 writes window hook |
| `e2e/assembly-insight.spec.ts` | 10 named scenarios (5 explode + 5 layers); route-intercepted; deterministic hooks | VERIFIED | 10 `test(...)` blocks; stubbed Configure→Run→/result harness; `window.__cogVisible` hook; `window.__cameraState` hook; all 10 pass |
| `package.json` — maath direct dependency | `maath@^0.10.8` in dependencies | VERIFIED | `maath: ^0.10.8` present; react/three/r3f/drei quartet untouched |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/computeLayers.ts` | `src/types/pack-contract.ts` (PlacementOut) | `import type { PlacementOut }` | VERIFIED | Line 18: type-only import; no runtime dep on pack-contract |
| `src/lib/computeLayers.test.ts` | `src/lib/__fixtures__/pack-done-response.json` | fixture import for golden literals | VERIFIED | Line 10: `import fixture from '@/lib/__fixtures__/pack-done-response.json'` |
| `src/routes/ResultPage.tsx` | `src/lib/computeLayers.ts` | `computeLayers(selMapped.items)` + `EXPLODE_FIXED_UNIT` import | VERIFIED | Line 39 import; `computeLayers` called at line 219; `explodeExtraHeight` uses `EXPLODE_FIXED_UNIT` at line 226 |
| `src/components/viewer/Boxes.tsx` | `src/lib/computeLayers.ts` (`EXPLODE_FIXED_UNIT`) | `import { EXPLODE_FIXED_UNIT }` used in useFrame target | VERIFIED | Line 22 import; used at line 142 in `targetY = layerIndex * explode * EXPLODE_FIXED_UNIT` |
| `src/routes/ResultPage.tsx` | `src/components/viewer/CameraPresets.tsx` | `explodeNonce` + `explodeExtraHeight` props | VERIFIED | Lines 375-376 in JSX; CameraPresets receives both props |
| `src/components/viewer/CameraPresets.tsx` | `src/lib/camera-presets.ts` (`inflateBboxForExplode`) | called in the explode re-fit effect | VERIFIED | Line 20 import; used at line 171 |
| `src/routes/ResultPage.tsx` | `src/components/result/PlacementList.tsx` | `onIsolate` maps item_id → `layerModel.itemToLayer.get(id)+1`; `selectedId` | VERIFIED | Lines 431-438 in JSX; `layerModel.itemToLayer.get(id)` + `setFocusIndex(li + 1)` + `setSelectedId(id)` |
| `src/routes/ResultPage.tsx` | `selectPallet` reset path | `setFocusIndex(null)` on every pallet switch | VERIFIED | `selectPallet` at lines 153-159 is the only `onSelect` for PalletSwitcher; calls `setSel`, `setExplode(0)`, `setFocusMode('buildup')`, `setFocusIndex(null)`, `setSelectedId(null)` in one batched update |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Boxes.tsx` | `layered` (per-layer groups) | `computeLayers(selMapped.items)` via `layerModel` prop from ResultPage | Real placements from the settled API response | FLOWING |
| `LayerControls.tsx` | `explode`, `focusIndex`, `layerCount` | Props from ResultPage state; `layerCount = layerModel.layers.length` driven by real banding | State updates from real slider interaction | FLOWING |
| `ResultPage.tsx` | `layerModel` | `computeLayers(selMapped.items)` — plain const after `hasResult` guard | Real `done` result from react-query cache | FLOWING |
| `PlacementList.tsx` | `selectedId` persistent cue | `setSelectedId(id)` from `onIsolate` handler; `id` is the real `item_id` from placement row click | Real user interaction + real API item_id | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| computeLayers 8 SC-1 assertions | `npx vitest run src/lib/computeLayers.test.ts` | 8/8 passed | PASS |
| inflateBboxForExplode 3 golden cases | `npx vitest run src/lib/camera-presets.test.ts` | 12/12 passed (9 existing + 3 new) | PASS |
| Full unit suite (237 tests, no regression) | `npx vitest run` | 237/237 passed | PASS |
| Code-split gate (three absent from entry chunk) | `npm run build && node scripts/check-code-split.mjs` | Exit 0; three in lazy ResultPage chunk only | PASS |
| E2e assembly-insight (10 scenarios) | `npx playwright test e2e/assembly-insight.spec.ts` | 10/10 passed | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RESULT-07 | 08-01-PLAN, 08-02-PLAN, 08-03-PLAN | User can make a dense pallet legible via Explode slider + Layers control sharing one pure `computeLayers` model composing with existing viewer features | SATISFIED | `computeLayers` + `EXPLODE_FIXED_UNIT` verified; Explode slider wired end-to-end; Layers control with Build-up/Isolate; PlacementList row-click→isolate; `selectPallet` reset-on-switch; all 10 e2e scenarios green; code-split gate green |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/viewer/LayerControls.tsx` | 107-108 | `aria-checked` and `aria-pressed` both set on `role="switch"` button — `aria-pressed` is for `role="button"`, redundant here | INFO (IN-03 from review) | Minor a11y inconsistency; screen readers may announce state twice or inconsistently. No functional regression. |
| `src/routes/ResultPage.tsx` | 165 | `cogVisible = cogOn && explode === 0` — exact float equality on a stepped slider value | INFO (WR-03 from review) | The slider uses `step={0.05}` so values are always exact multiples; fragility is theoretical in current config. No user-visible impact. |
| `src/routes/ResultPage.tsx` + `src/components/viewer/Boxes.tsx` | N/A | `focusIndex` has no render-path clamp against `layerModel.layers.length`; `selectPallet` is the only protection | WARNING (CR-01 from review) | Structural fragility: if a future change introduces a second path to change `sel` without going through `selectPallet`, a stale out-of-range `focusIndex` would produce "all ghosted" or "build-up silently inactive." Today the only pallet-switch path is `selectPallet` (verified). Not a current blocker. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase-8 modified file.

### Human Verification Required

#### 1. Interactive Frame Rate on Dense Multi-Layer Presets (SC-5)

**Test:** Load the demo preset result in a real browser. Select pallet P002 (4 layers, 12 boxes). Drag the Explode slider from 0 to max and back, then scrub the Layers slider across all 4 layers in both Build-up and Isolate modes. Also combine both controls simultaneously (explode > 0 AND layer focus active).

**Expected:** The scene responds at interactive rates with no visible stutter; the per-layer `useFrame` + `maath easing.damp` animation is smooth; the opacity/visibility transitions are instantaneous or smooth without frame drops.

**Why human:** True FPS and perceptual smoothness under interactive WebGL drag cannot be asserted reliably in headless Playwright. This is the SC-5 manual-only check documented in 08-VALIDATION.md. The e2e proves non-empty renders and zero WebGL errors; interactive smoothness requires a human with a live browser.

### Gaps Summary

No programmatic gaps found. All 4 automatable success criteria are fully verified with code-level evidence. The single human verification item is SC-5 (interactive frame rate), which was always documented as a manual check in the validation contract. The CR-01 structural fragility (no render-path clamp on `focusIndex`) is a code quality advisory from the review — not a current behavioral failure, as the only pallet-switch path today is `selectPallet` which resets `focusIndex` to null.

---

_Verified: 2026-06-19T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
