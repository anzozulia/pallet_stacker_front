---
phase: 08-assembly-insight-layer-explode-isolation-in-the-3d-viewer
reviewed: 2026-06-19T00:00:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - e2e/assembly-insight.spec.ts
  - src/components/result/PlacementList.test.tsx
  - src/components/result/PlacementList.tsx
  - src/components/viewer/Boxes.tsx
  - src/components/viewer/CameraPresets.tsx
  - src/components/viewer/LayerControls.tsx
  - src/lib/camera-presets.test.ts
  - src/lib/camera-presets.ts
  - src/lib/computeLayers.test.ts
  - src/lib/computeLayers.ts
  - src/routes/ResultPage.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-19T00:00:00Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase-8 assembly-insight slice: pure base-z layer banding (`computeLayers`), camera-preset math (`camera-presets`), the `Boxes` per-layer explode/focus renderer, the `CameraPresets` driver, the `LayerControls` bar, the `PlacementList` rail, `ResultPage` wiring, and the unit/e2e tests. The pure-math modules are well-tested with hand-stated golden literals and the three-free / code-split discipline is respected throughout.

The adversarial pass surfaced one cross-component correctness bug (stale `focusIndex` surviving a pallet switch into a smaller stack), several robustness gaps in the layer/group lifecycle and the slider readout logic, and a number of quality/maintainability defects. The most serious is the stale-focus interaction because it produces a visibly wrong scene and an out-of-range slider after a common user action (pallet switch), and the existing e2e suite does not cover the 4-layer -> 2-layer direction that triggers it.

## Critical Issues

### CR-01: Stale `focusIndex` survives a row-click isolation across a pallet switch into a smaller stack, hiding/ghosting non-existent layers and de-syncing the slider

**File:** `src/routes/ResultPage.tsx:153-159`, `src/components/viewer/Boxes.tsx:74-88`, `src/components/viewer/LayerControls.tsx:124-137`

**Issue:** `selectPallet` resets `focusIndex` to `null` on a switch, which is correct *as long as the switch goes through the PalletSwitcher*. But `focusIndex` is also set by the placement-row isolate seam to `li + 1` (`ResultPage.tsx:435`), where `li` is the clicked box's 0-based layer in the *currently selected* pallet. P002 has 4 layers, so a row click there can set `focusIndex = 4`. The reset only runs inside `selectPallet`; there is no clamp of `focusIndex` against the *new* pallet's `layerModel.layers.length` anywhere on the render path.

Concretely, the failure occurs on this sequence even with the reset in place because nothing re-validates `focusIndex` against the live layer count:

- `focusIndex` is consumed directly by `layerAppearance(layerIndex, focusMode, focusIndex)` with `k0 = focusIndex - 1`. If `focusIndex` (e.g. 4) exceeds the new pallet's layer count (e.g. 2 layers, indices 0..1), then in `buildup` mode `layerIndex <= k0` is true for *every* layer (no layer is ever hidden — the build-up control silently does nothing), and in `isolate` mode `layerIndex === k0` is never true, so *every* layer is ghosted to `GHOST_OPACITY` and the focused layer never appears solid — the scene reads as "all ghosts, nothing isolated."
- `LayerControls` renders `value={focusIndex ?? 0}` into `<input type="range" max={layerCount}>` (lines 126-128). A controlled range whose `value` (4) exceeds `max` (2) is clamped by the browser to `max` on display but the React state stays 4, so the slider thumb and the `Layer {focusIndex} / {layerCount}` readout (`= "Layer 4 / 2"`, line 63) disagree with each other and with the actual rendered scene.

`selectPallet` masks this only for the switcher path; the bug is structural — `focusIndex` is an absolute index held in parent state with no invariant tying it to the currently selected pallet's layer count. Any future caller that sets `sel` without also resetting focus (or any reorder of state updates) reintroduces it, and the "Layer 4 / 2" readout is reachable today if focus state and selection ever desync by a frame.

**Fix:** Clamp/validate `focusIndex` against the selected pallet's layer count on the render path so it can never address a non-existent layer, instead of relying solely on the imperative reset in `selectPallet`:

