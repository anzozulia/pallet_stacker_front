# Phase 8: Assembly Insight — Layer Explode & Isolation in the 3D Viewer - Research

**Researched:** 2026-06-19
**Domain:** r3f/three viewer extension + a new pure base-z layer-banding module
**Confidence:** HIGH (existing codebase grounded in real files + the real fixture; external library facts verified against installed `node_modules`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Locked carry-forward (do NOT re-litigate):**
- **L-01** Viewer renders ONLY the selected pallet's boxes in ONE persistent `<Canvas>`; `Boxes.tsx` is per-box individual meshes in a single `<group ref>`. Layer controls operate on the selected pallet's `MappedPallet.items` only.
- **L-02** Coordinate semantics locked: `mapPlacement` consumes ONLY `position` (API min-corner, z-up mm) + `dimensions` (post-orientation extents); `orientation.perm` is never re-applied. World centre `center.y = DECK_TOP_Y + position.z + H/2`. **`computeLayers` MUST band by API base-z = `position.z`.**
- **L-03** `CameraPresets` owns framing; camera preserved on pallet switch (Phase 6 D-02). Phase 8 introduces ONE deliberate exception (D-05).
- **L-04** Overlay = absolute DOM (not drei `<Html>`), `pointer-events:none` except interactive controls, dark `--color-d-*` tokens.
- **L-05** `/result` is the lazy three-only chunk; `scripts/check-code-split.mjs` is the gate. `computeLayers` and all layer math live in `src/lib/`, stay three-free, jsdom-unit-tested.
- **L-06** Honest over pretty; CoG default ON, heatmap default OFF; one-way placement-row → mesh emissive hover. Phase 8 composes with all without regression (SC-4).

**Control UI & layout:** D-01 new bottom-center control bar · D-02 always visible at no-op defaults · D-03 desktop-first.

**Explode dynamics:** D-04 uniform additive gap (layer `i` lifts by `i × slider × fixedUnit`) · D-05 camera AUTO-FITS to exploded bbox (explode-only exception; must NOT fire on pallet switch) · D-06 hide CoG marker while exploded, deck/wireframe stays at base · D-07 explode is animated.

**Layer-focus model:** D-08 one slider (0…N) + Build-up/Isolate mode toggle, layers number floor-up (Layer 1 = bottom) · D-09 build-up HIDES upper layers, isolate DIMS non-focused to translucent ghosts.

**Compose & reset rules:** D-10 explode + layer-focus compose simultaneously (isolate+explode = harmless no-op, do NOT disable) · D-11 reset explode→0 and focus→default on pallet switch, camera still preserved · D-12 placement-row click isolates that box's layer (mode=Isolate, focus=row's layer, reveal if hidden); existing hover↔mesh emissive unchanged.

### Claude's Discretion
- **D-13** `computeLayers` semantics: band by base-z (`position.z`) with a tolerance; each box assigned to its base layer (tall boxes counted at base even if they span up); a clear vertical gap (> tolerance) above a band starts a new band. Output: ordered floor-up layers each exposing member `item_id`s + base-z (+ ideally top-z) and an item→layer lookup. Researcher confirms tolerance + tall/floating handling against real demo-preset data. Unit-test single-layer, uneven-height, tall/floating.
- Exact slider ranges/ticks/labels, explode `fixedUnit` magnitude, animation duration/easing, ghost opacity (~0.12–0.18 alpha per UI-SPEC), bottom-bar geometry/styling.
- Whether layer show/hide animates (fade) or is instant — not load-bearing.

### Deferred Ideas (OUT OF SCOPE)
- Passive "Layer N" read-only column (superseded by D-12; a small chip MAY accompany the row, optional).
- 2D top-down per-layer view (RES-V2-01); step-by-step load-sequence animation (RES-V2-02).
- All-pallets-at-once overview; per-layer stats in the rail.
- InstancedMesh for large pallets (verify-don't-pre-optimize).
</user_constraints>

<phase_requirements>
## Phase Requirements

The phase description states requirement IDs are TBD ("a new viewer-comprehension requirement to be mapped during planning"). Existing `RESULT-*` IDs run 01–06 (REQUIREMENTS.md §Result & Visualization). The natural next ID is **RESULT-07**.

**Recommended requirement mapping for the planner to adopt** (add under `### Result & Visualization` in REQUIREMENTS.md):

| ID | Recommended description | Maps to SC | Research Support |
|----|-------------------------|------------|------------------|
| **RESULT-07** | User can make a dense pallet legible via two composable viewer controls: an **Explode** slider that vertically separates the solver's layers (animated, 0 = true assembled stack) and a **Layers** control that reveals layers cumulatively (build-up) or isolates a single layer (dimming/hiding the rest). Both derive from one pure `computeLayers(placements)` model and compose with the existing presets, CoG/heatmap toggles, pallet switcher, and placement-list. | SC-1..5 | Whole document — `computeLayers` (§Don't Hand-Roll / §Validation), explode anim (§Pattern 1), per-layer dim/hide (§Pattern 2), camera auto-fit (§Pattern 3). |

This is a single user-facing capability; mapping all 5 success criteria to one RESULT-07 keeps the traceability table clean. The planner MAY split it into RESULT-07 (Explode) + RESULT-08 (Layers) if it prefers per-control granularity — either is defensible.
</phase_requirements>

## Summary

This is a **brownfield viewer extension**, not greenfield. Everything the controls need already exists and is consumed, not rebuilt: the selected pallet's placements flow through `ResultPage` → `mapDoneResponse` → `selMapped.items` (`Array<PlacementOut & { typeId }>`), which is the exact input `computeLayers` must accept. The coordinate convention is locked and verified in code: **API `position.z` is the up-axis; the viewer maps it to Three.js Y via `center.y = DECK_TOP_Y + position.z + H/2`** (`src/lib/mapping.ts:43`). So banding must key off `position.z`, and the explode offset is a pure addition to `center.y` per layer.

