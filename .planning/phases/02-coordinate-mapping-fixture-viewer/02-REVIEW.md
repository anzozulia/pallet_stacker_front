---
phase: 02-coordinate-mapping-fixture-viewer
reviewed: 2026-06-04T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - src/lib/fixture-types.ts
  - src/lib/mapping.ts
  - src/lib/mapping.test.ts
  - src/lib/palette.ts
  - src/lib/palette.test.ts
  - src/lib/camera-presets.ts
  - src/lib/camera-presets.test.ts
  - src/routes/ResultPage.tsx
  - src/components/viewer/Pallet.tsx
  - src/components/viewer/Boxes.tsx
  - src/components/viewer/CameraPresets.tsx
  - src/components/viewer/ViewerOverlay.tsx
  - src/styles.css
  - e2e/result-viewer.spec.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The phase 2 implementation covers coordinate mapping, colour-palette derivation, camera-preset math, the 3D viewer scene, and e2e validation. The code-split discipline is clean — no runtime `three` imports leak into the pure-lib files (`mapping.ts`, `palette.ts`, `camera-presets.ts`). The golden-fixture math is correct and independently verified: `mapPlacement` produces the literal expected values for both the non-rotated (T000) and rotated (D003) test cases, and the axis convention comment matches the implementation. No security issues were found. The primary concerns are a colour-collision defect in the hue-spin extension logic, a vacuous test assertion for `assertWithinEnvelope`, and hardcoded geometry constants in the pallet model that break parametric correctness for non-standard pallet widths.

## Warnings

### WR-01: `spinHue` produces a colour nearly indistinguishable from `SEED_COLORS[2]` for the first extended type

**File:** `src/lib/palette.ts:21`

**Issue:** When a 4th box type is added, `spinHue(SEED_COLORS[i % 3], i)` is called with `i=3`, which spins seed index 0 (`#6d63f5`, hue 244°) by `3×47 = 141°`, landing at hue **25°** (orange). `SEED_COLORS[2]` (`#e0892b`) has hue **31°**. The angular distance is only 6 degrees — the two swatches will be nearly identical amber/orange at the same saturation and lightness. The 5th type (i=4) lands at hue 7° (red-orange), also within 26° of the 3rd seed. The legend-readability guarantee silently fails for any fixture with more than 3 box types.

The root cause is that the spin formula `i * 47` starts from the ABSOLUTE index `i`, not from `i - SEED_COLORS.length`. For i=3, the first extended type, the step is effectively identical to where the seed happened to land. Changing to `(i - SEED_COLORS.length) * 47` (or multiplying by a step that is offset away from the seed hues) would spread extended colours away from the seed cluster.

**Fix:**
```ts
// palette.ts line 21 — shift by (i - SEED_COLORS.length) steps, not i steps
i < SEED_COLORS.length
  ? SEED_COLORS[i]
  : spinHue(SEED_COLORS[i % SEED_COLORS.length], i - SEED_COLORS.length)
```
With `i=3`, the spin becomes `0 × 47 = 0°` from the wrapped seed — but that is still the seed hue. A better fix is to add a base offset that lands far from all three seeds:
```ts
// Add a base_offset so i=3 starts ~120° from the nearest seed
spinHue(SEED_COLORS[i % SEED_COLORS.length], i - SEED_COLORS.length + /* tune */8)
```
The simplest correctness fix is to change the step from 47° to a value that guarantees the first extension is far from all three seed hues (e.g. step=73° or starting offset=6 pushes i=3 to 244+6×47=526→166°, well clear of all seeds).

---

### WR-02: `assertWithinEnvelope` test assertion is vacuously true and provides no coverage of the violation branch

**File:** `src/lib/mapping.test.ts:69-72`