```ts
// ResultPage.tsx, after layerModel is computed
const layerCount = layerModel.layers.length;
// An absolute focus index is only valid for THIS pallet; collapse out-of-range to "All".
const safeFocusIndex =
  focusIndex != null && focusIndex >= 1 && focusIndex <= layerCount ? focusIndex : null;
```

Pass `safeFocusIndex` to both `<Boxes focusIndex={safeFocusIndex}>` and `<LayerControls focusIndex={safeFocusIndex}>`. This guarantees the readout, the slider thumb, and the scene agree regardless of how `sel`/`focusIndex` are updated. Add a regression e2e that switches from P002 (4 layers) with a focus set down to P001 (2 layers) and asserts the readout is `All` and the canvas equals the assembled baseline.

## Warnings

### WR-01: `LayerControls` `onFocusMode`/`onFocusIndex` are wired to the raw `setFocusMode`/`setFocusIndex`, bypassing the `selectedId` persistent-cue contract

**File:** `src/routes/ResultPage.tsx:388-390`, `src/components/result/PlacementList.tsx:81-83`

**Issue:** The placement-row isolate seam sets three pieces of state together — `setFocusMode('isolate')`, `setFocusIndex(li+1)`, `setSelectedId(id)` (lines 433-437) — and `PlacementList` shows the persistent selected ring keyed on `selectedId`. But when the user drives the *slider* or the *mode toggle* in `LayerControls`, the handlers are the bare setters (`onFocusMode={setFocusMode}`, `onFocusIndex={setFocusIndex}`), which change the focused layer/mode *without clearing `selectedId`*. Result: after isolating row "T000" via click, then moving the Layers slider to a different layer, the placement card for T000 still shows the persistent "selected" ring even though that box's layer is no longer the focused one. The selected cue now lies about which layer is isolated.

**Fix:** Wrap the slider/mode handlers so a manual focus change clears the stale row selection:

```ts
onFocusMode={(m) => { setFocusMode(m); }}
onFocusIndex={(i) => { setFocusIndex(i); setSelectedId(null); }}
```

(Clear `selectedId` whenever focus is driven by a control rather than a row click, so the persistent cue only ever marks the row that drove the *current* isolation.)

### WR-02: `groupRefs` retains entries for layers that no longer exist after a pallet switch, and `useFrame` keeps damping orphaned groups

**File:** `src/components/viewer/Boxes.tsx:134-145, 160-163`

**Issue:** `groupRefs` is a `useRef<Map<number, Group>>` populated by the per-group `ref` callback. The callback deletes an entry when r3f passes `null` on unmount (line 162). On a pallet switch from a 4-layer pallet to a 2-layer pallet, layers 2 and 3 unmount and *should* be cleaned up — but r3f's ref-cleanup ordering is not guaranteed to run before the next `useFrame`, and because the map is keyed by `layerIndex` (not identity), a stale entry for a now-removed layer index can persist for one or more frames. `useFrame` (lines 140-145) iterates `groupRefs.current` unconditionally and calls `easing.damp(group.position, 'y', ...)` on whatever `Group` objects are still in the map, including a disposed/detached group. This is at best wasted work and at worst a write to a stale object. The map is never proactively reconciled against the current `layered` array.

**Fix:** Reconcile the ref map against the current layer set each render, or iterate the current `layered` entries instead of the raw map in `useFrame`:

```ts
useFrame((_, dt) => {
  for (const [layerIndex] of layered) {
    const group = groupRefs.current.get(layerIndex);
    if (!group) continue;
    easing.damp(group.position, 'y', layerIndex * explode * EXPLODE_FIXED_UNIT, 0.18, dt);
  }
});
```

This bounds the loop to layers that currently exist and ignores any stale ref entries.

### WR-03: `explodeReadout` and `layersReadout` use exact float equality (`explode === 0`) against a stepped float slider, and the "Assembled"/"All" e2e text is ambiguous

**File:** `src/components/viewer/LayerControls.tsx:49-63`, `e2e/assembly-insight.spec.ts:123, 233`

