# Phase 2: Coordinate Mapping & Fixture Viewer - Research

**Researched:** 2026-06-03
**Domain:** API coordinate-space → Three.js mesh-transform mapping; static r3f/drei 3D viewer
**Confidence:** HIGH (the locked risk was resolved empirically against the live API + its OpenAPI spec)

## Summary

The single highest-risk item — the meaning of the API's placement geometry — is **fully resolved against the real API**, not guessed. The live API at `https://packerapi.anzozulia.xyz` is reachable with **no auth**, exposes a complete **OpenAPI 3.1 spec at `/openapi.json`** (Swagger UI at `/docs`, ReDoc at `/redoc`), and I captured three real `done` responses including a rich multi-pallet + unpacked + rotated fixture. The three blocking questions are answered with HIGH confidence:

1. **`position` is the box's MINIMUM CORNER, not box-centre.** The spec states verbatim: _"Coordinates of the box's minimum corner; it occupies [x, x+L]×[y, y+W]×[z, z+H]."_ The mockup's "box-centre" note (`design/result.html` line 175) is **wrong for the real API** — the mockup hand-authored its data. `[VERIFIED: live API + /openapi.json PlacementOut]`
2. **`dimensions` (L/W/H) is POST-orientation** — the placed extents along x/y/z _after_ rotation. Spec: _"Box extents along the placement axes (after rotation)."_ `position.z` is likewise a final placed coordinate (height/up axis). `[VERIFIED: live API + spec BoxDims]`
3. **`orientation.perm` is SCATTER semantics: `placed_xyz[i] = original_LWH[perm[i]]`.** Empirically disambiguated using a 3-cycle perm (`[2,0,1]` name `HLW`, `[1,2,0]` name `WHL`) where scatter and gather diverge — scatter matched 100% of placements, gather failed. `[VERIFIED: captured response, 3-cycle case]`

