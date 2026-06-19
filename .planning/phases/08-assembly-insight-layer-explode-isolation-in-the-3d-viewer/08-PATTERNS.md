# Phase 8: Assembly Insight — Layer Explode & Isolation - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7 (all in-repo; this is a brownfield extension)

> Every new file has a strong same-role, same-repo analog. The phase is wiring + one
> genuinely new pure module (`computeLayers`). RESEARCH.md already mapped files + line
> numbers; this document pins the **concrete code to copy from** per file.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/computeLayers.ts` (NEW) | utility (pure lib) | transform | `src/lib/cog-map.ts` / `camera-presets.ts` | exact (role + three-free + pure) |
| `src/lib/computeLayers.test.ts` (NEW) | test | transform | `src/lib/cog-map.test.ts` | exact (golden-literal vitest) |
| `src/lib/camera-presets.ts` (EDIT — add `inflateBboxForExplode`) | utility (pure lib) | transform | itself (`presetFromBbox`, `distanceLimitsFromBbox`) | exact |
| `src/components/viewer/Boxes.tsx` (EDIT) | component (r3f mesh) | event-driven (render loop) | itself (declarative emissive `useMemo`) + `CameraPresets.tsx` (`useFrame`) | exact |
| `src/components/viewer/CameraPresets.tsx` (EDIT — explode re-fit) | component (r3f camera) | event-driven | itself (preset-animation effect + `bboxRef` decouple) | exact |
| `src/components/viewer/ViewerOverlay.tsx` (EDIT — bottom-center bar) or `LayerControls.tsx` (NEW) | component (DOM chrome) | request-response (UI) | `ViewerOverlay.tsx` (top-center toggle cluster, bottom-right presets) | exact |
| `src/components/result/PlacementList.tsx` (EDIT — row click) | component (DOM list) | event-driven | itself (one-way `onHover` seam) | exact |
| `src/routes/ResultPage.tsx` (EDIT — explode/focus state) | route (state owner) | event-driven | itself (`sel`/`cogOn`/`heatmap`/`presetNonce` state) | exact |

---

## Pattern Assignments

### `src/lib/computeLayers.ts` (NEW — utility, pure transform)

**Analog:** `src/lib/cog-map.ts` (pure, three-free, golden-tested sibling of `mapping.ts`).

**Module-header + three-free import pattern** (`cog-map.ts:1-19`): leading doc comment
explaining the empirical risk + the code-split constraint, then **type-only** contract import.
Copy this exact shape (banding bands by `position.z` = the API base-z that `mapping.ts:45`
maps to `center.y = DECK_TOP_Y + z + H/2`):
```ts
// Keep this module free of any runtime `three` import (type-only at most) so it stays
// outside the lazy /result chunk and does not threaten the code-split build gate.
import type { PlacementOut } from '@/types/pack-contract';
```
> The analog imports a runtime value `DECK_TOP_Y` from `./mapping` — `computeLayers` should
> NOT need even that; it works on raw `position.z` + `dimensions.H` numbers. (L-05 / Pitfall 3)

**Algorithm + output shape:** RESEARCH.md §Code Examples (lines 332-373) gives the exact
greedy-from-base banding and the `Layer` / `LayerModel { layers, itemToLayer }` interfaces.
Use `LAYER_Z_TOLERANCE = 5` (RESEARCH A1 — re-verify against `demo-presets.ts` before locking).

**Input type** — accept the mapper's array element (`result-mapper.ts:31-37`):
`ReadonlyArray<Pick<PlacementOut, 'item_id' | 'position' | 'dimensions'>>` (mirror
`mapping.ts:29` `PlacementLike` narrowing so a literal or a full item both pass).

---

### `src/lib/computeLayers.test.ts` (NEW — test, golden-literal vitest)

**Analog:** `src/lib/cog-map.test.ts` (read in full).

**Wiring + golden-literal convention** (`cog-map.test.ts:1-10`): `@/` alias import, jsdom,
no Canvas, hand-computed literals (NOT formula-re-derived) with a comment citing the fixture:
```ts
import { describe, expect, it } from 'vitest';
// Golden arrays are hand-computed LITERALS (NOT re-derived from the formula) so a bug fails
// loudly. Fixture values come from pack-done-response.json.
import { computeLayers } from '@/lib/computeLayers';
```

**Assertion contract:** RESEARCH.md §"What `computeLayers` unit tests MUST assert" (lines
462-470) — 8 assertions. The golden literals come from RESEARCH.md lines 378-385:
`P001 → 2 layers [baseZ 0, 700]`; `P002 → 4 layers [0, 150, 350, 700]`; the H=350 box at
z=0 must land in layer 0 (tall-box-bands-by-base); single-layer + floating cases synthetic.
Mirror `cog-map.test.ts`'s `it('...explicit-claim...')` naming.

---

### `src/lib/camera-presets.ts` (EDIT — add pure `inflateBboxForExplode`)

**Analog:** itself — `presetFromBbox` (`camera-presets.ts:46-69`) + `distanceLimitsFromBbox`
(`camera-presets.ts:211-214`). Both are pure `Bbox → …` helpers with golden tests.

**Pattern to copy** — a pure function over the existing `Bbox` interface
(`camera-presets.ts:13-16`), growing only the Y extent + recentering (RESEARCH A5):
```ts
// Pure (no three/react) — keeps the code-split gate green, jsdom-testable like its siblings.
export function inflateBboxForExplode(bbox: Bbox, extraHeight: number): Bbox {
  const [cx, cy, cz] = bbox.center;
  const [sx, sy, sz] = bbox.size;
  return { center: [cx, cy + extraHeight / 2, cz], size: [sx, sy + extraHeight, sz] };
}
```
Add golden cases to `camera-presets.test.ts` (RESEARCH Wave-0 gap). `extraHeight` =
`maxLayerIndex × explode × FIXED_UNIT`.

---

### `src/components/viewer/Boxes.tsx` (EDIT — explode offset + per-layer visibility/opacity)

**Analog:** itself. Two existing patterns to extend, NOT replace.

**(a) Declarative `useMemo` map + derived props** (`Boxes.tsx:51-67`): attach `layerIndex`
(from `computeLayers().itemToLayer`) per box inside the SAME memo. Add `explode`/`focusMode`/
`focusIndex` to the dep array.

**(b) Declarative material props — NO imperative mutation** (`Boxes.tsx:77-83`): the existing
hover glow proves the convention. Ghost/dim composes as a SIBLING prop — set ONLY
`transparent`+`opacity`, leave `color`/`emissive` owned by the existing heatmap/hover logic
(Pitfall 4). At opacity 1 set `transparent={false}` (Pitfall 5 — keep default byte-identical):
```tsx
<meshStandardMaterial
  color={b.color}
  emissive={b.color}
  emissiveIntensity={hoveredId === b.id ? 0.45 : 0}   // UNCHANGED — hover composes
  transparent={opacity < 1}                            // NEW — false at default
  opacity={opacity}                                    // NEW — ghost = ~0.15
  roughness={0.62}
  metalness={0.04}
