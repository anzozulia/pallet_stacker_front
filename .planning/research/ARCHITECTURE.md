# Architecture Research

**Domain:** React + Vite + TS single-page app over an asynchronous (submit-then-poll) packing API, rendering a Three.js / react-three-fiber 3D result. No backend of our own; all state is client-side.
**Researched:** 2026-06-03
**Confidence:** HIGH

> Sources: TanStack Query v5 polling + cancellation docs (Context7 `/tanstack/query`, verified 2026-06-03), the project's own design mockups (`design/result.html`, `design/config.html`), and `.planning/PROJECT.md`. The coordinate contract below is read directly out of the working mockup, so it is HIGH confidence — it is the convention the user already validated visually.

---

## Standard Architecture

This is a **stateless client over a remote async job API**. The right shape is a thin layered SPA, not a framework. Four concerns, kept as separate modules with one-directional dependencies:

1. **Domain types + pure transforms** (no React, no I/O) — the testable core.
2. **API client + polling** (I/O, owns the network and the job lifecycle).
3. **Config state** (the form, persisted to localStorage).
4. **3D render** (react-three-fiber, consumes mapped meshes only).

The golden rule: **the 3D layer and the form layer never touch the API shape directly.** Everything crosses through the pure transform layer (`request-builder`, `result-mapper`, `coordinate-map`). That keeps the make-or-break coordinate logic in plain functions you can unit-test without a browser or a GPU.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          UI LAYER (React)                              │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────────────┐  │
│  │ ConfigPage   │   │ LoadingPage  │   │ ResultPage                │  │
│  │ (catalog +   │   │ (poll status │   │ ┌─────────┐ ┌───────────┐ │  │
│  │  pallet form)│   │  + cancel)   │   │ │ Viewer  │ │ Rail      │ │  │
│  └──────┬───────┘   └──────┬───────┘   │ │ (r3f)   │ │ summary / │ │  │
│         │                  │           │ └────┬────┘ │ pallets / │ │  │
│         │                  │           │      │      │ placements│ │  │
│         │                  │           └──────┼──────┴─────┬─────┘ │  │
└─────────┼──────────────────┼──────────────────┼────────────┼────────┘
          │ read/write        │ start / poll      │ scene       │ list
          ▼                   ▼                    ▼             ▼
┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐
│ CONFIG STATE     │  │ API + POLLING      │  │ PURE TRANSFORM CORE       │
│ Zustand store    │  │ TanStack Query     │  │ (no React, no I/O)        │
│ + persist mw     │  │  useMutation(pack) │  │  request-builder.ts       │
│ (localStorage)   │  │  useQuery(job)     │  │  result-mapper.ts         │
│                  │  │  refetchInterval fn│  │  coordinate-map.ts ◄─────┐│
└────────┬─────────┘  └─────────┬─────────┘  └───────────┬──────────────┘│
         │                      │ fetch(signal)          │ PackRequest    │
         │  Config ────────────►│                        │ / Scene        │
         │                      ▼                        │                │
         │            ┌───────────────────┐              │   THE         │
         └───────────►│ api/client.ts     │◄─────────────┘   MAKE-OR-     │
                      │ typed fetch wrapper│                  BREAK FN ────┘
                      └─────────┬─────────┘
                                │ HTTP (VITE_API_URL)
                                ▼
                      ┌───────────────────┐
                      │ packerapi (remote)│
                      │ POST /pack 202    │
                      │ GET /jobs/{id}    │
                      └───────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `types/` | Single source of truth for API contract (`PackRequest`, `PackResult`, `Job`, `Orientation`) **and** UI domain (`BoxType`, `PalletConfig`, `PackOptions`). | Hand-written TS interfaces; optionally Zod schemas for runtime validation of API responses. |