**Issue:** `assertWithinEnvelope` signals a violation with `console.error`, not by throwing. The test assertion `expect(() => ... assertWithinEnvelope(p, ...) ...).not.toThrow()` can never fail regardless of whether violations are reported, because the function never throws. If `assertWithinEnvelope` were silently broken (e.g., it called `console.error` with wrong coordinates, or its condition was inverted), the test would still pass. The violation branch is completely un-exercised.

**Fix:** To actually assert the function detects violations, spy on `console.error` and assert it is NOT called on valid data (conversely, IS called on a crafted out-of-envelope placement):
```ts
import { vi } from 'vitest';

it('assertWithinEnvelope: no console.error on valid geometry', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  pallet0.items.forEach((p) => assertWithinEnvelope(p, pallet0.dimensions));
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('assertWithinEnvelope: console.error on out-of-envelope box', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  assertWithinEnvelope(
    { item_id: 'X', position: { x: -1, y: 0, z: 0 }, dimensions: { L: 10, W: 10, H: 10 } },
    { L: 1000, W: 800, H: 1000, max_weight: 250 },
  );
  expect(spy).toHaveBeenCalledOnce();
  spy.mockRestore();
});
```

---

### WR-03: Pallet support-block geometry uses hardcoded 90 mm offsets regardless of pallet width

**File:** `src/components/viewer/Pallet.tsx:71`

**Issue:** The three support-block z-positions are `[-W/2 + 90, 0, W/2 - 90]` — a 90 mm fixed inset, hardcoded regardless of `W`. For any pallet width other than the fixture's 800 mm, the blocks will not align with the slats (which are spaced at `W/slatN` intervals). For a narrow pallet (e.g. W=600), the 90 mm inset places blocks roughly at -210, 0, 210 mm — under slats that are spaced at 100 mm intervals starting at ±250 mm centres. The block-to-slat alignment will be wrong. Similarly the block width (also 90 mm) is fixed. While only W=800 appears in the current fixture, this component accepts a `width` prop and is intended to be parametric.

**Fix:** Express the inset and block width as a fraction of `W` (matching the slat layout):
```tsx
// Replace lines 71-76 with:
const blockWidth = Math.max(W * 0.11, 80); // ~90 mm for W=800, scales with width
const blockInset = W * 0.11;               // same fraction so block aligns under outer slat
{[-W / 2 + blockInset, 0, W / 2 - blockInset].map((zp, i) => (
  <mesh key={`block-${i}`} position={[0, BLOCK_H / 2, zp]} castShadow receiveShadow>
    <boxGeometry args={[L, BLOCK_H, blockWidth]} />
    <meshStandardMaterial color={WOOD_SIDE} roughness={0.85} />
  </mesh>
))}
```

---

### WR-04: Initial preset framing uses a wrong default bbox until bbox measurement completes, causing a visible camera jump on first render

**File:** `src/components/viewer/CameraPresets.tsx:42-78`

**Issue:** Two `useEffect` calls fire on mount: one measures the real scene bbox from `boxesRef` and one animates the camera to the preset position. Both fire after the same commit phase. The animation effect's dependency array includes `bbox`, so when `setBbox(measured)` runs, the animation effect re-fires with the correct bbox — correct in steady state. However, the FIRST execution of the animation effect at mount uses `bbox = { center: [0,0,0], size: [1000,1000,1000] }` (the default state), which computes a camera position derived from that default bbox. If `boxesRef.current` is populated (which it will be in r3f after the first commit), the bbox effect also fires in the same microtask batch, but `setBbox` schedules a re-render — the animation effect runs with the wrong bbox for the first frame, then re-runs with the corrected one. This creates a brief camera snap: the camera jumps toward the default-bbox ISO position, then immediately starts over toward the real-bbox ISO position.

The default bbox (`size: [1000,1000,1000]`) happens to be numerically close to the actual fixture scene size (~1000×1000mm footprint), so the snap is small in practice. However it is a correctness defect that will be more visible with fixtures of very different sizes (e.g. a compact pallet 400×300 mm with low boxes).