/>
```

**(c) Explode animation via `useFrame` + dt-aware damp** — mirror `CameraPresets.tsx:145-178`
(the in-repo `useFrame` precedent). RESEARCH Pattern 1 (lines 201-225) recommends per-layer
`<group>` wrappers (≤4 in fixture), target Y = `layerIndex × explode × FIXED_UNIT`,
`easing.damp(g.position, 'y', targetY, 0.18, dt)` from `maath`. The group also carries
`visible` (build-up hide). Keep individual meshes INSIDE the group (L-01).

---

### `src/components/viewer/CameraPresets.tsx` (EDIT — explode re-fit, decoupled trigger)

**Analog:** itself — the existing preset-animation effect (`CameraPresets.tsx:112-143`) and
its `bboxRef` decoupling rationale (`CameraPresets.tsx:62-68`).

**The load-bearing pattern (Pitfall 1):** add a NEW effect that reads the bbox via `bboxRef`,
inflates it, and reframes — keyed ONLY on `explodeNonce` (+ `preset`). Do NOT add `bbox`/
`explode`/`measureNonce` to it (a pallet switch must not snap the camera — D-02):
```tsx
// New effect ALONGSIDE the existing preset effect — same bboxRef discipline.
useEffect(() => {
  const controls = controlsRef.current;
  if (!controls) return;
  const inflated = inflateBboxForExplode(bboxRef.current, explodeExtraHeight);
  const { position, target } = presetFromBbox(inflated, preset);   // reuse pure helper
  // ...build anim.current exactly like lines 132-140...
}, [explodeNonce, preset, camera]);   // NOT measureNonce, NOT bbox
```
The animation `useFrame` (lines 145-178) and `anim.current` shape (lines 99-107) are reused
unchanged. Add `explodeNonce` + `explodeExtraHeight` to `CameraPresetsProps` (mirror
`measureNonce` prop doc at lines 30-32).

---

### `src/components/viewer/ViewerOverlay.tsx` (EDIT) — or `LayerControls.tsx` (NEW)

**Analog:** `ViewerOverlay.tsx` — the top-center toggle cluster (lines 109-136) and the
bottom-right preset cluster (lines 139-158).

**Container pattern** (`ViewerOverlay.tsx:109-112`): `pointer-events-none` wrapper, the
control cluster `pointer-events-auto`, anchored + centered. The new bar is `bottom-6`:
```tsx
<div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
```

**Pill / toggle styling** (`ViewerOverlay.tsx:119-135`): copy the `role="switch"` button +
the exact active/inactive class pair for the Build-up/Isolate toggle (accent = active mode):
```tsx
<button
  type="button" role="switch" aria-checked={on} aria-pressed={on} onClick={onToggle}
  className={clsx(
    'cursor-pointer rounded-md border px-[10px] py-[6px] font-mono text-xs leading-tight transition-colors',
    on
      ? 'border-[rgba(124,116,255,0.6)] bg-accent text-white'
      : 'border-[var(--color-d-border)] bg-[#1a2030] text-[var(--color-d-text-2)] hover:bg-[#222a3d] hover:text-[var(--color-d-text)]',
  )}