| `api/client.ts` | Typed `fetch` wrapper: base URL from `import.meta.env.VITE_API_URL`, JSON encode/decode, error normalization, **forwards an `AbortSignal`**. Knows nothing about React. | Plain async functions: `submitPack(req, signal)`, `getJob(id, signal)`, `getHealth()`. |
| `api/usePackJob.ts` | The async job lifecycle as a hook: `useMutation` to POST `/pack`, then `useQuery` on `/jobs/{id}` with a function-form `refetchInterval` that returns `false` once status is terminal. | TanStack Query v5. |
| `config/store.ts` | Holds the editable config (pallet + box catalog + options), exposes actions (`addBoxType`, `updateBoxType`, `setPallet`…), persists to localStorage with versioning. | Zustand + `persist` middleware. |
| `transform/request-builder.ts` | **Pure.** `buildPackRequest(config) → PackRequest`. Expands each box type's `qty` into N individual boxes with stable unique IDs; maps the 3 UI rotation modes → API allowed orientations. | Pure function, fully unit-tested. |
| `transform/result-mapper.ts` | **Pure.** `mapResult(packResult, config) → ViewModel`. Groups placed items back to their type (color, name, weight) via the ID convention; splits per pallet; computes per-pallet legend; surfaces unpacked + diagnostics. | Pure function, fully unit-tested. |
| `transform/coordinate-map.ts` | **Pure, the critical module.** `toMesh(item, pallet) → { position:[x,y,z], size:[sx,sy,sz] }` converting API `{position, dimensions, orientation.perm}` into a r3f mesh transform. | Pure function, the most-tested file in the repo. |
| `viewer/Scene.tsx` + meshes | r3f `<Canvas>`, pallet model, `OrbitControls` (drei), camera presets, box meshes. Consumes **only** the output of `coordinate-map` — never raw API fields. | react-three-fiber + drei. |
| `pages/` | Route-level orchestration: `ConfigPage`, `LoadingPage`, `ResultPage`. Wire stores/hooks to presentational components. | React Router (or a 3-state enum if routing is overkill — see Anti-Pattern 2). |

---

## Recommended Project Structure

```
src/
├── types/
│   ├── api.ts            # PackRequest, PackResult, Job, JobStatus, Orientation, PlacedItem
│   └── domain.ts         # BoxType, PalletConfig, PackOptions, RotationMode
├── api/
│   ├── client.ts         # typed fetch wrapper (VITE_API_URL, AbortSignal)
│   ├── usePackJob.ts     # useMutation(pack) + useQuery(job) polling hook
│   └── queryKeys.ts      # ['job', jobId] key factory
├── config/
│   ├── store.ts          # Zustand store + persist(localStorage) + version/migrate
│   └── defaults.ts       # seed pallet + empty/seed catalog
├── transform/            # ── PURE CORE, no React imports ──
│   ├── request-builder.ts   # config → PackRequest (qty expansion, ID minting)
│   ├── request-builder.test.ts
│   ├── result-mapper.ts     # PackResult → ViewModel (group by type, per pallet)
│   ├── result-mapper.test.ts
│   ├── coordinate-map.ts    # API item → three.js mesh transform  ◄── highest-risk
│   └── coordinate-map.test.ts
├── viewer/
│   ├── Scene.tsx         # <Canvas>, lights, OrbitControls, camera presets
│   ├── Pallet.tsx        # the wooden pallet model
│   ├── Boxes.tsx         # maps mapped items → <mesh> via coordinate-map output
│   └── useCameraPresets.ts  # ISO / TOP / FRONT
├── pages/
│   ├── ConfigPage.tsx
│   ├── LoadingPage.tsx
│   └── ResultPage.tsx
├── components/           # presentational (BoxTypeCard, PalletForm, SummaryRail, PlacementList)
└── main.tsx              # QueryClientProvider, router
```

### Structure Rationale

- **`transform/` is the heart and is React-free on purpose.** Co-locating `.test.ts` next to each pure module signals "these must be tested." `coordinate-map.ts` is the single function the entire visual correctness of the app depends on; isolating it from React/Three means it runs in vitest in milliseconds with no canvas.
- **`types/` split into `api.ts` vs `domain.ts`** keeps the wire format separate from the UI model. The `transform/` layer is the only bridge between them — that boundary is exactly where the qty-expansion and coordinate mapping live.
- **`api/` owns all I/O and the polling lifecycle.** UI components call hooks, never `fetch`. Swapping the polling strategy never touches a page.
- **`viewer/` consumes mapped data only.** A reviewer can confirm correctness by reading `coordinate-map.ts` alone; the r3f components are "dumb."

---

## The Coordinate-Mapping Contract (make-or-break)

This is read directly from the working mockup (`design/result.html`) and must be reproduced exactly. **Get this wrong and every box is in the wrong place.**

### Conventions, stated explicitly

**API / data space** (`PROJECT.md`, mockup note "positions are box-centre · mm · origin = pallet corner"):
- Units: **millimetres**, integers.
- Origin: **pallet corner** (the (0,0) corner of the pallet footprint), not the centre.
- Position `{x, y, z}` is the **box CENTRE**, where:
  - `x` runs along pallet **Length (L)**
  - `y` runs along pallet **Width (W)**
  - `z` is **height** above the deck (vertical) — in the mockup this is reconstructed as `base + h/2`; from the real API it is the item's `z` centre.