**Issue:** `explode === 0` (line 52) is an exact float comparison. The slider uses `step={0.05}` over `[0,1]`; `valueAsNumber` for stepped HTML ranges is generally exact for these multiples, but the SC-3 "byte-identical assembled stack" guarantee hinges entirely on this equality being reached exactly. Any future change to `step` (e.g. `0.1`-incompatible values) or any programmatic set that lands on `1e-16` silently breaks the "Assembled" readout *and* the CoG-visible gate in `ResultPage.tsx:165` (`explode === 0`), which is the same fragile comparison driving a user-visible feature. Separately, the e2e asserts `getByText('Assembled', { exact: true })` and `getByText('All', { exact: true })` — both readout strings can also appear in unrelated chrome, making these assertions brittle to copy changes elsewhere on the page.

**Fix:** Treat "assembled" as a small-epsilon test rather than exact equality, and centralize it so the readout and the CoG gate cannot diverge:

```ts
const ASSEMBLED_EPS = 1e-6;
const isAssembled = explode <= ASSEMBLED_EPS;
```

Use `isAssembled` for both the readout and `ResultPage`'s `cogVisible`. Scope the e2e text assertions to the control (e.g. `within(layerControlsBar).getByText('Assembled')`).

### WR-04: Empty-pallet explode/focus is reachable but the deck-fallback path is not exercised, and `layerCount === 0` disables Explode yet `explodeExtraHeight` still computes from a non-empty `Math.max(0, -1)`

**File:** `src/routes/ResultPage.tsx:225-226`, `src/components/viewer/LayerControls.tsx:45, 79`

**Issue:** When a pallet has zero placed boxes, `layerModel.layers.length === 0`, so `explodeExtraHeight = Math.max(0, 0 - 1) * explode * UNIT = 0` — correct. But `LayerControls` disables the Explode slider on `empty` (`disabled={empty}`, line 79) while the underlying `explode` state can still be non-zero if it was raised on a *previous* non-empty pallet and the switch path did not run (see CR-01's structural concern). The disabled slider then shows a non-zero `explode` value it cannot edit, and `Boxes` still applies `layerIndex * explode * UNIT` offsets to any boxes — except there are none, so it's invisible. The net effect is a disabled control showing a stale non-zero state. The deck-fallback bbox path (`CameraPresets.tsx:89-95`) that this empty case depends on has no automated coverage at all (no fixture pallet with zero items, no e2e), so a regression in the `box.isEmpty()` branch (which guards against NaN camera transforms) would ship silently.

**Fix:** Force `explode` to 0 (and `focusIndex` to null) whenever the selected pallet is empty, e.g. derive a `safeExplode = layerCount === 0 ? 0 : explode` on the render path, and add a unit/e2e fixture with a zero-item pallet to exercise the `fallbackBbox` branch.

### WR-05: `result` cast to `DoneResult` bypasses the shape validation that `hasResult` only partially performs

**File:** `src/routes/ResultPage.tsx:89-95, 172, 209-213`

**Issue:** `hasResult` validates that `done.result.pallets` is a non-empty array, but `result = (done?.result ?? null) as DoneResult` (line 172) then trusts the *entire* `DoneResult` shape — including `pallets[i].dimensions`, `pallets[i].pallet_id`, `pallets[i].cog`, and each item's `position`/`dimensions`. `result` is `z.unknown()` at the poll boundary (per the file's own comment), so a malformed body that *happens* to have a non-empty `pallets` array but a pallet missing `dimensions` will pass `hasResult` and then crash at `const d = selPallet.dimensions` -> `d.L` (line 212, 231) or at `selPallet.cog` (passed to `CogMarker`). The guard checks the array boundary but not the per-pallet shape the render path immediately dereferences.

**Fix:** Either run the actual zod `DoneResult` schema in the guard (preferred — the contract schema already exists) so a malformed body redirects, or null-guard the specific dereferences (`selPallet?.dimensions`) before use. The current partial check gives a false sense of safety against the exact "malformed API body" threat the comment claims to defend.

### WR-06: `bbox` state initialized to a magic `1000×1000×1000` cube duplicated in three places, masking a measurement failure as a plausible frame

**File:** `src/components/viewer/CameraPresets.tsx:72, 90`