>{label}</button>
```

**Sliders** (NO existing `<input type=range>` in repo — net-new): native `<input type="range">`
with `aria-label` + `aria-valuetext` matching the readout (UI-SPEC a11y, §Don't Hand-Roll).
Accent fill+thumb, `#1a2030` track. Readouts per UI-SPEC: `Assembled` at explode 0, `All` /
`Layer {k} / {N}` for layers, `Single layer` / `No boxes` disabled states.

---

### `src/components/result/PlacementList.tsx` (EDIT — row click → isolate)

**Analog:** itself — the one-way hover seam (`PlacementList.tsx:80-94`).

**Pattern to extend** (D-12): add `onClick` alongside the existing `onMouseEnter`/`onMouseLeave`,
and a PERSISTENT selected cue distinct from transient hover. Reuse the existing accent cue
(line 93) for the selected row; keep hover unchanged:
```tsx
<div
  key={item.item_id}
  onMouseEnter={() => { setHovered(item.item_id); onHover(item.item_id); }}
  onMouseLeave={() => { setHovered(null); onHover(null); }}
  onClick={() => onIsolate?.(item.item_id)}   // NEW — D-12; parent maps item_id → layer
  className={clsx(
    'rounded-[12px] border px-5 py-4 transition-colors duration-150',
    isSelected ? 'border-accent ring-1 ring-accent' :     // NEW persistent cue
    isHovered ? 'border-accent bg-accent-weak' : 'border-border bg-surface',
  )}
>
```
Add `onIsolate?: (itemId: string) => void` + `selectedId?: string | null` to props (mirror
the existing `onHover` prop doc at lines 35-36). Optional `Layer {k}` chip reuses the `Field`
micro-label style (`PlacementList.tsx:43-44`). Keep the C-04 import discipline (no three).

---

### `src/routes/ResultPage.tsx` (EDIT — viewer-state owner)

**Analog:** itself — the existing viewer-state block (`ResultPage.tsx:105-121`).

**State pattern to mirror** (lines 105-121): add explode + focus state next to `sel`/`cogOn`/
`heatmap`/`active`/`presetNonce`, with an `explodeNonce` mirroring the `presetNonce` bump idiom
(lines 117-121):
```tsx
const [explode, setExplode] = useState(0);
const [explodeNonce, setExplodeNonce] = useState(0);
const [focusMode, setFocusMode] = useState<'buildup' | 'isolate'>('buildup');
const [focusIndex, setFocusIndex] = useState<number | null>(null);
const onExplode = (v: number) => { setExplode(v); setExplodeNonce((n) => n + 1); };
```