- Dimensions `{L, W, H}` are the box's footprint length, width, and height **after** the chosen orientation is applied (`orientation.perm` tells you which original axis became which).

**Three.js space** (r3f, right-handed, **Y is up**):
- `+X` ← pallet Length, `+Z` ← pallet Width, `+Y` ← height. So **API `x`→three `x`, API `y`→three `z`, API `z`(height)→three `y`.**
- A `BoxGeometry(sx, sy, sz)` is centred on its own origin, so a mesh's `position` is its centre — which matches the API's box-centre convention directly (no half-size offset needed for the box itself; the offset is only to recentre the pallet).

### The mapping, line by line (from `result.html` lines 322–331)

The mockup builds geometry and position as:

```js
// geometry: API L→three X, API H→three Y, API W→three Z
const geo = new THREE.BoxGeometry(b.l, b.h, b.w);
// position: recentre the pallet on origin, lift to deck top, place box centre
m.position.set(
  b.x - PL.L/2,                     // X: centre the pallet footprint on 0
  deckTopY + (b.base||0) + b.h/2,   // Y: deck top + stack height + half box height
  b.y - PL.W/2                      // Z: centre the pallet footprint on 0
);
```

Two things the production mapper must generalise from the mock:
1. The mock recentres the pallet (`- L/2`, `- W/2`) so it sits symmetric about the origin and the camera/orbit target is simple. **Keep this** — it makes `OrbitControls.target` and camera presets stable regardless of pallet size.
2. The mock fakes height with `base + h/2` because it has no solver. **The real API gives a true `z` centre**, so the production mapper uses the API `z` directly plus the deck offset.

### `applyOrientation(dimensions, orientation.perm)`

`orientation.perm` is an axis permutation array describing how the box's original axes were rotated into place. **Apply the permutation to the dimensions before mapping to three.js axes.** The contract:

```ts
// perm is a length-3 array of indices into the original [L0, W0, H0].
// e.g. perm = [0,1,2] = identity "LWH"; perm = [2,1,0] swaps L and H, etc.
function applyOrientation(dims: [number,number,number], perm: [number,number,number]) {
  return [dims[perm[0]], dims[perm[1]], dims[perm[2]]] as [number,number,number];
}
```

**IMPORTANT — verify against the live API before trusting either reading of `perm`.** A permutation array is ambiguous: `out[i] = in[perm[i]]` ("gather") vs `out[perm[i]] = in[i]` ("scatter") produce different results for non-symmetric perms. The API also returns `dimensions` that may *already* be post-orientation (the orientation is metadata) — in which case `perm` is only needed for labelling/legend, and you map dimensions straight through. **Resolve this with one real `done` response during the API-client slice and write a fixture test.** This is the single most likely source of a "boxes look rotated wrong" bug. Flag for the roadmap.

### The production pure function (target signature)

```ts
// transform/coordinate-map.ts — the most-tested file in the repo
export interface MeshTransform {
  position: [number, number, number]; // three.js (x, up=y, z), mm, pallet recentred
  size: [number, number, number];     // three.js BoxGeometry args (sx, sy=height, sz)
}

export function toMeshTransform(
  item: PlacedItem,            // { position:{x,y,z}, dimensions:{L,W,H}, orientation:{name,perm} }
  pallet: { L: number; W: number },
  deckTopY: number,            // pallet deck top in mm (blockH + deckH from the pallet model)
): MeshTransform {
  // 1. resolve oriented footprint (see applyOrientation caveat above)
  const [L, W, H] = orientedDims(item);   // -> [L,W,H] in pallet axes
  // 2. axis remap API(x=L, y=W, z=height) -> three(x, y=up, z)
  return {
    size: [L, H, W],                       // API L→X, H→Y, W→Z   (matches geo above)
    position: [
      item.position.x - pallet.L / 2,      // X recentred
      deckTopY + item.position.z,          // Y: deck + true height centre from API
      item.position.y - pallet.W / 2,      // Z recentred
    ],
  };
}
```

> If the API's `z` is a corner (deck-relative bottom) rather than a centre, add `+ H/2`. Determine which from a real response — another fixture-test point.

---

## Box-Type ↔ Individual-Box Expansion & Mapping