The single new pure module — `src/lib/computeLayers.ts` — follows an established, repeated pattern in this codebase: a small three-free function in `src/lib/` with a co-located golden Vitest (`cog-map.ts`+`cog-map.test.ts`, `result-summary.ts`+`.test.ts`, `support-scale.ts`+`.test.ts`). I verified the real fixture (`pack-done-response.json`): both pallets band cleanly on `position.z` — P001 has 2 layers (z=0 ×12, z=700 ×7), P002 has 4 layers (z=0, 150, 350, 700) including a **tall/floating case** (an H=150 box at z=0 sits below the z=150 band, and an H=350 box spans z=0→350 visually overlapping the next band). This corpus is enough to lock the banding algorithm and tolerance.

For the **Explode animation**, the standard r3f approach that needs **no new dependency and matches the existing per-box declarative pattern** is a `useFrame` + `maath` `easing.damp3`-style critically-damped lerp toward a target offset, driven from React state. The codebase already uses raw `useFrame` lerp/slerp in `CameraPresets.tsx`, so this is idiomatic here. For the **camera auto-fit** (D-05), reuse the existing `CameraPresets` machinery by feeding it an explode-inflated bbox and adding a new "explode" re-fit trigger that is deliberately decoupled from `measureNonce` (the pallet-switch trigger) using the same ref-decoupling pattern already in that file. For **per-layer dim/hide** (D-09), extend `Boxes.tsx` with derived per-box props (`position` offset, `visible`, and a `transparent`/`opacity` for ghosts) — never imperative material mutation, mirroring the existing hover-emissive prop diffing.

**Primary recommendation:** Add `src/lib/computeLayers.ts` (pure, three-free, golden-tested against the fixture), thread its output through `ResultPage` state, extend `Boxes.tsx` with derived per-box explode-offset + visibility/opacity props, add a new bottom-center control bar in `ViewerOverlay.tsx`, and reuse `CameraPresets` for the explode re-fit via a new nonce decoupled from `measureNonce`. Animate explode with `useFrame` + `maath` `easing.damp3` (already available transitively via drei — but **declare `maath` as a direct dependency** to avoid a phantom-dependency break). No `@react-spring/three`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layer banding from placements (`computeLayers`) | Pure logic (`src/lib/`, three-free) | — | Math must be jsdom-unit-testable + stay out of the eager bundle (L-05). |
| Viewer state (explode amount, focus mode+index) | Frontend / React state in `ResultPage.tsx` | — | `ResultPage` is the locked single owner of viewer state (`sel`/`hoveredId`/`cogOn`/`heatmap`/`presetNonce`). |
| Per-box explode offset + layer visibility/opacity | r3f scene (`Boxes.tsx`, inside lazy chunk) | Pure offset math (optionally extracted to `src/lib/`) | Declarative props; the *which-layer-am-I + offset* math can be pure and tested. |
| Explode animation (tween toward target) | r3f `useFrame` (inside `Boxes`/scene) | — | Per-frame interpolation needs the render loop; matches `CameraPresets` precedent. |
| Camera auto-fit to exploded bbox | r3f (`CameraPresets.tsx`) | — | `CameraPresets` is the single framing authority (L-03). |
| Control bar UI (sliders, mode toggle) | DOM overlay (`ViewerOverlay.tsx` or sibling) | — | Chrome is absolute DOM, not drei `<Html>` (L-04). |
| Placement-row → isolate-layer interaction | DOM (`PlacementList.tsx`) → `ResultPage` state | item→layer lookup (from `computeLayers`) | Net-new click seam on an existing list (D-12). |

## Standard Stack

No new runtime libraries are strictly required — the phase is built from the **already-installed, already-pinned** stack. The one recommended addition is promoting an existing transitive dependency to a direct one.

### Core (already installed — verified in `node_modules`, match CLAUDE.md exactly)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | `0.184.0` | 3D engine | Pinned exactly (CLAUDE.md). `[VERIFIED: node_modules]` |
| @react-three/fiber | `9.6.1` | Declarative r3f renderer + `useFrame` for the explode tween | React-19 line. `[VERIFIED: node_modules]` |
| @react-three/drei | `10.7.7` | `<OrbitControls>` (in use), bundles `maath` for easing | Only drei line compatible with r3f 9. `[VERIFIED: node_modules]` |
| @tanstack/react-query | `5.101.0` | Job cache (unchanged this phase) | — `[VERIFIED: CLAUDE.md]` |
| vitest | `4.1.8` | Unit runner for `computeLayers` golden test | jsdom env, shares Vite transform. `[VERIFIED: node_modules]` |

### Supporting — recommended addition
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| maath | `^0.10.x` (drei depends on `^0.10.8`) | `easing.damp3` / `easing.damp` — frame-rate-independent critically-damped tweening for the explode offset (and optionally the per-layer opacity fade) | Recommended for D-07. **Already present transitively via drei** (`node_modules/maath`, `easing.damp3` confirmed). Add it to `package.json` `dependencies` so it is not a phantom dependency that breaks if drei's tree changes. `[VERIFIED: node_modules]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `maath` `easing.damp3` in `useFrame` | Hand-rolled `lerp` with a fixed factor in `useFrame` (as `CameraPresets` already does for the preset transition) | Zero new dep; but raw `lerp(a,b,0.1)` per frame is frame-rate-dependent (faster at higher FPS). `maath.easing.damp` is delta-time-aware and the r3f-ecosystem standard. Both are fine; prefer `damp3`. |
| `maath` `easing.damp3` | `@react-spring/three` (`useSpring` + `animated.group`) | Spring is more declarative but is a **net-new top-level dependency** (not installed) and adds bundle weight to the lazy chunk. Unjustified for one slider-driven offset. Avoid. |
| `maath` `easing.damp3` | drei `<CameraControls>` for the explode re-fit | `<CameraControls>` would conflict with the existing `<OrbitControls makeDefault>` + the bespoke `CameraPresets` slerp transition (two camera authorities fighting). Reuse `CameraPresets` instead. |
| Reusing `CameraPresets` for D-05 | drei `<Bounds observe>` wrapper | `ResultPage.tsx:274-277` explicitly documents that a `<Bounds observe>` "would re-fit every frame and fight the preset animation, so it is intentionally absent." Adding it now would reintroduce that conflict. Reuse `CameraPresets`'s explicit re-frame path. |

**Installation:**
```bash
# Only one optional addition — promote the transitive maath to a direct dependency:
npm install maath
# (no new three/r3f/drei — all pinned versions already satisfy this phase)
```