**Issue:** The default `bbox` state and the `fallbackBbox ?? { center:[0,0,0], size:[1000,1000,1000] }` fallback both hardcode the same `1000` cube literal (lines 72 and 90), and `ResultPage` supplies yet another `fallbackBbox` shape. If the boxes group fails to measure (ref not ready, async timing) the camera silently frames a phantom 1m cube at the origin rather than surfacing the failure — a measurement bug would look like a slightly-off camera rather than an error, making it hard to diagnose. The magic number is also duplicated, so the two fallbacks can drift.

**Fix:** Extract the degenerate-default bbox to a single named constant in `camera-presets.ts` (alongside `FRAMING_K`) and reference it in both spots. Consider logging a dev-only warning when the measured box is empty *and* no `fallbackBbox` was provided, so a silent phantom-cube frame is observable in development.

## Info

### IN-01: `inflateBboxForExplode` integer-divide-by-two of `extraHeight` is fine but the no-op-at-0 contract relies on `extraHeight === 0` exact equality

**File:** `src/lib/camera-presets.ts:79-86`

**Issue:** `inflateBboxForExplode(bbox, 0)` returns a value-equal bbox only when `extraHeight` is *exactly* 0. `explodeExtraHeight` is computed as `Math.max(0, layers.length - 1) * explode * EXPLODE_FIXED_UNIT` (ResultPage:225-226); at `explode === 0` this is exactly 0, so the contract holds today. It is worth a one-line note that the SC-3 no-op guarantee is transitively coupled to the same exact-zero comparison flagged in WR-03.

**Fix:** No code change required; document the coupling or adopt the WR-03 epsilon at the single `explode === 0` source so all three consumers (readout, CoG gate, inflate) share one definition of "assembled."

### IN-02: `safeNum` coerces non-finite `position.z` to 0, which silently merges a malformed box into the floor band rather than flagging it

**File:** `src/lib/computeLayers.ts:62-65, 87-88`

**Issue:** A box with `NaN`/`Infinity` `position.z` is banded into layer 0 (base 0). This is the deliberate "never produce NaN bands" guard (T-08-DOS) and is reasonable, but it means a genuinely-malformed placement is invisibly assigned to the floor layer with no diagnostic. For a debugging-oriented tool, a dev-only `console.warn` on coercion would aid troubleshooting without affecting prod.

**Fix:** Optional — emit a dev-only warning when `safeNum` actually substitutes the fallback, gated on `import.meta.env.DEV` so it tree-shakes out of prod.

### IN-03: `aria-checked` and `aria-pressed` both set on a `role="switch"` button is redundant and can confuse some screen readers

**File:** `src/components/viewer/LayerControls.tsx:106-108`

**Issue:** The mode-toggle buttons carry `role="switch"` with both `aria-checked={on}` and `aria-pressed={on}`. For `role="switch"`, `aria-checked` is the correct state attribute; `aria-pressed` is for `role="button"`/toggle buttons. Having both is contradictory ARIA and some assistive tech may announce it twice or inconsistently.

**Fix:** Drop `aria-pressed` and keep `aria-checked` for the `role="switch"` element.

### IN-04: Duplicated magic colour/opacity literals and inline Tailwind arbitrary values across the viewer chrome

**File:** `src/components/viewer/LayerControls.tsx:70, 85, 115, 136`, `src/components/viewer/Boxes.tsx:64, 184`

**Issue:** Several raw hex/opacity literals are repeated inline (`bg-[#1a2030]`, `bg-[#0c0f17]`, `bg-[#222a3d]`, edge `opacity={0.55}`, `GHOST_OPACITY = 0.15`). These mirror the dark-viewer token group described in CLAUDE.md (`--d-bg`, etc.) but are not consistently routed through the `--color-d-*` CSS variables that the same files use elsewhere (`var(--color-d-border)`, `var(--color-d-text)`). The mix of token references and raw literals invites drift.

**Fix:** Promote the remaining raw viewer hex literals to the existing `--color-d-*` theme tokens so the dark overlay palette has a single source of truth, matching the CLAUDE.md token-group intent.

---

_Reviewed: 2026-06-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