The config UI groups boxes by **type** with a `qty` (see `config.html` seed: `BX-01 … qty:64`). The API wants **individual boxes with unique IDs**. Two pure functions own this round-trip:

### Expand (request-builder)

```ts
// stable, decodable IDs so we can map results back without a lookup table
function expand(type: BoxType): ApiBox[] {
  return Array.from({ length: type.qty }, (_, i) => ({
    id: `${type.id}#${i}`,            // e.g. "BX-01#0" … "BX-01#63"
    dimensions: { L: type.l, W: type.w, H: type.h },
    weight: type.kg,
    max_load: type.fragile ? 0 : type.maxload,
    fragile: type.fragile,
    allowed_orientations: rotationModeToApi(type.rotationMode), // 3 modes -> API enum
  }));
}
```

**Decision: encode the type in the box ID (`TYPE#index`).** This makes `result-mapper` a pure string-split with zero extra state, and is robust to reordering. (Alternative — a separate `Map<boxId, typeId>` — adds a side structure to thread through; avoid it.)

### Map back (result-mapper)

```ts
function typeIdOf(boxId: string) { return boxId.split('#')[0]; }
// group placements by typeId -> recover color/name/weight from the catalog,
// build per-pallet legend, count unpacked, attach diagnostics (cog, support_ratio).
```