**Version verification (run before locking the plan):**
```bash
npm view maath version            # confirm ^0.10.x line still current
node -e 'console.log(require("maath/package.json").version)'   # what's actually resolved
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| maath | npm | mature (pmndrs project) | high (drei dependency, pulled by the whole r3f ecosystem) | github.com/pmndrs/maath | not run (offline) | Approved — already present in `node_modules` as a drei dependency; promoting to direct |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> slopcheck was not run in this session. `maath` is **not** a discovered-by-search package — it is the pmndrs (Poimandres, the r3f authors) math library already physically present in this project's `node_modules` as a transitive dependency of the pinned `@react-three/drei@10.7.7`. Its legitimacy is established by its presence in the verified dependency tree. The planner may still gate `npm install maath` behind a `checkpoint:human-verify` task if it wants to follow the strict protocol, but the realistic risk here is zero — it is the same code already executing in the bundle.

## Architecture Patterns

### System Architecture Diagram

```
                       react-query cache  ['job', jobId]  (DoneResponse)
                                  │
                                  ▼
   ResultPage.tsx  ── mapDoneResponse(done.result, idToType) ──►  view: ResultView
   (VIEWER STATE OWNER)                                                │
        │  selIndex ──────────────────────────────────────────────────┤
        │                                                              ▼
        │                                          selMapped.items : (PlacementOut & {typeId})[]
        │                                                              │
        │   ┌──────────── computeLayers(selMapped.items) ◄────────────┘   (NEW, pure, three-free, src/lib/)
        │   │                       │
        │   │            LayerModel { layers: Layer[]; itemToLayer: Map<item_id, layerIndex> }
        │   │                       │
        ▼   ▼                       ▼
   [ explode amount ]        [ per-box: layerIndex ]        [ slider max = layers.length ]
   [ focus mode+idx  ]              │                       [ item→layer for D-12 ]
        │   │                       │
        │   │   ┌───────────────────┴───────────────────────────────┐
        ▼   ▼   ▼                                                    ▼
   ┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
   │ Boxes.tsx       │   │ CameraPresets.tsx    │   │ ViewerOverlay (NEW bar)   │
   │ per-box derived │   │ explode re-fit       │   │ Explode + Layers sliders  │
   │  position+offset│   │ (new nonce, NOT      │   │  + mode toggle  (DOM)     │
   │  visible/opacity│   │  on pallet switch)   │   └──────────────────────────┘
   │ (useFrame tween)│   └──────────────────────┘
   └─────────────────┘                                ┌──────────────────────────┐
   ┌─────────────────┐                                │ PlacementList.tsx        │
   │ CogMarker        │  hidden when explode>0 (D-06)  │ row click → isolate layer│
   └─────────────────┘                                │  (uses itemToLayer)      │
   ┌─────────────────┐                                └──────────────────────────┘
   │ Pallet (deck)    │  stays at base, never offset (D-06)
   └─────────────────┘
```

A reader traces the primary use case: a `done` payload → mapped → selected pallet's items → `computeLayers` produces an ordered layer model → that model drives (a) per-box explode offset + visibility in `Boxes`, (b) the camera re-fit, (c) the slider ranges, and (d) the row-click→layer lookup.

### Component Responsibilities (what to edit, what each file does today)

| File | Current responsibility | Phase-8 change |
|------|------------------------|----------------|
| `src/lib/computeLayers.ts` | **does not exist** | **NEW** pure module: `computeLayers(items) → LayerModel`. Three-free, golden-tested. |
| `src/routes/ResultPage.tsx` | Viewer-state owner; holds `sel/hoveredId/cogOn/heatmap/active/presetNonce`; runs `mapDoneResponse`; passes `selMapped.items`+`palette`+`hoveredId`+`heatmap` to `Boxes`; renders `CogMarker` when `cogOn`; feeds `CameraPresets` `presetNonce`/`measureNonce`. | Add `explode` + `{focusMode, focusIndex}` state; compute `computeLayers(selMapped.items)` (memoized on `selMapped.items`); pass layer info to `Boxes`; add explode-refit nonce to `CameraPresets`; gate `CogMarker` on `cogOn && explode === 0` (D-06); wire bottom-bar callbacks; reset explode+focus inside `setSel` path (D-11); pass `itemToLayer` + active-focus to `PlacementList`. |
| `src/components/viewer/Boxes.tsx` | Per-box meshes; `useMemo` maps `items`→`mapPlacement` + tint (by `typeId` or `heatmap`); declarative hover emissive. | Extend the `useMemo`: attach each box's `layerIndex`; compute target Y offset = `layerIndex × explode × fixedUnit`; compute `visible`/`opacity` from focus mode+index; animate the offset via `useFrame`+`maath.easing.damp3`; set `transparent`+`opacity` for ghosts. **Keep declarative — no imperative material mutation.** |
| `src/components/viewer/CameraPresets.tsx` | Single framing authority; `useFrame` lerp/slerp transition on preset press (`preset`/`presetNonce`); re-measures bbox on `measureNonce` WITHOUT animating. Uses `bboxRef` to decouple "bbox changed" from "re-frame". | Add a new effect that re-frames on an **explode nonce** using the explode-inflated bbox. Must NOT fire on `measureNonce` (pallet switch) — use the same `bboxRef`-decoupling discipline (read the bbox via ref, list only the explode trigger in deps). |
| `src/components/viewer/ViewerOverlay.tsx` | Absolute-DOM chrome; top-center toggles, bottom-right presets, bottom-left hints, legend; pill styling `px-[10px] py-[6px]`, `role=switch` toggles, `--color-d-*` tokens. | Add the **bottom-center control bar** (D-01) — Explode `<input type=range>` + Layers `<input type=range>` + Build-up/Isolate mode toggle, following the existing pill/token/`pointer-events-auto` pattern. (May be a sibling component imported here.) |
| `src/components/viewer/CogMarker.tsx` | CoG sphere + drop-line at mapped cog. | No internal change; `ResultPage` simply stops rendering it while exploded (D-06). |
| `src/components/viewer/Pallet.tsx` | Wood deck model. | Unchanged — stays at base while layers lift (D-06). |
| `src/components/result/PlacementList.tsx` | Per-box cards; one-way `onHover(item_id)`; hovered card gets `border-accent bg-accent-weak`. | Add `onIsolate(layerIndex)` (or pass `itemToLayer` + an `onRowClick(item_id)`); add a **persistent selected cue** distinct from transient hover for the row that drove the current isolation (reuse accent — UI-SPEC). Optional `Layer {k}` chip. |

### Recommended Project Structure (only the delta)
```
src/
├── lib/
│   ├── computeLayers.ts          # NEW — pure base-z banding (three-free)
│   └── computeLayers.test.ts     # NEW — co-located golden Vitest
├── components/viewer/
│   ├── Boxes.tsx                 # EDIT — explode offset + per-layer visibility/opacity
│   ├── CameraPresets.tsx         # EDIT — explode re-fit nonce
│   └── LayerControls.tsx         # NEW (optional) — the bottom-center bar (or inline in ViewerOverlay)
├── components/result/
│   └── PlacementList.tsx         # EDIT — row-click → isolate
└── routes/
    └── ResultPage.tsx            # EDIT — explode/focus state, wiring, resets