**Derived layer model** — mirror the memo idiom (lines 130-145), memoized on `selMapped.items`:
```tsx
const layerModel = useMemo(() => computeLayers(selMapped.items), [selMapped.items]);
```

**Wiring deltas:**
- Pass layer info + explode/focus to `<Boxes>` (extend the props block at lines 278-285).
- Gate CoG render on `cogOn && explode === 0` (D-06 — extend line 289 condition).
- Add `explodeNonce` + computed `explodeExtraHeight` to `<CameraPresets>` (lines 300-306).
- Reset on pallet switch (D-11): wrap `setSel` so it also resets explode/focus —
  `measureNonce={selIndex}` already preserves the camera (line 304).
- Row-click → isolate: `onIsolate={(id) => { setFocusMode('isolate'); setFocusIndex(layerModel.itemToLayer.get(id) + 1); }}` passed to `PlacementList`.

---

## Shared Patterns

### Pure-lib + golden-test (three-free)
**Source:** `src/lib/cog-map.ts` + `cog-map.test.ts` (also `camera-presets.ts`, `mapping.ts`).
**Apply to:** `computeLayers.ts`, `computeLayers.test.ts`, `inflateBboxForExplode`.
Header comment stating the code-split constraint + empirical risk; type-only contract imports;
hand-stated golden literals from `pack-done-response.json`; jsdom, no Canvas. (L-05)

### Declarative r3f props — never imperative material/scene mutation
**Source:** `Boxes.tsx:77-83` (hover emissive); `CameraPresets.tsx:145-178` (`useFrame` toward a
React-derived target).
**Apply to:** `Boxes.tsx` (explode offset + opacity/visible), `CameraPresets.tsx` (explode re-fit).
All visual change is a derived prop or a `useFrame` damp toward a state-derived target — no
`material.opacity = …`, no `mesh.position.y = …` outside the damp. (CONTEXT D-11 precedent)

### `bboxRef` trigger-decoupling
**Source:** `CameraPresets.tsx:62-68` + the preset effect's deliberate dep list (lines 141-143).
**Apply to:** the new explode re-fit effect. Read bbox via ref; list only the intended trigger
nonce in deps. Adding `bbox` re-fires on pallet-switch re-measure → camera snap (D-02 regression).

### Overlay chrome — absolute DOM, dark tokens, pill styling
**Source:** `ViewerOverlay.tsx:58, 109-135, 139-158`.
**Apply to:** the new bottom-center control bar. `pointer-events-none` wrapper /
`pointer-events-auto` controls; `--color-d-*` tokens; `px-[10px] py-[6px]` pills; accent ONLY
for the active toggle + slider fill/thumb (UI-SPEC §Color). (L-04)

### One-way list seam, extended
**Source:** `PlacementList.tsx:80-94` (hover) + `ResultPage.tsx` hover→Boxes wiring.
**Apply to:** the D-12 row-click → isolate seam. New callback prop; persistent accent cue
distinct from hover; existing hover→mesh emissive left intact (SC-4).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All Phase-8 files have a same-role, same-repo analog. |

**One sub-pattern has no in-repo precedent:** the native `<input type="range">` slider — no
slider exists anywhere in `src/`. Build it as a native range input styled with the dark-overlay
tokens (UI-SPEC §Accessibility / RESEARCH §Don't Hand-Roll), not a bespoke div-slider. The
surrounding bar/label/readout/toggle all follow `ViewerOverlay.tsx`.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/viewer/`, `src/components/result/`,
`src/routes/`.
**Files read for excerpts:** `cog-map.ts`, `cog-map.test.ts`, `mapping.ts`, `camera-presets.ts`,
`Boxes.tsx`, `CameraPresets.tsx`, `ViewerOverlay.tsx`, `PlacementList.tsx`, `ResultPage.tsx`.
**Pattern extraction date:** 2026-06-19
</content>
</invoke>