**The critical planning consequence:** because `dimensions` is already post-orientation and `position` is the min-corner, **the Phase 2 geometry mapping does NOT need to interpret `perm` at all**. The mapping is: `BoxGeometry(dims.L, dims.H, dims.W)` (API z→three's y), centre = min-corner + half-extent, with the z→y axis swap. `perm`/`name` are diagnostic-only (Phase 6 placement list). This makes the pure function far simpler than the roadmap feared.

**Primary recommendation:** Commit the captured `request3`/`done3` pair as the golden fixture (2 pallets, 7 unpacked, 3 box types, rotations including a 3-cycle perm). Write the mapping as a pure `lib/` function consuming only `position` + `dimensions`, with golden tests on the exact captured numbers (incl. the rotated `D003` case). Build the viewer with drei `<OrbitControls makeDefault>` + `<Bounds fit clip>` for auto-framing and bounding-box-derived ISO/TOP/FRONT presets. No new npm packages are required — the locked quartet and test stack are already installed.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Capture via curl / dev-proxy. POST a config to `https://packerapi.anzozulia.xyz`, poll `GET /api/v1/jobs/{job_id}` to `done`, save raw JSON verbatim. Assumes no auth (confirmed during this research — no auth needed).
- **D-02:** Scenario = multi-pallet rich catalog. 2–3 pallets, 3+ box types, ≥1 forced non-identity rotation, a few intentionally unpacked items. Load-bearing for Phases 2/3/6.
- **D-03:** Commit both the request and the `done` response together (`request.json` + `done-response.json`).
- **D-04:** The Phase 2 viewer renders **pallet index 0 only**. Multi-pallet switcher is Phase 6.
- **D-05:** The mapping is a **pure, IO-free function in `src/lib/`** — no React, no IO; unit-testable in jsdom without rendering a Canvas. Returns mesh-ready position + size (+ rotation/orientation). Golden-value Vitest tests assert exact mapped position+size for known fixture items incl. the rotated case; dev-mode AABB sanity assertion passes.
- **D-06 (RESEARCH — resolved empirically below):** `orientation.perm` gather-vs-scatter meaning; whether `position.z`/`dimensions` are pre/post-orientation. **All resolved — see Summary + Architecture Patterns.**
- **D-07:** Faithful to the mockup. Wood pallet (slats + blocks), key/fill/ambient/hemisphere lighting, soft (PCF) shadows, ground plane + grid, fog, box edge-lines (`EdgesGeometry`), per-type colour tinting.
- **D-08:** Port the dark 3D-overlay Tailwind token group now (`--d-bg:#0c0f17`, `--d-border:#222838`, `--d-text:#e6e8ee`, `--d-text-2:#838b9e`) into `@theme`.
- **D-09:** Box-type colours from a deterministic palette seeded by `#6d63f5` / `#0ea5a3` / `#e0892b`, extended harmoniously. Legend = swatch + type name, top-right.
- **D-10:** Per-box individual meshes (each with edge `LineSegments`). InstancedMesh is Phase 6.
- **D-11:** drei `<OrbitControls>` (or `<CameraControls>`) + auto-fit framing. ISO/TOP/FRONT computed from the scene's bounding box, NOT the mockup's hardcoded camera positions.
- **D-12:** Feel defaults: animated preset transitions, damping on, polar clamp (mockup `maxPolarAngle ≈ π*0.495`), min/max zoom from scene size. All tunable.
- **D-13:** Chrome built now: legend (top-right) + ISO/TOP/FRONT buttons + dark overlay header (pallet name + dimensions tag + control hints). **Static labels only.**
- **D-14:** No computed summary stats in the overlay (no fill%/weight/box-count). Phase 6.
- **D-15:** The entire right rail is **Phase 6** — explicitly not built here.

### Claude's Discretion

- Fixture file location & exact layout (e.g. `src/lib/__fixtures__/done-response.json` + `request.json`).
- The exact pure-function signature and return shape (position/size/orientation representation).
- The AABB sanity-assertion mechanism and where it fires (dev-only).
- Palette-extension scheme beyond the mockup's three colours.
- Exact preset camera angles/distances and transition easing.
- Overlay implementation: drei `<Html>` vs absolute-positioned DOM layered over the `<Canvas>`.

### Deferred Ideas (OUT OF SCOPE)

- Multi-pallet switcher, summary-stats rail, placement list + hover↔mesh highlight, CoG marker, support-ratio tinting, unpacked-items panel → **Phase 6**.
- Request-builder (qty→unique-ID expansion, 3-mode rotation mapping) and result-mapper (group-by-type/pallet, diagnostics extraction) → **Phase 3**. Phase 2's mapping is geometry-only.
- InstancedMesh performance optimization → **Phase 6**.
- Live API client + async polling, cancel, terminal-state handling → **Phase 5**. Phase 2 capture is a manual one-off.
- Computed overlay stats (fill%/weight/box count) → **Phase 6**.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                  | Research Support                                                                                                                                                                                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RESULT-01 | User can view a 3D visualization of the packed pallet, boxes coloured by type, with a legend | Captured fixture supplies real placements; mapping function (`position`+`dimensions` → mesh transform, verified) produces correct per-box meshes; box-type derived from `item_id` prefix (or grouping); deterministic palette (D-09); legend = swatch+name. Mockup `design/result.html` lines 286–331 give the exact scene/material/edge recipe. |
| RESULT-02 | User can orbit, zoom, pan and switch ISO / TOP / FRONT camera presets                        | drei `<OrbitControls makeDefault enableDamping>` (orbit/zoom/pan) + `<Bounds fit clip>` for auto-framing; ISO/TOP/FRONT computed from the scene bounding box (D-11) with animated transitions. Mockup lines 280–352 give the feel reference (damping 0.08, `maxPolarAngle π*0.495`, ISO/TOP/FRONT directions).                                   |

</phase_requirements>

## Architectural Responsibility Map

| Capability                                         | Primary Tier                            | Secondary Tier                   | Rationale                                                                                                                    |
| -------------------------------------------------- | --------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| API coordinate → mesh-transform math               | Browser / pure `lib/`                   | —                                | Pure, IO-free, framework-agnostic math; lives in `src/lib/`, unit-tested in jsdom. No tier dependency. (D-05)                |
| Fixture data (committed JSON)                      | Static asset (bundled)                  | —                                | The captured `done` response is a build-time committed file, not a runtime fetch. The live client is Phase 5.                |
| 3D scene render (Canvas, meshes, lights, controls) | Browser / Client (lazy `/result` chunk) | —                                | WebGL runs client-side only; code-split into the `/result` lazy chunk (`scripts/check-code-split.mjs` gate).                 |
| Camera preset framing                              | Browser / Client                        | pure `lib/` (bbox math optional) | drei controls are client-side; the bounding-box → camera-position math can be a pure helper but executes in the render tier. |
| Box-type colour palette                            | pure `lib/`                             | Browser                          | Deterministic palette derivation is pure; consumed by the mesh materials at render time.                                     |
| Dark-overlay theme tokens                          | CDN / Static (CSS)                      | —                                | Tailwind v4 `@theme` tokens compiled into the static CSS bundle.                                                             |

## Standard Stack

**No new npm packages are required for this phase.** Every library the viewer and tests need is already installed and version-locked from Phase 1. This phase is _usage_, not _installation_.

### Core (already installed — verified in package.json 2026-06-03)

| Library            | Version   | Purpose                                                                                                       | Why Standard                                                                                     |
| ------------------ | --------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| three              | `0.184.0` | WebGL engine: `BoxGeometry`, `EdgesGeometry`, `LineSegments`, `Color`, `Vector3`, `Box3`                      | The locked engine; mockup proves the exact APIs needed. `[VERIFIED: package.json]`               |
| @react-three/fiber | `9.6.1`   | Declarative React renderer (`<Canvas>`, `<mesh>`, `<boxGeometry>`)                                            | React-19 line; already mounting the empty Canvas in `ResultPage`. `[VERIFIED: package.json]`     |
| @react-three/drei  | `10.7.7`  | `<OrbitControls>`, `<Bounds>`/`useBounds`, `<Edges>`, `<Grid>`, `<Html>`, `<Environment>`, `<ContactShadows>` | The r3f-9-compatible helper line; CLAUDE.md says "prefer drei first". `[VERIFIED: package.json]` |
| @types/three       | `0.184.1` | three TS types                                                                                                | In lockstep with three. `[VERIFIED: package.json]`                                               |
| clsx               | `2.1.1`   | Conditional class strings for the ISO/TOP/FRONT `.on` toggle                                                  | Already installed; matches mockup `.axisbtns button.on` pattern. `[VERIFIED: package.json]`      |

### Supporting (already installed)

| Library                | Version  | Purpose                                                            | When to Use                                                                                 |
| ---------------------- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| vitest                 | `4.1.8`  | Golden-value unit tests of the pure mapping fn (jsdom, no Canvas)  | The mapping correctness gate. `[VERIFIED: package.json]`                                    |
| @testing-library/react | `16.3.2` | If smoke-mounting any non-Canvas overlay component                 | Optional for overlay DOM. `[VERIFIED: package.json]`                                        |
| @playwright/test       | `1.60.0` | Canvas-render smoke against the preview build (jsdom has no WebGL) | Assert the `/result` viewer mounts + ISO/TOP/FRONT buttons work. `[VERIFIED: package.json]` |

### Not needed this phase

- **zod** is NOT installed and is NOT required here. The fixture is committed, trusted JSON; runtime response validation belongs to the **Phase 5** live client. For Phase 2, type the fixture with a hand-written TS interface (or, if you prefer one schema now, a zod schema is optional but adds a dependency the phase doesn't otherwise need — defer). `[VERIFIED: package.json — zod absent]`
- **No new install command.** If the planner wants zod-typed fixtures early, that is a discretionary `npm install zod@4.4.3` (version per CLAUDE.md) — otherwise skip.

## Package Legitimacy Audit

> No external packages are installed in this phase. All libraries used were installed and supply-chain-checkpoint-approved in Phase 1 (T-1-SC, per STATE.md). slopcheck/registry verification is therefore not applicable to new installs here.

| Package                                    | Registry | Disposition |
| ------------------------------------------ | -------- | ----------- |
| (none — all deps pre-installed in Phase 1) | —        | N/A         |

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs)
**Packages flagged as suspicious [SUS]:** none (no installs)

## Architecture Patterns

### System Architecture Diagram

```
  committed fixture JSON                 src/lib/ (pure, IO-free, jsdom-testable)
  (request.json +            ┌────────────────────────────────────────────────┐
   done-response.json)       │  mapPlacement(placement, palletDims)            │
        │                    │    in:  position{x,y,z}=MIN CORNER (mm)         │
        │  import (build-time)│         dimensions{L,W,H}=POST-orientation     │
        └───────────────────►│    out: { center:[x,y,z] (three y-up),          │
                             │           size:[sx,sy,sz],                       │
                             │           typeKey } per box                      │
                             │  + assertWithinEnvelope() dev-only AABB check    │
                             └───────────────────┬─────────────────────────────┘
                                                 │ MappedBox[]
        ┌────────────────────────────────────────▼──────────────────────────────┐
        │  ResultPage (lazy /result chunk — three/r3f/drei isolated)              │
        │  ┌───────────────┐   ┌──────────────────────────────────────────────┐  │
        │  │ <Canvas>      │   │ scene: lights(key/fill/ambient/hemi) + fog +   │  │
        │  │  shadows PCF  │──►│ ground plane + <Grid> + wood pallet(slats/blk) │  │
        │  └───────────────┘   │ + per-box <mesh><boxGeometry/><Edges/> (D-10)  │  │
        │                      │ + <OrbitControls makeDefault> + <Bounds fit>   │  │
        │                      └──────────────────────────────────────────────┘  │
        │  overlay (DOM or <Html>): dark header(name+dims tag+hints) | legend     │
        │                          ISO/TOP/FRONT buttons ──► camera preset(bbox)  │
        └─────────────────────────────────────────────────────────────────────────┘

   palette.ts (pure) ──► typeKey → color ──► mesh material + legend swatch
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── __fixtures__/
│   │   ├── pack-request.json        # the captured request (D-03, reproducibility)
│   │   └── pack-done-response.json  # the captured `done` JobState (golden source)
│   ├── mapping.ts                   # pure: PlacementOut → MappedBox (D-05)
│   ├── mapping.test.ts              # golden-value Vitest (jsdom, no Canvas)
│   ├── palette.ts                   # deterministic type→color (D-09)
│   └── camera-presets.ts            # pure bbox → ISO/TOP/FRONT vectors (optional)
├── routes/
│   └── ResultPage.tsx               # replaces empty Canvas; the viewer (D-07/D-13)
└── components/viewer/               # (discretionary) Pallet, Boxes, Overlay subcomponents
```

### Pattern 1: The geometry mapping (THE locked risk — resolved)

**What:** Convert one `PlacementOut` (API z-up, mm, min-corner) into a Three.js mesh transform (y-up, box-centre). Because `dimensions` is post-orientation and `position` is the min-corner, **no `perm` interpretation is needed** — the box is always axis-aligned in the placed frame.

**Verified axis convention** (from spec + mockup):

- API axes: `x`=length, `y`=width, **`z`=height (up)**.
- Three.js axes: `x`=right, **`y`=up**, `z`=toward camera.
- Mapping (matches mockup `design/result.html` line 324/327, now verified against real data):
  - geometry extents: `BoxGeometry(dims.L, dims.H, dims.W)` — API L→three x, **API H→three y**, API W→three z.
  - centre (three-space), pallet centred at world origin on x/z, deck at y=`deckTopY`:
    - `cx = position.x + dims.L/2 - palletL/2`
    - `cy = deckTopY + position.z + dims.H/2` ← `position.z` is the box's min z above the deck
    - `cz = position.y + dims.W/2 - palletW/2`
  - `deckTopY = blockH(78) + deckH(22) = 100` (mockup pallet model; tunable).

```typescript
// Source: derived from /openapi.json PlacementOut/BoxDims/Vec3 + captured fixture
// position = MINIMUM corner (occupies [x,x+L]×[y,y+W]×[z,z+H]); dims are POST-orientation.
export interface MappedBox {
  id: string;
  typeKey: string; // e.g. item_id prefix or request-id group (Phase 3 refines)
  size: [number, number, number]; // three-space extents: [L, H, W]
  center: [number, number, number]; // three-space box-centre, y-up
}

const DECK_TOP_Y = 100; // blockH 78 + deckH 22 (pallet model); tunable

export function mapPlacement(
  p: {
    item_id: string;
    position: { x: number; y: number; z: number };
    dimensions: { L: number; W: number; H: number };
  },
  pallet: { L: number; W: number },
  typeKey: string,
): MappedBox {
  const { x, y, z } = p.position;
  const { L, W, H } = p.dimensions;
  return {
    id: p.item_id,
    typeKey,
    size: [L, H, W], // API L→x, H→y, W→z
    center: [
      x + L / 2 - pallet.L / 2, // x: centre + recentre pallet on origin
      DECK_TOP_Y + z + H / 2, // y(up): deck + min-z + half-height
      y + W / 2 - pallet.W / 2, // z: API width axis
    ],
  };
}
```

**When to use:** Once per placed box on the rendered pallet (pallet index 0, D-04).

### Pattern 2: perm/name are diagnostic-only here

**What:** `orientation.perm` is **scatter**: `placed_dim_along_axis[i] = original_request_dim[perm[i]]`, where i ∈ {x,y,z}=0,1,2 and original = (length, width, height). `name` (e.g. `WHL`) reads x→y→z. Verified: `D012 perm=[1,2,0] name=WHL`, request (L,W,H)=(600,300,150) → placed (x,y,z)=(W,H,L)=(300,150,600). Scatter matched; gather did not.

**When to use:** **Not in Phase 2 geometry.** Phase 6's placement list shows the orientation `name`/`rtag`; Phase 3's result-mapper may carry it through. Document it so Phase 3 doesn't re-derive it.

### Pattern 3: drei viewer composition (r3f 9 / drei 10)

**What:** Declarative scene replacing the imperative mockup.

```tsx
// Source: r3f 9 / drei 10 standard usage [CITED: pmndrs.github.io/drei] [ASSUMED: exact props from training, stable across v9/v10]
<Canvas
  shadows // enables shadow map; set type via gl or <Canvas gl> for PCFSoft
  camera={{
    fov: 40,
    near: 1,
    far: 12000,
    position: [
      /* ISO start */
    ],
  }}
  data-testid="r3f-canvas" // keep Phase 1 testid for Playwright
>
  <fog attach="fog" args={['#0c0f17', 2800, 5600]} />
  <ambientLight color="#9fb0d0" intensity={0.55} />
  <hemisphereLight args={['#cdd7f0', '#0b0d14', 0.5]} />
  <directionalLight
    castShadow
    color="#fff6e8"
    intensity={1.15}
    position={[900, 1750, 1150]}
    shadow-mapSize={[2048, 2048]}
  />
  <directionalLight color="#6d7cff" intensity={0.35} position={[-1000, 600, -800]} />
  {/* ground plane + <Grid/>; wood pallet slats+blocks; per-box meshes with <Edges/> */}
  <Bounds fit clip observe margin={1.2}>
    {/* boxes here so auto-fit frames the real fixture dimensions */}
  </Bounds>
  <OrbitControls
    makeDefault
    enableDamping
    dampingFactor={0.08}
    maxPolarAngle={Math.PI * 0.495} /* min/maxDistance derived from bbox */
  />
</Canvas>
```

- Per-box mesh + edges (D-10): `<mesh castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.62} metalness={0.04}/><Edges color={tintedColor} /></mesh>` positioned at `center`. drei `<Edges>` wraps `EdgesGeometry`/`LineSegments` — preferred over hand-rolling the mockup's `LineSegments`.
- **Background:** set `scene.background` via `<color attach="background" args={['#0c0f17']} />` OR the radial-gradient look via the CSS `.viewer` container behind a transparent Canvas.

### Pattern 4: ISO/TOP/FRONT presets from the scene bounding box (D-11)

**What:** Compute presets from `THREE.Box3().setFromObject(group)` so any fixture frames correctly — do NOT copy the mockup's hardcoded `(1650,1300,1850)` etc.

- Compute bbox center `c` and size `s`; radius `r = s.length()/2`.
- ISO: `c + dir*(r*k)` with `dir = normalize(1, 0.8, 1.1)` (echoes mockup ISO feel).
- TOP: `c + (0, r*k, 0.0001)` (tiny z to avoid gimbal).
- FRONT: `c + (0, r*0.25, r*k)`.
- Animate by lerping camera position over ~520ms with cubic ease (mockup lines 345–348), or use drei `<Bounds>`'s `to()`/`refresh()` + `useBounds().to({position,target})`. `<Bounds>` `fit` gives the initial frame; presets re-target via a ref to controls or `useBounds`.
- Derive `OrbitControls.minDistance/maxDistance` from `r` (e.g. `r*0.4` … `r*4`).

### Pattern 5: Dev-mode AABB sanity assertion (D-05)

**What:** Each mapped box's AABB must sit within the pallet envelope `[0,L]×[0,W]×[0,H]` in API space (pre-recentre), verified above on the real fixture (0 violations both pallets). Fire **dev-only**:

```typescript
export function assertWithinEnvelope(p, pallet) {
  if (!import.meta.env.DEV) return; // tree-shaken from prod build
  const { x, y, z } = p.position;
  const { L, W, H } = p.dimensions;
  const eps = 1e-6;
  if (
    x < -eps ||
    y < -eps ||
    z < -eps ||
    x + L > pallet.L + eps ||
    y + W > pallet.W + eps ||
    z + H > pallet.H + eps
  ) {
    console.error('[AABB] box escapes pallet envelope', p.item_id, p.position, p.dimensions);
  }
}
```

Use `import.meta.env.DEV` (Vite) so the check is stripped in production. A `console.error` (or a thrown error in tests) is sufficient; the golden test also asserts containment.

### Anti-Patterns to Avoid

- **Trusting the mockup's `b.x - PL.L/2` as a box-centre formula.** The mockup's `b.x` is hand-authored _centre_ data; the real API gives _min-corner_. Use `position + dims/2` for the centre. (This is the #1 trap and the reason the fixture is captured.)
- **Interpreting `perm` to compute geometry size.** `dimensions` is already post-orientation — applying perm again double-rotates. Use `dimensions` directly.
- **Hardcoding camera positions from the mockup.** Our fixture pallet is 1000×800×1000, not the mockup's 1200×800×1800 — hardcoded vectors mis-frame it (D-11).
- **Rendering the Canvas in a jsdom Vitest test.** jsdom has no WebGL (established Phase 1). Test mapping math as pure functions; smoke the Canvas in Playwright.
- **Importing three at module top-level outside the lazy `/result` chunk.** Would break `scripts/check-code-split.mjs`. Keep all three/r3f/drei imports inside `ResultPage` and its viewer subcomponents.

## Don't Hand-Roll

| Problem                                | Don't Build                                                             | Use Instead                                                               | Why                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Orbit/zoom/pan + damping + polar clamp | Manual pointer-event camera math (the mockup's vanilla `OrbitControls`) | drei `<OrbitControls makeDefault enableDamping maxPolarAngle>`            | Battle-tested; CLAUDE.md mandates "prefer drei first".                                                     |
| Auto-framing the scene                 | Manual `Box3` + fov trig to fit                                         | drei `<Bounds fit clip observe>` + `useBounds`                            | Handles fov/aspect/margin correctly; re-fits on resize.                                                    |
| Box wireframe edges                    | Hand-built `EdgesGeometry`+`LineSegments` (mockup line 328)             | drei `<Edges>`                                                            | Declarative, disposes correctly, matches r3f lifecycle.                                                    |
| Ground grid                            | `THREE.GridHelper` imperatively                                         | drei `<Grid>` (or keep `gridHelper` JSX)                                  | drei `<Grid>` has nicer fade/cell controls; gridHelper JSX also fine.                                      |
| Overlay DOM positioned in 3D           | Manual projection math                                                  | drei `<Html>` (or absolute-positioned DOM over the Canvas — D discretion) | For static top-left/right chrome, plain absolute DOM is simplest; `<Html>` only if anchored to a 3D point. |
| Response schema knowledge              | Guessing field meanings                                                 | The committed fixture + `/openapi.json`                                   | The contract is published; the fixture is real.                                                            |

**Key insight:** Phase 2's _only_ genuinely custom code is the ~15-line pure mapping function and the palette helper. Everything visual is assembled from drei primitives the mockup already proves are sufficient.

## Common Pitfalls

### Pitfall 1: Box-centre vs min-corner confusion

**What goes wrong:** Boxes render half-sunk into / floating above the deck and shifted by half their size.
**Why it happens:** The mockup says "positions are box-centre" but the **real API gives the minimum corner**. Mixing the two halves your offset.
**How to avoid:** Centre = `position + dimensions/2` on every axis, then apply the z→y swap and pallet recentre. Golden test the exact captured numbers.
**Warning signs:** First box (`position {0,0,0}`) appears centred on the pallet corner pole instead of sitting in the corner.

### Pitfall 2: Double-applying orientation

**What goes wrong:** Rotated boxes get wrong dimensions or appear rotated twice.
**Why it happens:** Treating `dimensions` as pre-orientation and re-permuting with `perm`.
**How to avoid:** `dimensions` is post-orientation — use it verbatim for `BoxGeometry`. Ignore `perm` for geometry.
**Warning signs:** A `WHL`/`HLW` box looks taller/longer than the placed extents the API reported.

### Pitfall 3: three leaking into the entry chunk

**What goes wrong:** `scripts/check-code-split.mjs` fails the build.
**Why it happens:** Importing the viewer/mapping into a module reachable from `ConfigurePage` or the router entry.
**How to avoid:** Keep three/r3f/drei imports inside the lazy `ResultPage` subtree. The pure `lib/mapping.ts` may import only three _types_ (`import type`) — type-only imports are erased and won't bundle three. Prefer plain `number[]`/tuples to avoid even that.
**Warning signs:** Build gate error naming `index-*.js`.

### Pitfall 4: jsdom WebGL render attempt

**What goes wrong:** Vitest test crashes with no WebGL context.
**Why it happens:** Importing/mounting `<Canvas>` in a unit test.
**How to avoid:** Unit-test `mapping.ts`/`palette.ts`/`camera-presets.ts` as pure functions; assert the Canvas mounts only in the Playwright preview-build smoke (established Phase 1).
**Warning signs:** `Cannot read properties of null (getContext)` in Vitest.

### Pitfall 5: Pallet 0 type-richness for the legend

**What goes wrong:** The captured fixture's pallet 0 contains only 2 of the 3 box types (T and D; the F cubes landed on pallet 1 / unpacked). A legend derived strictly from pallet-0 contents shows 2 swatches, weakening the RESULT-01 "coloured by type" demonstration.
**Why it happens:** The solver placed all F cubes off pallet 0.
**How to avoid (planner choice):** Either (a) derive the legend from **all box types in the whole fixture** (so 3 swatches show even though pallet 0 renders 2 — defensible, and Phase 6 multi-pallet makes it natural), or (b) re-capture a config whose pallet 0 happens to carry 3+ types, or (c) accept 2 swatches for Phase 2. **Recommendation: (a)** — legend from the full fixture's type set; it future-proofs Phase 6 and still satisfies RESULT-01.
**Warning signs:** Legend looks sparse vs the mockup's 3-row legend.

## Runtime State Inventory

> This is a greenfield viewer phase (new pure function + new fixture + viewer code) — no rename/refactor/migration. Inventory still completed for the fixture-capture state, which IS external runtime state.

| Category            | Items Found                                                                                                                                                                                                                                                                                              | Action Required                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stored data         | None — the API is stateless per-job; `job_id` is the only handle and there is "no other history" (per JobAccepted spec). Captured responses are saved locally as committed files.                                                                                                                        | Commit fixture JSON to repo.                                                                                                                                                                                                                                                   |
| Live service config | The `packerapi.anzozulia.xyz` API itself (author-controlled). It returns **no `Access-Control-Allow-Origin` header** even with an `Origin` request header (verified — health GET returned no CORS headers; OPTIONS preflight on `/pack` returned `405`). CORS is therefore **not currently configured**. | **Not a Phase 2 blocker** (capture is server-to-server curl; local dev uses the Vite `/api` proxy). Flag for Phase 5/7: the production serving origin must be added to the API's CORS allowlist before the browser client ships (already tracked in STATE.md Phase 7 blocker). |
| OS-registered state | None.                                                                                                                                                                                                                                                                                                    | None.                                                                                                                                                                                                                                                                          |
| Secrets/env vars    | **No auth key required** — verified `/health`, `/version`, `/pack`, `/jobs/{id}` all succeed unauthenticated. D-01's "confirm during execution; user provides key if needed" is resolved: **no key needed.** `VITE_API_URL` exists as a build seam but is not consumed in Phase 2.                       | None — D-01 auth assumption confirmed false (no auth).                                                                                                                                                                                                                         |
| Build artifacts     | None — the fixture is source, not built.                                                                                                                                                                                                                                                                 | None.                                                                                                                                                                                                                                                                          |

**The capture is a one-off:** the saved fixture is immutable golden data; it is not re-fetched at runtime. The live client is Phase 5.

## Code Examples

### Deterministic box-type palette (D-09)

```typescript
// Source: derived from mockup TYPES colours (design/result.html lines 199-203)
const SEED = ['#6d63f5', '#0ea5a3', '#e0892b']; // mockup's three
// Extend harmoniously by rotating hue for additional types (HSL spin).
export function colorForType(typeKeys: string[]): Map<string, string> {
  const sorted = [...new Set(typeKeys)].sort(); // deterministic order
  const out = new Map<string, string>();
  sorted.forEach((k, i) => {
    out.set(k, i < SEED.length ? SEED[i] : spinHue(SEED[i % SEED.length], i));
  });
  return out;
}
// spinHue: parse hex → HSL, add (i*47)deg hue, return hex. Keep S/L near the seeds.
```

### Golden-value test (real captured numbers)

```typescript
// Source: captured pack-done-response.json, pallet 0
import { describe, expect, it } from 'vitest';
import { mapPlacement } from './mapping';
const pallet = { L: 1000, W: 800 }; // from fixture pallets[0].dimensions

describe('mapPlacement (golden)', () => {
  it('non-rotated box T000 (perm [0,1,2])', () => {
    const m = mapPlacement(
      { item_id: 'T000', position: { x: 0, y: 0, z: 0 }, dimensions: { L: 250, W: 250, H: 700 } },
      pallet,
      'T',
    );
    expect(m.size).toEqual([250, 700, 250]); // [L,H,W]
    expect(m.center).toEqual([0 + 125 - 500, 100 + 0 + 350, 0 + 125 - 400]); // [-375, 450, -275]
  });
  it('rotated box D003 (perm [2,0,1] name HLW, post-orientation dims)', () => {
    const m = mapPlacement(
      { item_id: 'D003', position: { x: 0, y: 0, z: 700 }, dimensions: { L: 150, W: 600, H: 300 } },
      pallet,
      'D',
    );
    expect(m.size).toEqual([150, 300, 600]); // uses placed dims verbatim, NOT perm
    expect(m.center).toEqual([0 + 75 - 500, 100 + 700 + 150, 0 + 300 - 400]); // [-425, 950, -100]
  });
});
```

## State of the Art

| Old Approach                                                                        | Current Approach                                                | When Changed              | Impact                                                                     |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| Imperative three.js (`scene.add`, manual OrbitControls, CDN importmap) — the mockup | Declarative r3f 9 + drei 10 components, npm-bundled, code-split | This project's stack lock | Mockup is a _visual spec_, not importable code; reimplement declaratively. |
| Guessing API field semantics from the mockup                                        | Resolve from `/openapi.json` + a captured real response         | This phase                | The locked risk is eliminated empirically.                                 |

**Deprecated/outdated:**

- The mockup's "positions are box-centre" note — **wrong for the real API** (min-corner). Treat the mockup as visual intent only.

## Assumptions Log

| #   | Claim                                                                                                                                                               | Section                      | Risk if Wrong                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | drei 10 `<OrbitControls>` / `<Bounds>` / `<Edges>` prop names (`makeDefault`, `enableDamping`, `fit`, `clip`, `observe`, `margin`) are as stated and stable from v9 | Pattern 3/4, Don't Hand-Roll | Low — these props are long-stable; verify against pmndrs.github.io/drei during implementation. A wrong prop is a quick compile/runtime fix, not an architecture change.                 |
| A2  | `deckTopY = 100` (blockH 78 + deckH 22) is an acceptable deck height for the pallet model                                                                           | Pattern 1                    | None functional — it's a visual constant (D-12 says tunable); only affects where boxes sit relative to the rendered wood model.                                                         |
| A3  | Legend derived from the whole-fixture type set (3 types) rather than pallet-0 contents (2 types)                                                                    | Pitfall 5                    | Low — a presentation choice; planner may pick (b)/(c). Does not affect mapping correctness.                                                                                             |
| A4  | The captured `pack-done3` fixture (2 pallets / 7 unpacked / 3 types / 3-cycle rotation) is the one to commit                                                        | Summary, Fixture Capture     | None — it is the richest of three real captures and satisfies every D-02 criterion. If the planner wants pallet-0 to carry 3 types, a re-capture is cheap (procedure documented below). |

**No assumptions exist for the locked risk (D-06)** — `position` semantics, `dimensions` pre/post-orientation, and `perm` gather/scatter are all `[VERIFIED]` against the live API and captured data, not assumed.

## Open Questions (RESOLVED)

Both questions below were resolved during planning and are encoded in the Phase 2 plans — neither is an open blocker.

1. **Should pallet 0 carry 3+ box types for a richer legend? — RESOLVED.**
   - What we know: the captured fixture's pallet 0 has 2 types (T, D); F cubes are on pallet 1 / unpacked. The full fixture has 3 types.
   - What's unclear: whether RESULT-01's "coloured by type + legend" is better demonstrated with 3 swatches on screen.
   - **RESOLVED (plan decision, recommendation (a)):** the legend is derived from the **whole-fixture type set {D,F,T}** (3 swatches), not pallet-0 contents — no re-capture needed. Encoded in `02-01-PLAN.md` Task 3 (`palette.test.ts` derives the type set from all pallets + unpacked) and `02-02-PLAN.md` (`ViewerOverlay` legend rows = whole-fixture types).

2. **`<Html>` overlay vs absolute-positioned DOM for the chrome? — RESOLVED.**
   - What we know: D discretion allows either. The chrome (header, legend, ISO/TOP/FRONT buttons, hints) is screen-anchored, not 3D-anchored.
   - **RESOLVED (plan decision):** plain **absolute-positioned DOM** over the `<Canvas>` (simpler, no r3f-portal cost). `<Html>` is reserved for Phase 6's 3D-anchored CoG/hover labels. Encoded in `02-02-PLAN.md` Task 2 (`ViewerOverlay` is absolute-positioned DOM, not drei `<Html>`).

## Environment Availability

| Dependency                                   | Required By            | Available         | Version                                    | Fallback                                                              |
| -------------------------------------------- | ---------------------- | ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Live packing API (`packerapi.anzozulia.xyz`) | Fixture capture (D-01) | ✓                 | service 0.1.0 / core 3.13.0 / api v1       | Already captured — fixture committed; API not needed again this phase |
| API auth                                     | Fixture capture        | ✓ (none required) | —                                          | N/A — no auth needed                                                  |
| curl                                         | Capture script         | ✓                 | system                                     | —                                                                     |
| three / r3f / drei / vitest / playwright     | Viewer + tests         | ✓                 | locked quartet + test stack (package.json) | —                                                                     |

**Missing dependencies with no fallback:** none.
**Note:** Python's `urllib` failed SSL cert verification on this machine (no local CA bundle); **use `curl` for any capture/probe**, not Python `urllib`. The capture script in the plan should use `curl` (proven working).

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | vitest `4.1.8` (jsdom env) + @testing-library/react `16.3.2`; @playwright/test `1.60.0` for Canvas smoke                                          |
| Config file        | `vitest.config.ts` (Phase 1 — re-registers `tsconfigPaths()`, env jsdom); `playwright.config.ts` (webServer = `npm run build && npm run preview`) |
| Quick run command  | `npx vitest run src/lib/mapping.test.ts`                                                                                                          |
| Full suite command | `npm test` (vitest) then `npm run test:e2e` (Playwright) — match Phase 1 script names                                                             |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                                    | Test Type | Automated Command                                          | File Exists? |
| --------- | ------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- | ------------ |
| RESULT-01 | Mapping produces correct centre+size for non-rotated box (golden)                           | unit      | `npx vitest run src/lib/mapping.test.ts -t "non-rotated"`  | ❌ Wave 0    |
| RESULT-01 | Mapping produces correct centre+size for ROTATED box using post-orientation dims (golden)   | unit      | `npx vitest run src/lib/mapping.test.ts -t "rotated"`      | ❌ Wave 0    |
| RESULT-01 | AABB sanity: every mapped box sits within the pallet envelope                               | unit      | `npx vitest run src/lib/mapping.test.ts -t "envelope"`     | ❌ Wave 0    |
| RESULT-01 | Palette is deterministic + legend type set                                                  | unit      | `npx vitest run src/lib/palette.test.ts`                   | ❌ Wave 0    |
| RESULT-01 | Viewer renders the Canvas + ≥1 box mesh (no WebGL errors)                                   | e2e/smoke | `npx playwright test e2e/result-viewer.spec.ts`            | ❌ Wave 0    |
| RESULT-02 | ISO/TOP/FRONT buttons exist and change camera (canvas pixels change / button `.on` toggles) | e2e       | `npx playwright test e2e/result-viewer.spec.ts -g presets` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/` (mapping + palette golden tests — sub-second).
- **Per wave merge:** `npm test` (full vitest) + `npm run test:e2e` (Playwright preview-build smoke).
- **Phase gate:** full vitest + Playwright green; `scripts/check-code-split.mjs` passes (three stays in lazy chunk); before `/gsd-verify-work`.

### The golden-value approach (rationale)

The mapping is a **pure deterministic function**: given the committed fixture's exact `position`+`dimensions`, the output is a fixed tuple. Golden tests pin the _exact_ numbers (e.g. `T000 → center [-375,450,-275]`, `D003 → center [-425,950,-100], size [150,300,600]`) so any regression in axis order, half-extent, recentre, or z→y swap fails loudly. The **rotated case is the load-bearing test** — it proves `dimensions` is used post-orientation and `perm` is _not_ re-applied. The **AABB invariant** is a property test over _all_ placements (verified 0 violations on the real fixture) catching mapping errors the spot-checks miss. WebGL output is unprovable in jsdom, so the Canvas render + preset switching is asserted only in the **Playwright preview-build smoke** (Phase 1 pattern).

### Wave 0 Gaps

- [ ] `src/lib/__fixtures__/pack-request.json` + `pack-done-response.json` — capture & commit (the golden source for all tests)
- [ ] `src/lib/mapping.ts` + `src/lib/mapping.test.ts` — covers RESULT-01 mapping + AABB
- [ ] `src/lib/palette.ts` + `src/lib/palette.test.ts` — covers RESULT-01 colour-by-type
- [ ] `e2e/result-viewer.spec.ts` — Canvas mount + ISO/TOP/FRONT (RESULT-01/02)
- [ ] No new framework install — vitest/playwright already configured (Phase 1)

## Security Domain

> `security_enforcement: true`, ASVS level 1. This phase: pure math + committed static fixture + client-side 3D render. No auth, no user input persistence, no network calls at runtime (the fixture is bundled), no secrets.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                 |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | API needs no auth (verified); no app auth                                                                                        |
| V3 Session Management | no      | Stateless tool, no sessions                                                                                                      |
| V4 Access Control     | no      | No protected resources                                                                                                           |
| V5 Input Validation   | minimal | Fixture is committed trusted JSON; no runtime user input in this phase. (Live-response validation is Phase 5's concern via zod.) |
| V6 Cryptography       | no      | No crypto, no secrets                                                                                                            |

### Known Threat Patterns for this stack

| Pattern                                         | STRIDE          | Standard Mitigation                                                                                                                                             |
| ----------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malformed/oversized fixture crashing the viewer | DoS / Tampering | Fixture is a fixed committed file reviewed in PR; not attacker-controlled. The dev-mode AABB assert + golden tests catch malformed geometry at build/test time. |
| Supply-chain (new deps)                         | Tampering       | N/A — no new packages installed this phase (Phase 1 supply-chain checkpoint already approved the locked set).                                                   |
| three/WebGL untrusted input                     | Tampering       | No untrusted runtime input; data is the bundled fixture.                                                                                                        |

**Net:** Phase 2 has a negligible security surface. The only forward-looking note: when Phase 5 introduces the live client, validate `GET /jobs/{id}` responses with zod at the boundary (CLAUDE.md already prescribes this) — out of scope here.

## Fixture Capture Procedure (verified working — for the plan)

The capture was performed during this research; the planner should commit the captured pair. To re-run/re-capture (e.g. for a pallet-0-with-3-types variant), the proven flow:

1. **Probe (no auth):** `curl -s https://packerapi.anzozulia.xyz/api/v1/health` → `{"status":"ok","redis":"ok"}`; `/api/v1/version` → `{"service":"0.1.0","core":"3.13.0+...","api":"v1"}`.
2. **POST** the request JSON: `curl -s -X POST .../api/v1/pack -H "Content-Type: application/json" --data @request.json` → `202 {"job_id","status":"queued","links":{"self":"/api/v1/jobs/<id>"}}`.
3. **Poll** `curl -s https://packerapi.anzozulia.xyz<links.self>` every ~2s until `status ∈ {done, failed, timeout}` (real solves finished in ~8–10s here). Save the full `JobState` (the object with `job_id`/`status`/`result`) verbatim.
4. **Use `curl`, not Python urllib** (SSL CA issue on this machine).
5. **Config that produced the recommended golden fixture** (2 pallets, 7 unpacked, 3 types, 3-cycle rotation): pallet `1000×800×1000`, `max_weight 250`, `max_pallets 2`, `seed 7`, `support_ratio 0.8`; boxes: 12× D `600×300×150 weight5 rotations:all`, 12× T `250×250×700 weight7 rotations:this_side_up`, 14× F `350×350×350 weight9 rotations:none`. Result: `items_packed 31, items_unpacked 7, pallets_used 2`; perm distribution `{[0,1,2]:20, [2,0,1]:8, [0,2,1]:1, [1,0,2]:2}` — includes the 3-cycle `[2,0,1]` needed to prove scatter semantics.
6. **Verify before locking:** assert ≥1 placement has `perm != [0,1,2]`, ≥2 pallets, ≥1 unpacked, ≥3 distinct request box types — and run the AABB check (0 violations expected). All confirmed for the recommended capture.

## Sources

### Primary (HIGH confidence)

- **Live API `https://packerapi.anzozulia.xyz/openapi.json`** (OpenAPI 3.1, fetched 2026-06-03) — exact schemas: `PlacementOut` (position = min corner), `BoxDims` (post-orientation extents), `Vec3` (x=length, y=width, z=height/up), `Orientation` (perm maps L,W,H onto x,y,z), `PackRequest`/`BoxIn`/`PalletIn`/`OptionsIn`, `JobState`/`JobAccepted` (async lifecycle + done example).
- **Captured real `done` responses** (3 jobs, 2026-06-03) — empirical confirmation of min-corner positions, post-orientation dims, scatter perm (3-cycle disambiguation), AABB containment (0 violations), multi-pallet + unpacked behaviour.
- `/api/v1/health`, `/api/v1/version` (live) — no-auth confirmation; service/core versions.
- `package.json` (read 2026-06-03) — installed versions: three 0.184.0, @react-three/fiber 9.6.1, @react-three/drei 10.7.7, @types/three 0.184.1, react 19.2.7, vitest 4.1.8, @testing-library/react 16.3.2, @playwright/test 1.60.0, clsx 2.1.1, nanoid 5.1.11; zod absent.
- `design/result.html` (read) — scene/material/light/edge/pallet-model recipe + ISO/TOP/FRONT feel reference; the (now-corrected) box-centre note.
- `CLAUDE.md`, `01-CONTEXT.md`, `STATE.md` — locked stack, code-split gate, jsdom-WebGL-free rule, deck constants.

### Secondary (MEDIUM confidence)

- `https://github.com/pmndrs/drei` (fetched) — confirms drei 10.7.7 exists and lists the components used; detailed prop docs redirect to pmndrs.github.io/drei.

### Tertiary (LOW confidence)

- Training-data knowledge of exact drei 10 prop names (A1) — stable across v9/v10 but verify at pmndrs.github.io/drei during implementation.

## Metadata

**Confidence breakdown:**

- Locked-risk geometry semantics (position/dims/perm): **HIGH** — verified against live API spec + captured data with a disambiguating 3-cycle case.
- Standard stack: **HIGH** — versions read directly from package.json; no new installs.
- Architecture / drei usage: **MEDIUM-HIGH** — composition is mockup-proven; exact drei prop names are stable-but-verify (A1).
- Pitfalls / validation: **HIGH** — grounded in the real fixture and Phase 1's established testing split.

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable; the API contract and locked stack are pinned. Re-verify only if the API version changes from 0.1.0 / core 3.13.0.)