```

### Pattern 1: Explode animation — `useFrame` + `maath` critically-damped offset (RECOMMENDED)
**What:** Each box's target Y offset is `layerIndex × explode × FIXED_UNIT`. The mesh's actual offset is interpolated toward that target every frame with a delta-time-aware damp, so the transition is smooth and frame-rate-independent (D-07), and a slider drag continuously retargets without restarting an animation.
**When to use:** The explode slider; optionally the isolate-ghost opacity fade.
**Why this over alternatives:** Matches the existing `useFrame` lerp/slerp precedent in `CameraPresets.tsx`; no spring dependency; `maath.easing.damp` is the pmndrs-standard, dt-aware damp already in the tree.

```tsx
// Source: pattern mirrors src/components/viewer/CameraPresets.tsx useFrame() + pmndrs/maath easing
// Sketch — apply the per-layer offset to a wrapper group per layer (cleanest), OR per-mesh.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';            // maath bundles easing.damp / damp3
import type { Group } from 'three';

function LayerGroup({
  baseChildren, layerIndex, explode, fixedUnit, visible, ghostOpacity,
}: { /* ... */ }) {
  const ref = useRef<Group>(null);
  const targetY = layerIndex * explode * fixedUnit;   // D-04 uniform additive gap

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    // dt-aware critical damp toward the target Y; smoothTime ~0.18s reads as "animated" (D-07)
    easing.damp(g.position, 'y', targetY, 0.18, dt);
  });

  return <group ref={ref} visible={visible}>{baseChildren}</group>;
}
```
> Note: grouping boxes by layer into per-layer `<group>`s makes the offset + `visible` a single node each (cleanest, ≤4 groups in the fixture). Alternatively keep individual meshes and offset each by `layerIndex×explode×unit` — also fine at ≤19 boxes. Either keeps the declarative-prop discipline.

### Pattern 2: Per-layer dim/hide via derived props (NOT imperative material mutation)
**What:** Build-up hides upper layers (`visible={false}`); Isolate dims non-focused layers to translucent ghosts (`transparent + opacity`). Both are derived from focus mode+index and passed as props — r3f diffs and patches the live material in place, exactly like the existing hover-emissive.
**When to use:** The Layers control (D-08/D-09).

```tsx
// Source: mirrors src/components/viewer/Boxes.tsx declarative emissive (no material.* mutation)
// focusMode: 'buildup' | 'isolate'; focusIndex: k (1-based floor-up) | null (= All)
function layerAppearance(layerIndex /*0-based*/ , focusMode, focusIndex) {
  if (focusIndex == null) return { visible: true, opacity: 1 };     // default: All visible
  const k0 = focusIndex - 1;                                        // to 0-based
  if (focusMode === 'buildup')
    return { visible: layerIndex <= k0, opacity: 1 };               // show 1..k, HIDE above
  // isolate: show focused solid, others ghost (kept for context)
  return layerIndex === k0
    ? { visible: true, opacity: 1 }
    : { visible: true, opacity: 0.15 };                             // ~0.12–0.18 (UI-SPEC)
}
// In the material when opacity < 1:  <meshStandardMaterial transparent opacity={opacity} ... />
```
**Gotcha (composes with heatmap/hover):** the box `color`/`emissive` is still owned by the existing by-type/heatmap/hover logic. Ghosting only sets `transparent`+`opacity` — it must NOT touch `color`/`emissive`, so heatmap and hover keep working underneath the ghost (SC-4). When `opacity === 1`, set `transparent={false}` to keep the assembled default byte-identical and avoid transparency sort artifacts (SC-3).

### Pattern 3: Camera auto-fit on explode (reuse `CameraPresets`, new decoupled trigger)
**What:** When `explode` changes, re-frame the camera to the **explode-inflated bbox** (the stack grows taller). Reuse the existing preset-animation effect by giving `CameraPresets` (a) the inflated bbox and (b) a new `explodeNonce` that triggers a re-frame to the *current* preset — while a pallet switch (`measureNonce`) still re-measures WITHOUT animating.
**Critical pitfall (already documented in the file):** `CameraPresets.tsx:62-68` deliberately holds the bbox in `bboxRef` so a re-measure (pallet swap) does NOT re-fire the animation. The explode re-fit must follow the SAME discipline: list only `explodeNonce` (+ `preset`) in the new effect's deps, read the bbox via the ref. Do NOT add `bbox`/`explode` to the existing preset effect's deps, or a pallet switch will start snapping the camera (regressing D-02).
**Inflated bbox:** the simplest correct source is to bump `measureNonce` to also re-run when explode changes so `setFromObject(group)` re-measures the *already-offset* meshes — but that conflates the two triggers. Cleaner: pass `explode` (or the computed extra height `maxLayerIndex × explode × fixedUnit`) into `CameraPresets`, inflate the measured bbox's Y size + recenter, and re-fit on `explodeNonce`. The planner should spell out one of these two; the ref-decoupling is the load-bearing constraint either way.

```tsx
// Sketch — a NEW effect alongside the existing preset effect in CameraPresets.tsx
useEffect(() => {
  const controls = controlsRef.current;
  if (!controls) return;
  const inflated = inflateBboxForExplode(bboxRef.current, explodeExtraHeight); // pure helper
  const { position, target } = presetFromBbox(inflated, preset);
  anim.current = { /* same shape as the preset transition */ };
}, [explodeNonce, preset]);   // NOT measureNonce, NOT bbox  ← decoupled from pallet switch
```
> `inflateBboxForExplode(bbox, extraHeight)` is pure — extract it to `src/lib/camera-presets.ts` next to `presetFromBbox` and unit-test it (the existing module already has `presetFromBbox`/`distanceLimitsFromBbox` golden tests).

### Anti-Patterns to Avoid
- **Re-deriving coordinates.** Do NOT re-apply `orientation.perm`, do NOT route placements through anything but `mapPlacement` (`mapping.ts:36`). Explode is a *pure addition* to the mapped `center.y`. (L-02)
- **Imperative material/scene mutation.** No `material.opacity = ...`, no `mesh.position.y = ...` outside `useFrame` damping toward a React-derived target. Everything else is a derived prop. (matches Boxes.tsx D-11 precedent)
- **Adding `<Bounds observe>` or `<CameraControls>`.** Both fight the existing `CameraPresets` framing (the file documents this). (L-03)
- **Importing three into `computeLayers`.** Type-only at most; it must pass `check-code-split.mjs`. (L-05)
- **Letting the explode re-fit fire on a pallet switch.** Decouple the trigger (see Pattern 3). (D-05/D-02)
- **Leaving `transparent` on at opacity 1.** Keeps the default view non-byte-identical and risks sort artifacts. (SC-3)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame-rate-independent tween for the explode offset | A bare `lerp(cur, target, 0.1)` in `useFrame` | `maath` `easing.damp`/`damp3` (dt-aware) | Bare lerp is faster at higher FPS → inconsistent feel across machines. `maath` damp is the pmndrs standard and already in the tree. |
| Camera framing math for the inflated stack | New camera vectors | `presetFromBbox` + `distanceLimitsFromBbox` (`src/lib/camera-presets.ts`) | Already pure, golden-tested, and the locked framing authority. Just feed it an inflated bbox. |
| Type recovery / item→type | Re-parsing item_id | `selMapped.items[].typeId` (already recovered, CR-01) | The mapper already did map-PRIMARY/parse-FALLBACK recovery; reuse it. |
| CoG point mapping | New axis math | `mapCog` (`src/lib/cog-map.ts`) | Already pure + golden-tested; Phase 8 only toggles visibility. |
| Slider/toggle a11y | A bespoke div-slider | Native `<input type="range">` + the existing `role="switch"` pill pattern | UI-SPEC mandates native range + arrow-key operability; the toggle pattern already exists in `ViewerOverlay.tsx`. |

**Key insight:** The only genuinely new logic in this phase is the **base-z banding** (`computeLayers`). Everything else is wiring already-tested pure modules and extending already-declarative components. Resist rebuilding the scene, the mapper, the camera math, or the coordinate transform — all are consumed, not re-derived (CONTEXT scope guardrail).

## Runtime State Inventory

> Not a rename/refactor/migration phase. Section retained for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the result is ephemeral (never persisted; only the config is autosaved to localStorage per ResultPage header comment). `computeLayers` derives layers purely in-memory. | None — verified by ResultPage.tsx no-result guard + CONTEXT scope ("No new API calls or data"). |
| Live service config | None — no backend; static SPA. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — `VITE_API_URL` unaffected. | None. |
| Build artifacts | None new. The lazy `/result` chunk gains `computeLayers` (must stay three-free) + the control UI. | Run `check-code-split.mjs` after build to confirm three did not leak. |

## Common Pitfalls

### Pitfall 1: Explode re-fit leaking onto pallet switches
**What goes wrong:** Wiring the explode re-fit by adding `bbox`/`explode` to the existing preset-animation effect's deps makes a pallet switch (which re-measures the bbox) snap the camera toward the active preset — regressing the locked "camera preserved on switch" (D-02/L-03/SC-4).
**Why it happens:** `CameraPresets` re-measures the bbox on `measureNonce` (= `selIndex`); if the animation effect depends on the measured bbox it re-fires on every measure.
**How to avoid:** Add a **separate** effect keyed on a new `explodeNonce` (+ `preset`), reading the bbox via `bboxRef` exactly as the existing effect does (`CameraPresets.tsx:112-143`). Never add `bbox` to either animation effect's deps.
**Warning signs:** The camera moves when you click a different pallet in the switcher.

### Pitfall 2: Banding on top-z or mid-z instead of base-z
**What goes wrong:** Layers misgroup; a tall box "creates" a phantom layer at its top, or floating/uneven-height boxes split a real layer.
**Why it happens:** Intuition says "group by where the box visually is," but the solver's layer identity is the **base** (`position.z`), confirmed by the fixture (boxes share exact `position.z` per layer). L-02 locks this.
**How to avoid:** Band strictly by `position.z` (the box's base). A tall box is counted at its base band even if its top overlaps the next band. Tolerance absorbs float jitter, NOT genuine height differences.
**Warning signs:** Fixture P002 produces ≠4 layers, or a single H=350 box at z=0 lands in the z=350 band.

### Pitfall 3: `computeLayers` accidentally importing three
**What goes wrong:** `check-code-split.mjs` fails the build (three leaks into the eager chunk) or the unit test needs a Canvas.
**Why it happens:** Reaching for `Vector3`/`Box3` to compute offsets.
**How to avoid:** `computeLayers` works on plain numbers (`position.z`, `dimensions.H`) and returns plain data (`item_id`s, indices, base/top-z). Type-only three imports at most. Mirror `cog-map.ts`/`camera-presets.ts`.
**Warning signs:** A `three` import statement in `src/lib/computeLayers.ts`; the gate script reporting markers in `index-*.js`.

### Pitfall 4: Ghost opacity fighting heatmap/hover (SC-4 regression)
**What goes wrong:** Isolate-dim recolors or de-emphasizes boxes such that the support-heatmap colour or the hover glow is lost on non-focused layers.
**Why it happens:** Conflating "dim" with "recolor."
**How to avoid:** Ghosting sets ONLY `transparent`+`opacity`; `color`/`emissive` stay owned by the existing by-type/heatmap/hover logic. Hover glow on a ghosted layer still works (lower alpha, still visible).
**Warning signs:** Heatmap colours vanish or invert when isolating; hovering a placement row whose box is ghosted shows no glow.

### Pitfall 5: Default view not byte-identical (SC-3 regression)
**What goes wrong:** At defaults (explode 0, All visible, Build-up) the scene differs from the Phase-6 assembled view — e.g. `transparent` left on, a 0-offset that nudges a box, or the CoG hidden.
**Why it happens:** Always applying transparency/offset regardless of state.
**How to avoid:** explode 0 → exactly `mapPlacement`'s `center.y` (no added offset); focusIndex null → `visible:true, opacity:1, transparent:false`; CoG shown when `cogOn && explode===0`.
**Warning signs:** Playwright pixel diff between the Phase-6 assembled screenshot and the Phase-8 default screenshot.

## Code Examples

### `computeLayers` — recommended shape (pure, three-free)
```ts
// src/lib/computeLayers.ts  — mirrors cog-map.ts / camera-presets.ts (NO runtime three)
import type { PlacementOut } from '@/types/pack-contract';