Rotation modes: the UI exposes only the **3 API-honoured modes** (`all` / `this_side_up` / `none`) per `PROJECT.md` (the mockup's 6 chips are explicitly out of scope). `rotationModeToApi` is the single translation point.

---

## API Client + Async Polling

### Polling strategy (verified against TanStack Query v5, Context7 2026-06-03)

`useMutation` POSTs `/pack` → gets `{ job_id }`. Then `useQuery(['job', jobId])` polls `/jobs/{id}` with a **function-form `refetchInterval` that returns `false` on a terminal status**:

```ts
const job = useQuery({
  queryKey: ['job', jobId],
  queryFn: ({ signal }) => getJob(jobId, signal),   // signal → fetch → cancel on unmount
  enabled: !!jobId,
  refetchInterval: (query) => {
    const s = query.state.data?.status;
    if (s === 'done' || s === 'failed' || s === 'timeout') return false; // stop
    return 1500;                                                          // poll otherwise
  },
});
```

Why this exact shape:
- **`return false` clears the timer** the moment the job is terminal — no manual `clearInterval`, no extra request after `done`. (Confirmed in current docs; this is the canonical v5 polling pattern.)
- **`signal` from `queryFn` → `fetch(url, {signal})`** gives free cancellation. TanStack aborts the in-flight request automatically when the query unmounts or the key changes.
- **`enabled: !!jobId`** keeps the query dormant until a job exists.

### Cancellation & navigation

- **Cancel on navigate away from Loading:** the user pressing "Cancel" navigates back to Config, which unmounts `LoadingPage`; the query unmounts and TanStack aborts the in-flight `fetch` via the signal. For belt-and-braces, also `queryClient.cancelQueries({ queryKey: ['job', jobId] })` in the cancel handler.
- **Do NOT build a manual `setInterval` + `AbortController` loop.** That is the layer to *not* add — TanStack already owns interval lifecycle, abort wiring, dedup, and React-strict-mode double-mount safety.

### Backoff

**Recommendation: do NOT add exponential backoff for v1.** A fixed `1500ms` interval is correct for a job expected to finish in ~2s (mockup says "Solved in 1.84s"). Backoff only helps for long-tail jobs and adds complexity/test surface. If real jobs run long, a *capped linear* step (1.5s → 3s after ~15s) is the most you should add — express it inside the same `refetchInterval` function using `query.state.dataUpdateCount`, not a new module. Flag as a later optimization, not MVP.

### Error / timeout / unpacked states

Three terminal branches handled in `ResultPage`/`LoadingPage`: `failed` and `timeout` → error screen with retry; `done` with `unpacked > 0` → success screen that surfaces unpacked items (not an error). Network/HTTP errors from the client surface via TanStack's `isError`.

---

## Config State & Persistence

### Decision: Zustand + `persist` middleware (localStorage)

- The catalog is a **dynamic, deeply-nested editable array** (add/remove types, edit dimensions, toggle rotation/fragile). React Hook Form is great for a fixed form but awkward for "a list of cards that is also the persisted source of truth." Zustand models "the config is an object that lives in localStorage and a few pages read/write it" most directly.
- `persist` middleware writes to localStorage automatically with a **`version` + `migrate`** so a future schema change doesn't crash on an old saved config (you will change the schema — plan for it now, it is nearly free).
- Keep **validation at the edge**: numeric coercion / min checks in the input components or a thin `validateConfig(config)` before `buildPackRequest`. Don't put a validation framework in the store.

### What NOT to add here

- **No Redux / RTK.** Single store, no time-travel, no middleware stack needed.
- **No global state for server data.** The job/result lives in TanStack Query's cache, *not* in Zustand. Persisting results to localStorage is explicitly out of scope (`PROJECT.md`: no history). Keep config (input) and result (server state) in different stores — they have different lifetimes.

---

## Data Flow

### End-to-end request flow

```
[ConfigPage edits]
   ↓ (Zustand actions, autosaved to localStorage)
Config { pallet, boxTypes[], options }
   ↓ buildPackRequest(config)           ── PURE: expand qty→N boxes, mint IDs, map 3 rotation modes
PackRequest
   ↓ useMutation → POST /api/v1/pack
{ job_id, status:"queued" }   → navigate to LoadingPage
   ↓ useQuery(['job', id]) refetchInterval=1500ms, stop on terminal
GET /api/v1/jobs/{id}  (status: queued → running → done)
   ↓ on done
PackResult
   ↓ mapResult(result, config)          ── PURE: group by type (ID split), per-pallet, diagnostics
ViewModel { pallets[], legend, summary, unpacked }
   ↓ select pallet
   ├─► SummaryRail / PalletSwitcher / PlacementList   (presentational)
   └─► Boxes.tsx → toMeshTransform(item, pallet, deckTopY)  ── PURE: coordinate map
          ↓
       <mesh position size> in <Canvas>   (react-three-fiber)
```

### State ownership

```
Zustand (persisted)        TanStack Query (in-memory, ephemeral)
  Config (INPUT)             Job status + PackResult (SERVER STATE)
        │                              │
        └──── buildPackRequest ───────►│
                                       └──── mapResult ────► ViewModel (derived, in render)
```

The ViewModel is **derived, not stored** — compute it with `useMemo` from `(result, config)`. No third store.

---

## Build Order for Vertical MVP

The pure core has no dependencies, so build it first and prove it in isolation; then add the thinnest possible UI/IO around it. Each slice ends in something demonstrable.

| # | Slice | Why this order | Demonstrable end state |
|---|-------|----------------|------------------------|
| 1 | **`types/` + `coordinate-map.ts` + tests** | Highest risk, zero deps. Lock the API↔three contract before anything renders. | `vitest` proves a fixture item maps to the exact mesh transform the mockup produces. |
| 2 | **`viewer/` with hard-coded fixture** | Render the mockup's 12-box `BOXES` array through `toMeshTransform` in r3f. Proves the contract *visually* matches `result.html`. | A static r3f scene identical to the mockup, no API. |
| 3 | **`request-builder` + `result-mapper` + tests** | Pure, deps only on `types`. Locks qty-expansion and type-regrouping. | Round-trip test: config → request → (fixture result) → ViewModel groups correctly. |
| 4 | **`config/store.ts` + ConfigPage form** | Deps on `types`. Editable catalog persisted to localStorage. | Edit boxes, refresh page, config survives. |
| 5 | **`api/client.ts` + `usePackJob` + LoadingPage** | Deps on `types`, `request-builder`. Wire real submit-then-poll. **Resolve the `perm`/`z`-centre ambiguity here against a live `done` response and add a fixture test back into slice 1.** | Submit real job, watch status poll to `done`, cancel works. |
| 6 | **ResultPage wiring (viewer + rail) on real data** | Connects everything: real result → mapper → coordinate-map → viewer + placement list + pallet switcher. | Full vertical: configure → run → explore real 3D plan. |
| 7 | **Edge states + export + Docker** | failed/timeout/unpacked screens; JSON/print export; static build + container. | Self-hostable image, graceful failures. |

**The critical dependency:** slices 1–2 *must* precede any API work. The coordinate contract is the project's correctness pivot; proving it against the already-validated mockup before touching the network removes the only truly risky unknown early, and gives every later slice a trustworthy renderer.

---

## Anti-Patterns (where NOT to add layers)

### Anti-Pattern 1: A custom polling/abort loop

**What people do:** `useEffect` with `setInterval` + a manual `AbortController` ref + cleanup.
**Why it's wrong:** Re-implements (buggily) what TanStack Query does correctly — strict-mode double-mount, key-change abort, dedup, stop-on-terminal. Leaks timers on fast navigation.
**Instead:** `useQuery` with function-form `refetchInterval` returning `false`, and `signal` in `queryFn`.

### Anti-Pattern 2: Heavy routing / a state machine for 3 screens

**What people do:** XState or a multi-route router for Configure → Loading → Result.
**Why it's wrong:** Three sequential screens with one branch is not a state-chart's problem. The flow is already encoded by "is there a `job_id`?" and "is the job terminal?"
**Instead:** React Router with 3 routes is fine; even a single `phase` enum derived from query state is acceptable. Don't add a state-machine dependency.

### Anti-Pattern 3: Letting API shapes leak into React/Three components

**What people do:** Read `item.orientation.perm` or `position.z` directly inside a `<mesh>`.
**Why it's wrong:** The coordinate bug then hides inside JSX, untestable without a canvas, duplicated per component.
**Instead:** All API→view conversion lives in `transform/`. Components consume `MeshTransform` and `ViewModel` only.

### Anti-Pattern 4: Persisting server results to localStorage

**What people do:** Cache the `PackResult` so refresh shows the last plan.
**Why it's wrong:** Explicitly out of scope (`PROJECT.md`: no history, stateless tool). Couples input and output lifetimes and invites stale-result bugs.
**Instead:** Persist **config only**. Result lives in TanStack's memory cache and is gone on refresh — that's correct for v1.

### Anti-Pattern 5: A "service layer" abstraction over `fetch`

**What people do:** Repository/service classes wrapping the three endpoints.
**Why it's wrong:** Three endpoints don't need an OOP layer; it's indirection without payoff.
**Instead:** Three plain typed functions in `client.ts`. That *is* the abstraction.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| packerapi (`VITE_API_URL`) | Async submit-then-poll over HTTPS; typed `fetch` + TanStack Query. | **CORS**: API must allow the serving origin (build-time URL → rebuild to change). Provide a **Vite dev proxy** for local dev to sidestep CORS. `/health`, `/version` for an optional status indicator. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Config store ↔ request-builder | Pure call `buildPackRequest(config)` | The qty→individual-box expansion + ID minting boundary. |
| API client ↔ result-mapper | Pure call `mapResult(result, config)` | Wire format → ViewModel; type regrouping by ID split. |
| result-mapper / viewer ↔ coordinate-map | Pure call `toMeshTransform(item, pallet, deckTopY)` | **The single correctness pivot.** No other code computes positions. |
| pages ↔ api hooks | `usePackJob()` hook | Pages never call `fetch`. |

---

## Scaling Considerations

This is a single-user, self-hosted, stateless tool — "scale" means **number of boxes in one scene**, not users.

| Scale | Adjustment |
|-------|------------|
| ≤ ~500 boxes | One `<mesh>` per box is fine; r3f handles it. The mockup's approach works as-is. |
| ~500–5k boxes | Switch box rendering to **instanced meshes** (`<Instances>`/`InstancedMesh` from drei), one instance group per box type (shared geometry+material, per-instance matrix from `toMeshTransform`). This is the first thing that breaks (draw calls), and it's a viewer-only change because positions already come from the pure mapper. |
| 5k+ | Frustum culling / LOD, lazy per-pallet rendering (only mount the selected pallet's meshes). |

**First bottleneck:** WebGL draw calls from per-box meshes → instancing. **Second:** localStorage size if someone pastes a giant catalog → cap qty / warn. Neither is an MVP concern.

---

## Sources

- TanStack Query v5 — Polling guide (`refetchInterval` function returning `false` to stop) and Query Cancellation guide (`signal` in `queryFn`). Context7 `/tanstack/query`, retrieved 2026-06-03. **HIGH.**
- `design/result.html` (lines 204–331) — the validated coordinate convention: box-centre, mm, origin=pallet corner; `BoxGeometry(l,h,w)`; `position.set(x-L/2, deckTop+base+h/2, y-W/2)`. **HIGH** (the user's own working mockup).
- `design/config.html` (lines 263–377) — box catalog/quantity model, rotation chips, seed types. **HIGH.**
- `.planning/PROJECT.md` — async API contract, qty-expansion requirement, 3-mode rotation simplification, no-history/no-persistence-of-results constraint, build-time `VITE_API_URL` + CORS consequence. **HIGH.**

---
*Architecture research for: stateless React SPA over an async packing API with a Three.js result viewer*
*Researched: 2026-06-03*