**Fix:** Initialise `bbox` as `null` (or an `undefined` sentinel) and skip the animation effect until bbox is available:
```ts
const [bbox, setBbox] = useState<Bbox | null>(null);

// Animate only when bbox is measured
useEffect(() => {
  if (!bbox) return;          // wait for real measurement
  const controls = controlsRef.current;
  if (!controls) return;
  const { position, target } = presetFromBbox(bbox, preset);
  anim.current = { ... };
}, [preset, presetNonce, bbox, camera]);
```
Pass `minDistance`/`maxDistance` to `OrbitControls` only after bbox is known (provide sensible fallback defaults or omit them until measured).

## Info

### IN-01: `useMemo` with empty dependency array on a module-level constant is redundant

**File:** `src/routes/ResultPage.tsx:29`

**Issue:** `DATA` is a module-level `const` (`const DATA = doneResponse as DoneResponse`), which is frozen at module evaluation. `useMemo(() => buildPalette(DATA), [])` will never re-compute after the first render. This is correct but the `useMemo` wrapping provides no benefit — `buildPalette(DATA)` could be called directly at module level and assigned to a constant. The current pattern misleads readers into believing the palette depends on something render-time.

**Fix:**
```ts
// At module level (outside the component):
const PALETTE = buildPalette(DATA);
const LEGEND: [string, string][] = [...PALETTE.entries()];

// Inside ResultPage — remove the two useMemo calls and reference PALETTE/LEGEND directly.
```

---

### IN-02: `typeKeyOf` silently degrades for item IDs that start with a digit

**File:** `src/lib/mapping.ts:55-58`

**Issue:** `typeKeyOf` returns the full `itemId` as the type key when no leading non-digit prefix is found. For IDs like `'0T100'` or `'123'`, every item would get its own unique "type" key, producing a separate legend row and a unique colour per item rather than per type. There is no validation or warning. The API fixture uses alphabetic prefixes (`T`, `D`, `F`) so this does not affect the current phase, but the silent fallback masks a future integration risk.

**Fix:** Add a dev-mode warning (same `import.meta.env.DEV` guard pattern used in `assertWithinEnvelope`):
```ts
export function typeKeyOf(itemId: string): string {
  const m = /^[^\d]+/.exec(itemId);
  if (!m && import.meta.env.DEV) {
    console.warn('[typeKeyOf] item_id has no leading non-digit prefix:', itemId);
  }
  return m ? m[0] : itemId;
}
```

---

### IN-03: E2E `settled` check has a theoretical polling-interval race condition

**File:** `e2e/result-viewer.spec.ts:58-61`

**Issue:** `waitForFunction` polls `window.__cameraState?.settled === true`. The `settled` flag is written `true` by `useFrame` at the END of a completed animation, then cleared (anim set to null), after which `useFrame` no longer updates `__cameraState`. When a new preset button is clicked, `useEffect` sets `anim.current` with a new `start` time but `useFrame` must fire at least once (one rAF) before `settled` transitions to `false`. If `waitForFunction` polls in the narrow window between the click and the first rAF, it sees the PREVIOUS animation's `settled: true` and returns early — capturing the old camera position rather than the new one.

In practice the risk is negligible: `ANIM_MS = 520 ms` and Playwright's default poll interval is 100 ms, so ~6 animation frames fire before the first poll. But the pattern is fragile by construction.

**Fix:** Reset `__cameraState.settled` to `false` synchronously on the first frame of each new animation (before the `k >= 1` check) rather than relying on timing:
```ts
// In useFrame, at the start of the if(a && controls) block:
(window as Window & { __cameraState?: unknown }).__cameraState = {
  position: [...],
  target: [...],
  settled: k >= 1,   // already the case — but add a reset on new anim start
};
```
Alternatively, expose a `__animNonce` alongside `settled` in the state, and have the e2e test wait for both `settled === true` AND `nonce === expected`, so stale settled state from a previous animation is unambiguous.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