/** Tolerance (mm) absorbing float jitter on a shared base-z; NOT a height bridge. */
export const LAYER_Z_TOLERANCE = 5; // see §Validation for the empirical justification

export interface Layer {
  index: number;          // 0-based floor-up
  baseZ: number;          // representative base z of the band (min position.z in band)
  topZ: number;           // max (position.z + dimensions.H) across the band — for bbox/explode
  itemIds: string[];      // members (banded by their BASE)
}
export interface LayerModel {
  layers: Layer[];                  // ordered floor-up
  itemToLayer: Map<string, number>; // item_id -> layer index (for D-12 row click)
}

type ItemLike = Pick<PlacementOut, 'item_id' | 'position' | 'dimensions'>;

export function computeLayers(items: ReadonlyArray<ItemLike>): LayerModel {
  // 1. sort by base z (stable), 2. greedy-band: new band when z jumps > tolerance above the
  //    current band's base, 3. assign each item to its band by BASE (tall boxes stay at base).
  const sorted = [...items].sort((a, b) => a.position.z - b.position.z);
  const layers: Layer[] = [];
  const itemToLayer = new Map<string, number>();

  for (const it of sorted) {
    const z = it.position.z;
    const top = z + it.dimensions.H;
    const cur = layers[layers.length - 1];
    if (!cur || z - cur.baseZ > LAYER_Z_TOLERANCE) {
      const layer: Layer = { index: layers.length, baseZ: z, topZ: top, itemIds: [it.item_id] };
      layers.push(layer);
    } else {
      cur.itemIds.push(it.item_id);
      cur.topZ = Math.max(cur.topZ, top);
    }
    itemToLayer.set(it.item_id, layers[layers.length - 1].index);
  }
  return { layers, itemToLayer };
}
```
> **Design note on tolerance vs the fixture:** P002 has bands at z = 0, 150, 350, 700. With `tolerance=5`, the z=150 box correctly starts a new band (150−0=150 > 5). The H=350 box at z=0 stays in band 0 (its base is 0) even though its top (350) coincides with band 2's base — correct per D-13 ("tall boxes counted at their base"). The H=150 box at z=0 stays in band 0 (a "short/floating-relative" box sharing a base). This greedy-from-base algorithm reproduces all 2/4 fixture layers. The planner/executor MUST re-verify against the **demo-catalog presets** (`src/features/config/demo-presets.ts`, the multi-layer "wow" results) before locking `LAYER_Z_TOLERANCE` — the fixture only proves the algorithm on clean integer bases; a preset with sub-mm float bases would justify a larger tolerance.

### Verified real-data banding (the corpus to test against)
```
# from src/lib/__fixtures__/pack-done-response.json (verified 2026-06-19):
P001 (19 items): base z=0 → 12 boxes (H=700, top 700) ; base z=700 → 7 boxes (H=300, top 1000)   → 2 layers
P002 (12 items): base z=0   → 5 boxes (H=350 AND H=150 mixed → tall + short share a base, top 350/150)
                 base z=150 → 1 box  (H=150, top 300)        ← floating-relative single-box layer
                 base z=350 → 4 boxes (H=350, top 700)       ← overlaps the H=350 box from band 0
                 base z=700 → 2 boxes (H=300, top 1000)                                            → 4 layers
```
These are the exact uneven-height + tall/floating cases SC-1 demands, available as a ready fixture.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-spring for r3f tweens | `maath` `easing.damp*` in `useFrame` (dt-aware, dependency-light) | pmndrs ecosystem (drei ≥9) | Prefer `maath` for single-value/vector tweens; spring only when orchestrating many coordinated animations. |
| drei `<Bounds observe>` for auto-fit | Bespoke bbox→preset re-frame (already in this codebase) | Phase 2/6 decision | `observe` re-fits every frame and fights explicit preset transitions — explicitly avoided here. |

**Deprecated/outdated:** none relevant; the pinned stack is current per CLAUDE.md (verified 2026-06-03 there, dependencies confirmed in `node_modules` 2026-06-19).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `LAYER_Z_TOLERANCE = 5` mm is adequate. Confirmed against the fixture (clean integer bases) but NOT yet against the demo-catalog presets. | computeLayers / Validation | If a preset has sub-mm or near-tolerance float bases, layers could over- or under-split. **Mitigation:** executor re-runs the banding over `demo-presets.ts` output before locking the constant (D-13 mandate). |
| A2 | `maath` will remain a drei transitive dependency, and promoting it to a direct dep is the right move. | Standard Stack | Low — even if drei drops it, a direct `npm install maath` keeps it. If the team prefers zero new deps, fall back to a dt-aware hand-rolled damp (still no new dep). |
| A3 | Grouping boxes into per-layer `<group>`s (vs per-mesh offset) is acceptable given the locked individual-mesh decision (L-01/D-12). | Pattern 1 | Low — per-layer groups still contain individual meshes; the locked decision is about instancing, not nesting. If the executor prefers, offset each mesh directly (also fine at ≤19 boxes). |
| A4 | RESULT-07 is the right new requirement ID. | phase_requirements | Cosmetic — planner can renumber. |
| A5 | The explode-inflated bbox should grow only in Y (height), recentered. | Pattern 3 | Low — explode is vertical-only (D-04), so only the Y extent grows. |

## Open Questions

1. **`fixedUnit` magnitude + slider range (Claude's discretion, D-04).**
   - What we know: gap = `i × slider × fixedUnit`; layers are ~300–700 mm thick in the fixture; the scene is in mm.
   - What's unclear: the exact unit that reads as "clearly gapped" without flinging layers off-screen.
   - Recommendation: start `fixedUnit` at ~the median layer height (~300–400 mm) with slider 0→1; tune visually against P001/P002 + the demo presets. The camera auto-fit (D-05) keeps it framed regardless, so err toward a generous gap.

2. **Per-layer `<group>` vs per-mesh offset (A3).**
   - Recommendation: per-layer `<group>` for the explode offset + `visible` (one node each, ≤4 in fixture); keep individual meshes inside. Cleaner state, fewer `useFrame` targets. Executor's call.

3. **Demo-preset corpus access for tolerance confirmation.**
   - What we know: `src/features/config/demo-presets.ts` defines the catalogs; the actual multi-layer *results* come from running them through the API.
   - What's unclear: whether a captured multi-layer demo-preset `done` response exists as a fixture (only `pack-done-response.json` is committed).
   - Recommendation: planner should add a Wave-0 task to capture/commit one rich demo-preset `done` response as a second fixture, or confirm the existing fixture's layer cases suffice for SC-1 (they cover single-layer-per-pallet-band, uneven height, tall, and floating — arguably sufficient).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node + npm | build/test | ✓ | (project standard) | — |
| three / r3f / drei | viewer | ✓ | 0.184.0 / 9.6.1 / 10.7.7 | — |
| vitest + jsdom | computeLayers unit test | ✓ | 4.1.8 | — |
| maath (transitive) | explode damp | ✓ (via drei) | 0.10.x | hand-rolled dt-aware damp (no new dep) |
| @playwright/test | rendered-scene e2e | ✓ (CLAUDE.md stack) | 1.60.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `maath` as a *direct* dep is recommended but optional (it's already present transitively; fallback is a hand-rolled dt-aware damp).

## Validation Architecture

> `nyquist_validation` not found disabled — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `4.1.8` (+ @testing-library/react 16, jsdom ~26) |
| Config file | `vite.config.ts` (Vitest shares the Vite transform; `@/` alias proven in existing tests) |
| Quick run command | `npx vitest run src/lib/computeLayers.test.ts` |
| Full suite command | `npm test` (or `npx vitest run`) |
| Build gate | `npm run build && node scripts/check-code-split.mjs` (three must stay out of `index-*.js`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| SC-1 | `computeLayers` bands by base-z, ordered floor-up, item→layer map | unit (jsdom, three-free) | `npx vitest run src/lib/computeLayers.test.ts` | ❌ Wave 0 — `computeLayers.test.ts` |
| SC-1 | single-layer case | unit | (same) | ❌ Wave 0 |
| SC-1 | uneven-height case (P002 mixed H=350/150 share base) | unit | (same) | ❌ Wave 0 |
| SC-1 | tall/floating case (H=350 at z=0 stays in band 0; z=150 single-box band) | unit | (same) | ❌ Wave 0 |
| SC-1 | imports no three (code-split gate green) | build gate | `npm run build && node scripts/check-code-split.mjs` | ✅ exists |
| SC-2 | explode 0 = assembled; >0 gaps layers; CoG hidden while exploded; deck stays | e2e (Playwright, route-intercepted `done`) | `npx playwright test` | ❌ Wave 0 (new spec) |
| SC-3 | default view byte-identical to assembled; controls at no-op defaults | e2e pixel diff | `npx playwright test` | ❌ Wave 0 |
| SC-4 | composes with presets, CoG/heatmap, switcher, hover, row-click isolate | e2e | `npx playwright test` | ❌ Wave 0 |
| SC-5 | interactive frame rate on multi-layer presets | manual / e2e smoke | `npx playwright test` (render assert) | manual-justified |
| D-05 | explode re-fit does NOT fire on pallet switch | unit (pure `inflateBboxForExplode`) + e2e (camera unchanged on switch) | `npx vitest run src/lib/camera-presets.test.ts` + playwright | ❌ Wave 0 |

### What `computeLayers` unit tests MUST assert (SC-1 acceptance contract)
1. **Layer count & order** — fixture P001 → 2 layers `[baseZ 0, baseZ 700]`; P002 → 4 layers `[0,150,350,700]`, ordered floor-up (`layers[i].index === i`, ascending `baseZ`).
2. **Membership by base** — every item's `position.z` falls within `tolerance` of its layer's `baseZ`; the H=350 box at z=0 is in layer 0 (NOT layer 2), proving tall boxes band by base.
3. **Single-layer case** — a synthetic pallet where all items share `position.z=0` → exactly 1 layer containing all `item_id`s; the Layers slider's max therefore = 1 (drives the UI-SPEC "Single layer" disabled state).
4. **Uneven-height case** — mixed H within one base band (P002 z=0: H=350 and H=150) → still ONE layer; `topZ` = max top (350), proving height variance doesn't split a shared base.
5. **Floating/relative case** — a single box at z=150 (between dense bands) → its OWN layer (not merged into z=0 or z=350), proving a >tolerance gap starts a band.
6. **item→layer map completeness** — `itemToLayer.size === items.length`; every `item_id` maps to a valid layer index (D-12 lookup integrity).
7. **Golden literals, hand-stated** — per the codebase convention (`cog-map.test.ts`/`result-summary.test.ts`): assert hand-computed expected arrays, NOT values re-derived from the formula, so a banding bug fails loudly.
8. **No three import** — implicit via the test running under jsdom with no Canvas; reinforced by the build gate.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/computeLayers.test.ts` (+ touched module tests).
- **Per wave merge:** `npx vitest run` (full unit suite) + `npm run build && node scripts/check-code-split.mjs`.
- **Phase gate:** full unit + Playwright green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/computeLayers.test.ts` — covers SC-1 (assertions 1–8 above).
- [ ] `src/lib/camera-presets.test.ts` — add `inflateBboxForExplode` golden cases (D-05 pure helper).
- [ ] A Playwright spec for the explode/isolate/compose paths (route-intercepted `done`, never live API) — covers SC-2/3/4 + D-05 camera-unchanged-on-switch.
- [ ] (Optional, see Open Q3) capture a multi-layer demo-preset `done` response as a second fixture for richer banding confirmation.

## Security Domain

> `security_enforcement` not disabled — section included. This phase adds no network call, no new user input that reaches a sink, and no persistence.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | App has no auth (stateless tool). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No protected resources. |
| V5 Input Validation / Output Encoding | yes (carry-forward) | All API-sourced strings (`item_id`, `pallet_id`, dims) render as React text children only — never a raw-HTML sink (the locked Phase-6 rule in `ResultPage.tsx`/`PlacementList.tsx`). The new control labels are static literals; slider values are numbers. No new sink introduced. |
| V6 Cryptography | no | No crypto. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via API-sourced text (item_id/labels) in the new control bar / row-click cue | Tampering/Info-disclosure | Render as text children only; the new `Layer {k}` chip / row cue use numbers + static copy. No `dangerouslySetInnerHTML`. (matches the escaped-text grep gate noted in `ResultPage.tsx`/`PlacementList.tsx`) |
| `computeLayers` crash on malformed placements | Denial of service (render crash) | `computeLayers` runs over already-validated, in-memory `selMapped.items` (the no-result guard upstream guarantees a shape-valid `done`). Pure number math over `position.z`/`dimensions.H`; an empty array → `{ layers: [], itemToLayer: empty }` → control bar renders disabled `No boxes` (UI-SPEC). |

## Project Constraints (from CLAUDE.md)
- **Pinned quartet, exact:** React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / **three 0.184.0 (pin exactly, no caret)**. Do not introduce React 18 / r3f 8 / drei 9. (verified installed)
- **No three in the eager bundle:** `/result` is `React.lazy`; `computeLayers` must be three-free; `scripts/check-code-split.mjs` gates the build.
- **Test scene LOGIC as pure functions, not the Canvas, in jsdom; Playwright for the rendered canvas.** `computeLayers` → jsdom unit; exploded/isolated scene + camera → Playwright preview-build against a route-intercepted `done` (never live API).
- **Declarative r3f, no imperative material mutation** (codebase convention from Boxes.tsx hover-emissive).
- **Tailwind v4 `@theme`; reuse the `--color-d-*` dark-overlay token group** for the new control bar; pill styling `px-[10px] py-[6px]`, `role=switch` toggles, mono chrome text. (UI-SPEC)
- **No backend / no new persistence / mm-kg integer units** — `computeLayers` is an in-memory derivation only.

## Sources

### Primary (HIGH confidence — read this session)
- `src/lib/mapping.ts` (lines 19, 36-49) — locked coordinate transform; `DECK_TOP_Y=100`; `center.y = DECK_TOP_Y + position.z + H/2` (the up-axis mapping).
- `src/lib/result-mapper.ts` (31-37) — `MappedPallet.items: Array<PlacementOut & { typeId }>` = `computeLayers` input.
- `src/types/pack-contract.ts` (64-112) — `PlacementOut` (`item_id`, `position: Vec3`, `dimensions: {L,W,H}`), `PalletResult`, `Cog`.
- `src/routes/ResultPage.tsx` (105-121, 130-173, 272-320) — viewer-state ownership, `selMapped.items`, `CameraPresets` `presetNonce`/`measureNonce` wiring, CoG render gate, overlay wiring.
- `src/components/viewer/Boxes.tsx` (47-91) — per-box `useMemo` + declarative hover emissive (the pattern to extend).
- `src/components/viewer/CameraPresets.tsx` (43-178) — `bboxRef` decoupling, `useFrame` lerp/slerp transition, `measureNonce` re-measure-without-animate (the D-05 reuse target + Pitfall 1 source).
- `src/components/viewer/ViewerOverlay.tsx` (45-160) — absolute-DOM chrome, pill/token styling, `role=switch` toggles (control-bar pattern).
- `src/components/result/PlacementList.tsx` (51-123) — one-way hover seam to extend with row-click (D-12).
- `src/lib/cog-map.ts` / `cog-map.test.ts`, `result-summary.test.ts` — the canonical pure-module + golden-literal test pattern `computeLayers` must follow.
- `scripts/check-code-split.mjs` — the build gate (three markers in `index-*.js` = fail).
- `src/lib/__fixtures__/pack-done-response.json` — verified base-z distribution (P001 2 layers, P002 4 layers incl. tall/floating) via Node inspection this session.
- `node_modules` inspection — three 0.184.0 / r3f 9.6.1 / drei 10.7.7 / react 19.2.7 confirmed; `maath` present transitively with `easing.damp`/`damp3`; `@react-spring/three` NOT installed; no existing `<input type=range>`/Slider in `src/`.

### Secondary (MEDIUM)
- CLAUDE.md tech-stack section (pinned versions, code-split + jsdom-test rules) — cross-checked against `node_modules`.
- CONTEXT.md / UI-SPEC.md / DISCUSSION-LOG.md — locked decisions reproduced in §User Constraints.

### Tertiary (LOW)
- `maath`/`@react-spring/three` general ecosystem guidance (training knowledge) — marked `[ASSUMED]` where it informs A2; the *presence* of maath is `[VERIFIED: node_modules]`.

## Metadata
**Confidence breakdown:**
- Existing codebase mapping: HIGH — every claim grounded in a read file + line numbers + the real fixture.
- Standard stack: HIGH — versions verified in `node_modules`; the one addition (maath) is already physically present.
- Architecture/patterns: HIGH — reuse of documented in-file patterns (`CameraPresets` ref-decoupling, `Boxes` declarative props).
- `computeLayers` algorithm/tolerance: MEDIUM-HIGH — algorithm verified against the committed fixture; tolerance value pending demo-preset confirmation (A1, Open Q3).

**Research date:** 2026-06-19
**Valid until:** ~2026-07-19 (stable; the pinned stack won't move, the only soft spot is the tolerance constant which is an execution-time empirical check).
