# Phase 6: Result Page & 3D Wiring - Research

**Researched:** 2026-06-05
**Domain:** React 19 + r3f 9 / three 0.184 result page integration — wiring a real `done` packing payload (in react-query cache) into the existing persistent 3D viewer, plus a data rail, multi-pallet switcher, hover↔mesh highlight, and stability diagnostics (CoG marker, support-ratio heatmap).
**Confidence:** HIGH (this phase consumes already-built, tested code; the riskiest new derivations — CoG axis convention, box counts, support_ratio range — were resolved empirically against the committed fixture this session).

## Summary

Phase 6 is an **integration + visualization** phase, not a greenfield one. Every hard piece already exists and is golden-tested: the coordinate transform (`mapPlacement`), the result-shaper (`mapDoneResponse → ResultView`), the palette (`colorForType`), the entire faithful scene (`Pallet`/`Boxes`/`CameraPresets`/`ViewerOverlay`), and the API submit→poll→done lifecycle (`useSubmitJob`/`usePollJob`, `gcTime: Infinity`). The work is to (1) replace the hard-coded fixture import in `ResultPage.tsx` with the **real in-memory result**, (2) build the **rail** (plain DOM, inside the lazy subtree), (3) add a **selected-pallet** state that swaps which `MappedPallet.items` feed `Boxes`, (4) wire **one-way row→mesh emissive hover**, and (5) add the two diagnostics — a **CoG marker** in-scene and an **opt-in support-ratio heatmap**.

The five HIGH-PRIORITY open questions the CONTEXT flagged were all resolved this session against the **real captured fixture** (`src/lib/__fixtures__/pack-done-response.json`: job_id `ead54451…`, 2 pallets P001/P002, 31 packed, 7 unpacked, types D/F/T, 11 of 31 boxes rotated). Headline findings:
- **CoG up-axis is `cog.z`** — proven by reconstructing the weight-weighted box-centre centroid and matching it to `cog` **exactly** in API axis order (`cog.x`=length, `cog.y`=width, `cog.z`=height/up). The CoG point-map therefore reuses `mapPlacement`'s exact recentre+deckTop math with **no half-dimension offset** (a CoG is already a centre point).
- **InstancedMesh is NOT needed.** The largest captured pallet has **19 boxes** (P001); P002 has 12. Both are an order of magnitude below the ~100–200 threshold. Keep per-box individual meshes (required for per-box emissive hover, D-11).
- **All `support_ratio` values in the fixture are exactly `1`** (every box perfectly supported). This is a critical test-design finding: the heatmap **cannot** be meaningfully validated against the captured corpus (every box lands in the same bucket). The support-bucketing golden test must run on **hand-built synthetic inputs**, not the captured fixture.
- **The carrier problem is real and specific:** the `done` payload IS in the query cache (under `['job', jobId]`), but `idToType` is **only** in `LoadingPage`'s nav state and is currently **dropped** on `navigate('/result')`. The cleanest fix carries **both** `job_id` and `idToType` forward via nav state (Recommendation below).

**Primary recommendation:** Carry `{ jobId, idToType }` to `/result` via react-router nav `state` on the `done` navigation; `ResultPage` reads the `done` payload from `queryClient.getQueryData(['job', jobId])` and runs `mapDoneResponse(done, idToType)`. Add one `selectedPalletIndex` state that drives boxes + overlay sub-line + placement list + switcher highlight. Keep all new pure derivations (summary aggregation, CoG point-map, support bucketing) in three-free `src/lib/` modules with co-located Vitest golden tests; verify the rendered scene/marker/heatmap via the existing Playwright preview-build with route interception.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read `done` payload | Browser / Client (react-query cache) | — | C-02: result is ephemeral, in-memory only; lives in the `QueryClient` cache (`gcTime: Infinity`). No backend of our own. |
| `idToType` recovery map transport | Browser / Client (router nav state) | — | C-03: `idToType` is built client-side at submit; must ride nav state because it is not (and should not be) in the network cache. |
| Result shaping (`mapDoneResponse`) | Pure `src/lib/` (three-free) | — | C-04: data derivation stays out of the lazy three chunk; jsdom-testable. |
| Summary aggregation / per-pallet stats / support bucketing / CoG point-map | Pure `src/lib/` (three-free) | — | C-04: all are pure functions — golden-testable in jsdom, no WebGL. |
| Scene render (boxes, pallet, CoG marker, heatmap tint) | Client / WebGL (lazy `/result` chunk) | — | three/r3f/drei confined to the lazy subtree (code-split gate). |
| Rail DOM (summary, switcher, placement, unpacked) | Client / DOM (inside lazy subtree) | — | D-08: plain DOM; lives inside `ResultPage` lazy subtree — fine, no three import. |
| Selected-pallet UI state | Client / React state (`ResultPage`) | — | D-01/D-03: one piece of state drives canvas + overlay + placement + switcher. |
| Hover→mesh highlight | Client / React state + r3f material prop | — | D-11: one-way, keyed by `item_id`, declarative emissive prop. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carry-forward (do NOT re-litigate):**
- **C-01** Scene is built — swap data + add rail, do not rebuild. Locked coordinate semantics: `position` = box **min-corner**, `dimensions` = **post-orientation** extents, `orientation.perm` is a diagnostic index **already baked into `dimensions` — never re-applied**. `mapPlacement` is the single mapping authority (golden-locked).
- **C-02** `/result` reads the real `done` payload from the **react-query cache** (NOT the committed `pack-done-response.json` import it uses today). Result is **ephemeral**; hard refresh / deep-link with no result → **redirect to `/`**. Config stays autosaved; result is never persisted.
- **C-03** Type recovery is **map-PRIMARY (`idToType`) / parse-FALLBACK (`typeKeyOf`)**. `mapDoneResponse(done, idToType)` already wires this. ⚠ Open: resolve how `idToType` (+ the `done` payload / its `job_id`) reaches `/result`.
- **C-04** Code-split discipline holds: `/result` stays the **lazy three-only chunk** (`scripts/check-code-split.mjs` gate). New pure derivations live in **`src/lib/` and stay `three`-free**.
- **C-05** Honest over pretty; mm integers / kg.

**Multi-pallet & summary:**
- **D-01** Single persistent canvas renders **only the selected pallet's boxes** at a time; switching swaps which `MappedPallet` feeds `Boxes`. NOT all-pallets-at-once.
- **D-02** Switching pallets **preserves current orbit/zoom + active preset** — no auto-re-fit per switch.
- **D-03** Summary block = **whole-job** (`input_summary.pallets_used`/`max_pallets`, `total_volume_utilisation`, unpacked, **total weight summed across all pallets**). Viewer sub-line + placement list = **per-selected-pallet**.
- **D-04** Drop the amber "warn" low-fill tint. Show fill% **neutrally**.
- **D-05** Default-select **pallet index 0**. Label from API `pallet_id`, fallback "Pallet 1 / 2 / 3" — **not** A/B/C.

**Layout & topbar:**
- **D-06** Unpacked-items panel = **conditional rail block** (only when `unpacked_items.length > 0`); whole-job scope, non-interactive. When all packed, omit + show "All items packed ✓".
- **D-07** Omit Export button **and** the "Solved in" pill (no timing field in `DoneResponse`).
- **D-08** Responsive ≤900px: **stack rail below viewer** (do NOT hide it).
- **D-09** Keep step nav (Configure ✓ → Result) + "Edit configuration" back action to `/` (draft intact).

### Claude's Discretion
- **D-10** Stability diagnostics. **CoG (DIAG-01):** marker at selected pallet's `cog` (sphere/crosshair + drop-line to deck), toggle-able; `cog` is a **POINT** needing a new pure point-map reusing pallet-centre + deckTop conventions — **confirm the up-axis against the fixture first** (DONE — see Pattern 2). **Support (DIAG-02):** raw `support_ratio` always on the placement card; "support-ratio tinting" as an **opt-in heatmap toggle** (default OFF, by-type colouring is default). Bucketing/colour-scale is pure `src/lib/`.
- **D-11** Placement↔scene link = **one-way hover** (row → mesh emissive). Bidirectional / click-isolate / camera-focus deferred.
- **D-12** InstancedMesh threshold — **verify, don't pre-optimize** (DONE — keep individual meshes; max pallet = 19 boxes).

### Deferred Ideas (OUT OF SCOPE)
- JSON / printable export, single Docker image + SPA fallback, build-time `VITE_API_URL` + CORS-from-real-origin verification, GitHub self-host docs (DATA-01, HOST-01/02/03) → **Phase 7**.
- Bidirectional hover, click-to-select/isolate, camera-focus-on-box, persistent selection.
- All-pallets-at-once 3D layout.
- InstancedMesh box rendering.
- Amber low-fill / quality warnings.
- v2 result features (2D top-down, load sequence, PNG/PDF export).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESULT-03 | Whole-job summary stats (pallets used, utilisation, unpacked, total weight) | New pure `src/lib/result-summary.ts` aggregates over `ResultView.summary` + `pallets[].totalWeight`. Total weight = Σ `MappedPallet.totalWeight`; util = `summary.total_volume_utilisation`. Golden-test against fixture (Σ weight = 119+92 = 211 kg; util 0.7281; pallets 2; unpacked 7 / 38 total). |
| RESULT-04 | Pallet switcher + per-pallet 3D layout + per-pallet stats | `selectedPalletIndex` state → feed `view.pallets[i]` to `Boxes`. Per-pallet stats (`utilisation`, `totalWeight`, `items.length`) come straight off `MappedPallet`. Camera preserved on switch (D-02). |
| RESULT-05 | Placement list (id, type, position, size, orientation, weight) + hover→mesh highlight | `MappedPallet.items` are `PlacementOut & {typeId}` — already carry every field. Hover sets `hoveredId` state → declarative `emissive` prop on the matching box mesh keyed by `item_id`. |
| RESULT-06 | Unpacked panel + reasons | `ResultView.unpacked: UnpackedItem[]` carries `item_id`/`dimensions`/`weight`/`reason`. Conditional block; recover type via `idToType ?? typeKeyOf`. |
| DIAG-01 | CoG marker in scene | New pure `src/lib/cog-map.ts` point-map (up-axis = `cog.z`, confirmed). Renders sphere + vertical drop-line to deck in the lazy scene. Golden-tested. |
| DIAG-02 | Per-box support ratio + tinting | `support_ratio` already passes through `mapDoneResponse` raw. Card shows `{support_ratio×100}%`. Opt-in heatmap = new pure `src/lib/support-scale.ts` bucketing/colour-scale. ⚠ Fixture is all-1.0 — test bucketing on synthetic inputs. |

## Standard Stack

This phase introduces **no new dependencies.** The entire stack is already installed and pinned in `package.json` per CLAUDE.md. Phase 6 consumes the locked quartet exactly.

### Core (already installed — verify only)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | `19.2.7` | UI runtime | `[CITED: CLAUDE.md]` — r3f 9 peer cap `<19.3`. |
| @react-three/fiber | `9.6.1` | Declarative three renderer | `[CITED: CLAUDE.md]` — the scene + CoG marker + heatmap recolour are r3f JSX. |
| @react-three/drei | `10.7.7` | r3f helpers (`<Edges>`, `<OrbitControls>`, optionally `<Line>`/`<Sphere>` for CoG) | `[CITED: CLAUDE.md]` — drei `<Line>` is the idiomatic CoG drop-line; `<Sphere>` a marker convenience. |
| three | `0.184.0` (exact) | 3D engine | `[CITED: CLAUDE.md]` — pin exact; `Color`, `Vector3` used in viewer. |
| @tanstack/react-query | `5.101.0` | Server-state cache (the `done` carrier) | `[VERIFIED: codebase]` — `queryClient.getQueryData(['job', jobId])` reads the settled job. |
| react-router | `7.16.0` | Routing + nav state (the `idToType` carrier) | `[VERIFIED: codebase]` — `useNavigate(..., { state })` / `useLocation().state`, already the Configure→Loading pattern. |
| tailwindcss + @tailwindcss/vite | `4.3.0` | Rail styling via `@theme` | `[CITED: CLAUDE.md]` — CSS-first; port only `--color-pos` + `--color-warn` (UI-SPEC). |
| clsx | `2.1.1` | Conditional classes (selected/highlighted rows) | `[VERIFIED: codebase]` — already used in `ViewerOverlay.tsx`. |

### Supporting (testing — already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @testing-library/react + jsdom | `4.1.8` / `16.3.2` / `~26` | Pure-lib golden tests + rail DOM/hover-wiring tests | `[CITED: CLAUDE.md]` — never test the WebGL canvas in jsdom. |
| @playwright/test | `1.60.0` | Rendered scene + CoG marker + heatmap via preview build + route interception | `[VERIFIED: codebase]` — `e2e/result-viewer.spec.ts` + `e2e/api-poll.spec.ts` already establish the pattern. |

### Alternatives Considered (carrier — the one real decision)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nav state `{ jobId, idToType }` + cache read | Nav state carrying the **entire `done` payload** | Works, but duplicates the cache (the payload is already in `['job', jobId]` with `gcTime: Infinity`); larger `history.state` (the `done` body is non-trivial). Reading from cache by `jobId` is leaner and keeps a single source of truth. |
| Nav state `{ jobId, idToType }` | A small **in-memory context/store** (e.g. `useRef`/module singleton holding the last result) | Adds a new module + provider for one hop; survives refresh no better than nav state (both lost on hard reload → both correctly trigger the C-02 redirect). Nav state mirrors the *existing* Configure→Loading hand-off pattern (`LoadingNavState`), so it is the lowest-surprise carrier. |
| Reading cache by explicit `jobId` | Scanning the cache for "the latest done job" | Fragile (no guaranteed ordering; multiple jobs could coexist after a Retry). Pass the exact `jobId` so the read is deterministic. |

**Installation:** none — `npm ci` against the existing lockfile.

**Version verification:** Versions are locked in `CLAUDE.md` (verified 2026-06-03 against the npm registry) and pinned in the repo lockfile. No registry re-query needed; no new package is added this phase. `[CITED: CLAUDE.md]`

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All libraries used are already present in the repository lockfile and were legitimacy-audited in prior phases (see `CLAUDE.md` Sources, "npm registry (live, 2026-06-03)"). No new dependency, no `npm install`, so the slopcheck/registry gate has nothing to evaluate this phase.

## Architecture Patterns

### System Architecture Diagram

```
  ConfigurePage (/)                LoadingPage (/loading, eager, three-free)
       │  Run                            │
       │  navigate('/loading',           │  useSubmitJob → job_id
       │    { state:{request,idToType}}) │  usePollJob(job_id) ── poll ──▶ GET /jobs/{id}
       └────────────────────────────────▶│         │ status:'done'
                                          │         ▼
                                          │   queryClient cache ['job', jobId] = done payload
                                          │         │  (gcTime: Infinity)
                                          │  navigate('/result',
                                          │    { replace, state:{ jobId, idToType } })   ◀── CARRIER (new)
                                          ▼
                       ResultPage (/result, LAZY three-only chunk)
                                          │
              ┌───────────────────────────┴───────────────────────────┐
              │ 1. read state.{jobId,idToType}; if no jobId → redirect '/'│  (C-02)
              │ 2. done = queryClient.getQueryData(['job', jobId])       │
              │    if no done in cache → redirect '/'                    │
              │ 3. view = mapDoneResponse(done, idToType)  [src/lib]     │
              └───────────────────────────┬───────────────────────────┘
                                          │  ResultView { summary, pallets[], byType, unpacked }
                  ┌───────────────────────┼───────────────────────────────┐
                  ▼ whole-job             ▼ selectedPalletIndex (state)    ▼ whole-job
         ┌──────────────────┐   ┌───────────────────────────┐   ┌──────────────────┐
         │ Summary rail     │   │ <Canvas> (persistent)      │   │ Unpacked rail    │
         │ (RESULT-03)      │   │  Pallet(selected.dims)     │   │ (RESULT-06)      │
         │ Σ weight, util…  │   │  Boxes(selected, palette,  │   │ id/type/dims/    │
         └──────────────────┘   │        hoveredId, heatmap) │   │ weight/reason    │
                                │  CoG marker (DIAG-01)      │   └──────────────────┘
         ┌──────────────────┐   │  ViewerOverlay sub-line    │
         │ Pallet switcher  │──▶│   (computed, per-pallet)   │   ┌──────────────────┐
         │ (RESULT-04)      │   └───────────┬───────────────┘   │ Placement rail   │
         │ sets selectedIdx │               │ hover row→mesh    │ (RESULT-05)      │
         └──────────────────┘               └──────────────────▶│ sets hoveredId   │
                                                                 └──────────────────┘
```

Data flow: a real `done` payload enters via the cache, is shaped once by `mapDoneResponse`, then fans out to whole-job rail blocks (Summary, Unpacked) and per-selected-pallet consumers (Canvas, overlay sub-line, Placement). Two pieces of `ResultPage` state — `selectedPalletIndex` and `hoveredId` — drive the interactivity.

### Recommended Project Structure
```
src/
├── lib/
│   ├── result-summary.ts      # NEW pure: whole-job summary + per-pallet stats (three-free)
│   ├── cog-map.ts             # NEW pure: cog POINT → three-space point (golden-tested)
│   ├── support-scale.ts       # NEW pure: support_ratio → bucket + colour scale (three-free)
│   ├── result-mapper.ts       # EXISTING: mapDoneResponse → ResultView (consume as-is)
│   ├── mapping.ts             # EXISTING: mapPlacement / typeKeyOf (reuse conventions)
│   └── palette.ts             # EXISTING: colorForType (shared legend/swatch/tint)
├── routes/
│   └── ResultPage.tsx         # REWORK: read cache+idToType, selected-pallet state, rail, redirect
├── components/
│   ├── viewer/
│   │   ├── Boxes.tsx          # EXTEND: hoveredId emissive prop + heatmap colour mode
│   │   ├── Pallet.tsx         # UNCHANGED
│   │   ├── CameraPresets.tsx  # UNCHANGED (preserve camera on switch — D-02)
│   │   ├── ViewerOverlay.tsx  # EXTEND: computed sub-line + CoG/heatmap toggles
│   │   └── CogMarker.tsx      # NEW: sphere + drop-line at mapped cog (lazy chunk)
│   └── result/                # NEW rail blocks (plain DOM, inside lazy subtree)
│       ├── SummaryBlock.tsx
│       ├── PalletSwitcher.tsx
│       ├── PlacementList.tsx
│       └── UnpackedPanel.tsx
```

### Pattern 1: The carrier — read `done` from cache, `idToType` from nav state
**What:** `/result` needs two things: the `done` payload (in the query cache) and `idToType` (only in memory at submit time).
**When to use:** On `ResultPage` mount.
**Example:**
```tsx
// Source: derived from src/api/usePollJob.ts (queryKey ['job', jobId], gcTime:Infinity)
//         + src/routes/LoadingPage.tsx (existing nav-state hand-off pattern)
// LoadingPage — on done (replaces the current stateless navigate):
useEffect(() => {
  if (!cancelled && status === 'done' && jobId) {
    navigate('/result', { replace: true, state: { jobId, idToType } });
  }
}, [cancelled, status, jobId, idToType, navigate]);

// ResultPage — read both, validate, redirect on absence (C-02):
const navState = useLocation().state as { jobId?: string; idToType?: Map<string,string> } | null;
const jobId = navState?.jobId;
const done = jobId
  ? queryClient.getQueryData<JobState>(['job', jobId])   // JobState is the done body
  : undefined;

useEffect(() => {
  if (!done || done.status !== 'done') navigate('/', { replace: true });
}, [done, navigate]);
if (!done || done.status !== 'done') return null;

const view = useMemo(() => mapDoneResponse(done as DoneResponse, navState?.idToType), [done]);
```
**Note on `getQueryData` vs `useQuery`:** a one-shot `getQueryData` read is correct here — the job has already settled (terminal) and `gcTime: Infinity` keeps it resident; there is nothing to re-fetch on `/result`. Import `queryClient` from `@/api/queryClient` (the production singleton). If a reactive read is preferred, `useQuery({ queryKey:['job',jobId], enabled:false })` reads cache without fetching — but `getQueryData` is simpler and sufficient.

### Pattern 2: CoG point-map (DIAG-01) — up-axis is `cog.z` (EMPIRICALLY CONFIRMED)
**What:** `cog` is a centre POINT, not a placement; `mapPlacement` (min-corner + half-dim) does not apply. The point-map reuses the **recentre + deckTop** transform but **without** the half-dimension term (a CoG is already a centre).
**Verification (this session):** Reconstructed the weight-weighted centroid of every box centre in API space and matched it to the reported `cog` **exactly** for both pallets:
```
P001  weighted-centroid (API x,y,z) = 491.597, 368.697, 497.059   cog = {491.597, 368.697, 497.059}  ✓
P002  weighted-centroid (API x,y,z) = 382.609, 339.130, 382.609   cog = {382.609, 339.13,  382.609}  ✓
```
Therefore **`cog.x` = API length, `cog.y` = API width, `cog.z` = API height (UP)** — identical axis convention to `position`. `[VERIFIED: codebase fixture src/lib/__fixtures__/pack-done-response.json]`
**Transform (mirror `mapping.ts` `mapPlacement`, drop the `+L/2`/`+H/2`/`+W/2` half-dims):**
```ts
// Source: src/lib/mapping.ts mapPlacement center[] formulae, adapted for a centre point.
// DECK_TOP_Y = 100 (must stay in sync with mapping.ts — import/share the constant).
export function mapCog(cog: Cog, pallet: Pick<PalletDims,'L'|'W'>): [number, number, number] {
  return [
    cog.x - pallet.L / 2,   // x: recentre on origin (API length → three x)
    DECK_TOP_Y + cog.z,     // y (up): deck top + API height (cog.z is UP, no half-dim)
    cog.y - pallet.W / 2,   // z: API width → three z, recentred
  ];
}
```
The drop-line goes from `[x, DECK_TOP_Y, z]` (on the deck) up to the mapped CoG point. Golden test asserts both pallets' mapped CoG against hand-computed literals.
**Warning:** Do **not** route `cog` through `mapPlacement` — it would add spurious `L/2`/`H/2` offsets. Keep `DECK_TOP_Y` shared (export it from `mapping.ts`) so the marker and the boxes use one deck height.

### Pattern 3: Selected-pallet swap on one persistent Canvas (D-01/D-02)
**What:** A single `<Canvas>` for the whole screen; `selectedPalletIndex` selects which `MappedPallet` feeds `Boxes`/`Pallet`. Switching never remounts the Canvas.
**Example:**
```tsx
const [sel, setSel] = useState(0);                      // default index 0 (D-05)
const pallet = view.pallets[sel];                       // MappedPallet
// ... inside <Canvas>:  <Pallet length={dims.L} width={dims.W} />
//                       <Boxes pallet={asPalletResult(pallet)} palette={palette} hoveredId={hoveredId} />
```
**Camera (D-02):** `CameraPresets` only re-frames on explicit preset press (`presetNonce` bump). Because the boxes group bbox is measured in a `useEffect` keyed on `boxesRef`/`onBbox` (see `CameraPresets.tsx`), a pallet swap that changes box content **will re-measure the bbox** but will **not** re-trigger the preset animation (no `presetNonce` change). This preserves the user's orbit/zoom — matching D-02. ⚠ Planner note: confirm in the e2e that switching pallets does not snap the camera; if the bbox effect causes an unwanted re-frame, gate the `onBbox`-driven re-frame so it fires only on explicit preset press.

### Pattern 4: Adapting `MappedPallet` → `Boxes`' `PalletResult` prop
**What:** `Boxes` currently takes a `PalletResult` (`{ dimensions, items }`). `MappedPallet` has `items` and `palletId`/`utilisation`/`cog`/`totalWeight` but **no `dimensions`** (the mapper drops pallet dims; all pallets share one footprint).
**Resolution:** `MappedPallet.items` are `PlacementOut & {typeId}` — structurally a superset of what `Boxes` reads (`item_id`/`position`/`dimensions`). Pass pallet `dimensions` separately (they are identical across pallets — both P001/P002 are `1000×800×1000` in the fixture; source the footprint from the request's pallet config, which Configure already holds, or carry it through). Cleanest: extend `Boxes`' prop to take `items` + `dimensions` explicitly rather than the full `PalletResult`, decoupling it from the mapper-vs-contract shape mismatch. Verify against `src/types/pack-contract.ts` `PalletResult` (has `dimensions`) vs `result-mapper.ts` `MappedPallet` (no `dimensions`).

### Pattern 5: One-way row→mesh emissive hover (D-11)
**What:** Hovering a placement row sets `hoveredId` in `ResultPage`; `Boxes` reads it and applies emissive to the matching mesh **declaratively** (no remount, no imperative material mutation).
**Example:**
```tsx
// Source: react-three-fiber declarative material props (docs.pmnd.rs/react-three-fiber)
// In Boxes.tsx, per mesh:
<meshStandardMaterial
  color={b.color}
  emissive={b.color}
  emissiveIntensity={hoveredId === b.id ? 0.45 : 0}
  roughness={0.62} metalness={0.04}
/>
```
r3f diffs the `emissiveIntensity` prop and patches the live material in place — exactly the idiomatic pattern (state-driven material props). No `material.emissive.set(...)` imperative call, no ref needed. The card gets the `--accent` border/bg "hi" state in parallel.
**Hover-wiring test (jsdom):** mounting `Boxes` is WebGL — do NOT test the emissive pixel in jsdom. Instead unit-test the **pure mapping** (`hoveredId` → which mesh id matches) and verify the **DOM** half (placement card `onMouseEnter`/`Leave` sets state) with Testing Library; verify the actual emissive glow in Playwright.

### Pattern 6: Support-ratio heatmap (DIAG-02) — pure scale, toggled colour mode
**What:** Default box colour is by-type (`colorForType`). An opt-in toggle recolours boxes by a pure support-ratio scale; the legend swaps to the support key. The per-card `support N%` is always shown regardless of toggle.
**Example:**
```ts
// Source: new src/lib/support-scale.ts (three-free, jsdom-tested)
// Perceptually-ordered, colour-blind-considerate (not pure red/green; paired with numeric %).
export function supportColor(ratio: number): string { /* bucket → hex on an ordered scale */ }
```
```tsx
// Boxes.tsx chooses the colour by mode:
const color = heatmap ? supportColor(item.support_ratio) : palette.get(typeKey);
```
⚠ **Test-design constraint (critical):** every `support_ratio` in the captured fixture is exactly **`1.0`** — so the captured corpus exercises only the top bucket. The bucketing/scale golden test MUST use **hand-built synthetic ratios** (e.g. `[1.0, 0.8, 0.5, 0.2, 0]`) to assert distinct buckets/colours. The fixture can only assert "all boxes map to the well-supported colour." `[VERIFIED: codebase fixture — all 31 support_ratio === 1]`

### Anti-Patterns to Avoid
- **Re-applying `orientation.perm` to geometry.** It is already baked into `dimensions` (C-01). `mapPlacement` never reads it; new code must not either.
- **Routing `cog` through `mapPlacement`.** It adds half-dimension offsets meant for min-corners; CoG is already a centre (Pattern 2).
- **Importing `three` into any new `src/lib/` module.** Breaks the code-split gate (`scripts/check-code-split.mjs`). Type-only imports are fine.
- **Carrying the whole `done` payload in nav state.** Duplicates the cache; bloats `history.state`. Carry `jobId` and read the cache.
- **Imperative `material.emissive.set()` on hover.** Use the declarative `emissiveIntensity` prop; r3f patches in place.
- **Switching to InstancedMesh.** Unneeded (max 19 boxes) and it breaks per-box emissive hover (D-12).
- **Designing a "no data" screen.** There is none — no-result is a **redirect to `/`** (C-02 / UI-SPEC).
- **Amber low-fill warn on switcher rows.** Dropped (D-04). `--warn` is ported for parity but unused on rows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persisting/reading the `done` result | A bespoke result store / localStorage write | The existing react-query cache (`['job', jobId]`, `gcTime: Infinity`) | Already implemented + tested in Phase 5; C-02 mandates ephemeral in-memory. |
| Passing `idToType` between routes | A global singleton / context provider for one hop | react-router nav `state` (mirrors the existing `LoadingNavState` pattern) | Lowest-surprise; same mechanism Configure→Loading already uses. |
| Type recovery | New id-parsing logic | `mapDoneResponse(done, idToType)` (map-primary / `typeKeyOf` fallback) | Built + golden-tested (`result-mapper.test.ts`). |
| Coordinate transform for boxes | New min-corner math | `mapPlacement` | Locked, golden-tested incl. the rotated case. |
| Per-type colours | New palette | `colorForType` | Deterministic, shared across legend/swatch/tint/box. |
| Camera framing / orbit | New OrbitControls wiring | `CameraPresets` (unchanged) | Built; preserves view on switch (D-02). |
| Edge lines on boxes | Manual wireframe geometry | drei `<Edges>` (already in `Boxes.tsx`) | Already wired. |
| CoG drop-line | Manual `BufferGeometry` line | drei `<Line>` (lazy chunk) | Idiomatic, lightweight; type-safe points. |
| Submit→poll→done lifecycle | Anything | `useSubmitJob` + `usePollJob` | Done in Phase 5. Phase 6 only **reads** the settled result. |

**Key insight:** Phase 6 is ~90% wiring of existing, tested seams. The only genuinely new logic is three small pure functions (summary aggregation, CoG point-map, support scale) plus DOM rail components and two r3f additions (CoG marker, heatmap colour mode). Treat any urge to re-derive coordinate/type/colour semantics as a red flag.

## Common Pitfalls

### Pitfall 1: The `idToType` map is silently dropped today
**What goes wrong:** `LoadingPage` calls `navigate('/result', { replace: true })` with **no state**, and `ResultPage` hard-imports the fixture. If you wire only the cache read and forget `idToType`, type recovery silently falls back to `typeKeyOf` everywhere — which happens to work for the fixture (ids are `T###`/`D###`/`F###`) but will mislabel any real ids whose prefix ≠ the user's type key.
**Why it happens:** Two separate carriers (cache for payload, nav state for `idToType`) and the current code passes neither.
**How to avoid:** Add `idToType` (and `jobId`) to the `done` navigation state (Pattern 1). `mapDoneResponse` already accepts the optional map; the fallback keeps it coherent if absent.
**Warning signs:** Legend keys look right for the fixture but the planner/test never asserts the **map-primary** path — only the parse fallback. Add a test that passes a non-trivial `idToType` and asserts recovery differs from `typeKeyOf`.

### Pitfall 2: `JobState`/`done` shape vs `DoneResponse`
**What goes wrong:** The cache holds a `JobState` (the zod-parsed `GET /jobs/{id}` body); `mapDoneResponse` expects a `DoneResponse` (`{ job_id, status, result }`). If the cached `done` job state's shape differs (e.g. nests `result` differently), the mapper reads `done.result.pallets` off the wrong field.
**Why it happens:** Two contract types (`pack-schema.ts` `JobState` vs `pack-contract.ts` `DoneResponse`) describe the same wire body.
**How to avoid:** Read `src/api/pack-schema.ts` and confirm the `done` `JobState` variant's `result` field matches `DoneResult` exactly before casting. The e2e (`api-poll.spec.ts`) fulfills `done` with `{ status:'done', result: packDoneResponse.result }` — so the `result` field IS the `DoneResult`. Verify the top-level (`job_id`/`status` presence) so `mapDoneResponse(done as DoneResponse, …)` is sound.
**Warning signs:** `done.result is undefined` at runtime; the redirect guard never fires because `done` exists but is the wrong shape.

### Pitfall 3: A pallet swap accidentally re-frames the camera
**What goes wrong:** `CameraPresets` measures the boxes bbox in a `useEffect` and calls `onBbox`. If a pallet swap triggers that effect and something re-runs the preset animation, the camera snaps — violating D-02.
**Why it happens:** The bbox effect re-runs when the group content changes; if the preset effect is keyed (directly or transitively) on `bbox`, it animates on swap.
**How to avoid:** Confirm the preset animation effect re-runs **only** on `preset`/`presetNonce` change (it currently lists `bbox` in its deps — `[preset, presetNonce, bbox, camera]`). ⚠ This means a bbox change from a pallet swap **could** re-trigger the animation toward the current preset. Planner must verify and, if needed, decouple the swap from `presetNonce` so the camera stays put. Cover with an e2e: switch pallets, assert `window.__cameraState.position` is unchanged.
**Warning signs:** Camera jumps on every switcher click.

### Pitfall 4: Heatmap "tested" against an all-1.0 fixture
**What goes wrong:** The support-scale test passes trivially because every fixture `support_ratio` is `1.0`, giving false confidence that bucketing works.
**Why it happens:** The captured solver result happens to have perfect support everywhere.
**How to avoid:** Golden-test `support-scale.ts` on **synthetic** ratios spanning `[0,1]`; only smoke-assert the fixture maps all boxes to the top bucket. `[VERIFIED: codebase fixture]`
**Warning signs:** The scale test has no input below 1.0.

### Pitfall 5: Legend instability when palette is built from one pallet
**What goes wrong:** If the heatmap-off legend is rebuilt from only the selected pallet's types, swapping pallets changes the legend.
**Why it happens:** Per-pallet type sets differ.
**How to avoid:** Build the palette from the **whole result** (`buildPalette(done)` already does this — all pallets + unpacked). Keep that one stable palette across switches (matches the existing `ResultPage` `useMemo`).
**Warning signs:** Legend swatches appear/disappear on switch.

## Runtime State Inventory

This is **not** a rename/refactor/migration phase — it adds features and wires existing seams. No stored data keys, OS-registered state, secrets, or build artifacts carry a string being renamed.

- **Stored data:** None — the result is read from the in-memory react-query cache; nothing is persisted (C-02). The only persisted state is the Configure draft in localStorage (untouched by this phase). Verified by reading `usePollJob.ts` (`gcTime: Infinity`, in-memory) and `config-persist.ts` existence.
- **Live service config:** None — no external service config.
- **OS-registered state:** None.
- **Secrets/env vars:** None changed. `VITE_API_URL` is referenced but not modified (Phase 7).
- **Build artifacts:** None renamed. New files are added; `dist/` is regenerated by the build as usual.

## Code Examples

### Whole-job summary aggregation (RESULT-03, pure)
```ts
// Source: new src/lib/result-summary.ts — pattern mirrors src/lib/config-tally.ts (pure, three-free)
import type { ResultView } from './result-mapper';
export interface JobSummary {
  palletsUsed: number; maxPallets?: number;
  utilisationPct: number;        // total_volume_utilisation × 100, 1 decimal
  unpacked: number; totalItems: number;
  totalWeightKg: number;         // Σ pallets[].totalWeight
}
export function summarise(view: ResultView, maxPallets?: number): JobSummary {
  const s = view.summary;
  return {
    palletsUsed: s.pallets_used, maxPallets,
    utilisationPct: s.total_volume_utilisation * 100,
    unpacked: s.items_unpacked, totalItems: s.items_packed + s.items_unpacked,
    totalWeightKg: view.pallets.reduce((kg, p) => kg + p.totalWeight, 0),
  };
}
// Golden (fixture): palletsUsed 2, util 72.81%, unpacked 7 / 38, totalWeight 211 kg.
```

### CoG marker component (DIAG-01, lazy chunk)
```tsx
// Source: new src/components/viewer/CogMarker.tsx — uses mapCog (Pattern 2) + drei <Line>
import { Line } from '@react-three/drei';
import { mapCog, DECK_TOP_Y } from '@/lib/cog-map';   // DECK_TOP_Y shared from mapping.ts
export function CogMarker({ cog, palletL, palletW }: { cog: Cog; palletL: number; palletW: number }) {
  const [x, y, z] = mapCog(cog, { L: palletL, W: palletW });
  return (
    <group>
      <mesh position={[x, y, z]}><sphereGeometry args={[14, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} /></mesh>
      <Line points={[[x, DECK_TOP_Y, z], [x, y, z]]} color="#fff" lineWidth={1} dashed />
    </group>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ResultPage` imports committed fixture JSON | Read real `done` from react-query cache by `jobId` | This phase (C-02) | The viewer becomes the real result; fixture stays as the test corpus only. |
| Stateless `navigate('/result')` | `navigate('/result', { state:{ jobId, idToType } })` | This phase (C-03) | `idToType` reaches the mapper; map-primary recovery works. |
| Imperative `material.emissive` on hover (mockup) | Declarative `emissiveIntensity` prop driven by state | r3f 9 idiom | No ref/mutation; r3f patches material in place. |

**Deprecated/outdated:**
- The mockup's `setMeshVisibility` (toggling all pallets' meshes) → replaced by selected-pallet-only rendering (D-01).
- The mockup's hardcoded `A/B/C` pallet labels → API `pallet_id` with "Pallet N" fallback (D-05).
- The mockup's `Solved in 1.84s` pill + Export button → omitted (D-07).
- The mockup's `box-centre` placement-note label → corrected to `box min-corner` (UI-SPEC; C-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cached `done` `JobState` `result` field is structurally `DoneResult`, so `mapDoneResponse(done as DoneResponse, …)` is sound. | Pitfall 2 | If `JobState` nests `result` differently, the mapper reads undefined. **Mitigation: planner must read `src/api/pack-schema.ts` and confirm before casting.** The e2e fulfilling `{status:'done', result: packDoneResponse.result}` strongly suggests it matches, but the top-level `job_id`/`status` shape is unconfirmed. |
| A2 | Pallet footprint dims are identical across all generated pallets (both fixture pallets are 1000×800×1000). | Pattern 4 | If the API ever returns differing pallet dims per pallet, sourcing one footprint is wrong. **Mitigation: source dims per-selected-pallet from `PalletResult.dimensions` (which the cache `done` carries) rather than the request config, even though the mapper drops them.** |
| A3 | `CameraPresets`' bbox effect will not snap the camera on a pallet swap. | Pitfall 3 | If it does, D-02 is violated. **Mitigation: planner verifies + adds an e2e camera-position assertion across a switch.** |
| A4 | drei `<Line>` (v10) is the right CoG drop-line primitive on three 0.184. | Code Examples | If `<Line>` API changed, a plain `<line>`+`BufferGeometry` works. Low risk; drei `<Line>` is stable. `[ASSUMED]` |

## Open Questions

1. **Does the cached `done` `JobState` match `DoneResponse` at the top level?**
   - What we know: the `result` field IS `DoneResult` (e2e fulfills it that way); `usePollJob` caches the zod-parsed `JobState` under `['job', jobId]`.
   - What's unclear: whether `JobState.status === 'done'` variant carries `job_id` + nests `result` exactly like `DoneResponse`.
   - Recommendation: planner reads `src/api/pack-schema.ts` `jobStateSchema`/`JobState` first; adapt the cast/access accordingly (may need `done.result` directly rather than `done as DoneResponse`).

2. **Default state of the CoG / heatmap toggles (ON vs OFF)?**
   - What we know: heatmap default is OFF (D-10, by-type is default). CoG default is planner's call (D-10 / UI-SPEC).
   - Recommendation: CoG default ON (it's the differentiator and low-clutter at one marker); heatmap default OFF.

3. **Where does the per-selected-pallet footprint come from for `Pallet`/`Boxes`?**
   - What we know: `MappedPallet` drops `dimensions`; `PalletResult` (in the cached `done`) keeps them.
   - Recommendation: read `done.result.pallets[sel].dimensions` directly for the selected pallet rather than relying on `MappedPallet` (A2).

## Environment Availability

This phase is code/config-only (no new external tools or services). The required toolchain (node, npm, vite, vitest, playwright) is already the project's established dev environment and was exercised by prior phases' tests and the existing `e2e/` suite. No new runtime dependency, database, or CLI is introduced.

- **Missing dependencies with no fallback:** none.
- **Missing dependencies with fallback:** none.

## Validation Architecture

`nyquist_validation` is enabled. Reference dataset: the real `src/lib/__fixtures__/pack-done-response.json` (job_id `ead54451…`; 2 pallets P001/P002; 31 packed, 7 unpacked; types D=11/T=12/F=8; 11/31 rotated; all `support_ratio` = 1.0).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.8` (jsdom) for pure-lib + DOM; Playwright `1.60.0` (preview build + route interception) for rendered scene |
| Config file | `vitest` config in Vite config (shared); `playwright.config.ts` (webServer = `build && preview`) |
| Quick run command | `npx vitest run src/lib/<module>.test.ts` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESULT-03 | Whole-job summary (Σ weight 211 kg, util 72.81%, 2 pallets, 7/38 unpacked) | unit (jsdom, golden) | `npx vitest run src/lib/result-summary.test.ts` | ❌ Wave 0 |
| RESULT-04 | Switcher selects pallet; per-pallet stats; boxes swap | unit (DOM, RTL) + e2e (canvas changes) | `npx vitest run src/components/result/PalletSwitcher.test.tsx` + `npx playwright test e2e/result-viewer.spec.ts` | ❌ Wave 0 (unit) / ✅ e2e file exists |
| RESULT-05 | Placement list fields + hover sets `hoveredId` | unit (DOM, RTL) + e2e (emissive glow) | `npx vitest run src/components/result/PlacementList.test.tsx` | ❌ Wave 0 |
| RESULT-06 | Unpacked panel conditional + reasons; "All packed ✓" when empty | unit (DOM, RTL) | `npx vitest run src/components/result/UnpackedPanel.test.tsx` | ❌ Wave 0 |
| DIAG-01 | CoG point-map (up-axis = z); marker renders | unit (jsdom, golden) + e2e (marker visible) | `npx vitest run src/lib/cog-map.test.ts` | ❌ Wave 0 |
| DIAG-02 | `support N%` on each card; heatmap bucketing on synthetic ratios | unit (jsdom, golden) + e2e (recolour) | `npx vitest run src/lib/support-scale.test.ts` | ❌ Wave 0 |
| Carrier (C-02/C-03) | No-result → redirect `/`; idToType reaches mapper | unit (RTL, mocked router+cache) + e2e (full Configure→Run→Result) | `npx vitest run src/routes/ResultPage.test.tsx` + `npx playwright test e2e/api-poll.spec.ts` | ❌ Wave 0 (unit) / ✅ e2e file exists |
| Code-split (C-04) | three stays out of entry chunk | build gate | `npm run build && node scripts/check-code-split.mjs` | ✅ exists |

**Riskiest derivations — explicit coverage:**
- **CoG point-map:** pure `src/lib/cog-map.ts` **golden** test asserting both fixture pallets' mapped CoG against hand-computed literals derived from the confirmed `cog.z`=up convention (jsdom).
- **Support bucketing:** pure `src/lib/support-scale.ts` golden test on **synthetic** ratios `[1.0, 0.8, 0.5, 0.2, 0]` (the fixture is all-1.0 — jsdom).
- **Summary aggregation:** pure `src/lib/result-summary.ts` golden test against fixture totals (jsdom).
- **Hover wiring:** DOM half (card `onMouseEnter`/`Leave` → state) via RTL (jsdom); emissive glow via Playwright (the WebGL half is never jsdom-tested).

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/<touched>.test.ts` (the relevant pure module).
- **Per wave merge:** `npx vitest run` (full unit suite).
- **Phase gate:** `npx vitest run && npx playwright test && npm run build && node scripts/check-code-split.mjs` all green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/result-summary.test.ts` — covers RESULT-03
- [ ] `src/lib/cog-map.test.ts` — covers DIAG-01 (golden, up-axis=z)
- [ ] `src/lib/support-scale.test.ts` — covers DIAG-02 (synthetic ratios)
- [ ] `src/routes/ResultPage.test.tsx` — covers carrier/redirect (mock router + queryClient cache)
- [ ] `src/components/result/{PalletSwitcher,PlacementList,UnpackedPanel}.test.tsx` — RESULT-04/05/06 DOM
- [ ] Extend `e2e/result-viewer.spec.ts` (or `e2e/api-poll.spec.ts`) for: pallet-switch (camera unchanged), CoG marker visible, heatmap toggle recolour, hover→emissive
- Framework: already installed — no install step needed.

## Security Domain

`security_enforcement` is enabled (ASVS level 1). This is a stateless client reading already-validated in-memory data; the network boundary (zod parsing of API responses) is owned by Phase 5 and not re-opened here.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth — no login/accounts (PROJECT.md). |
| V3 Session Management | no | No sessions; result is ephemeral in-memory. |
| V4 Access Control | no | No protected resources; single-user client tool. |
| V5 Input Validation / Output Encoding | yes | The `done` payload + `reason`/`item_id` strings are rendered as **text** (React escapes by default). The unpacked `reason` and ids must be rendered as plain text (never `dangerouslySetInnerHTML`) — they originate from the (untrusted) API. Mirrors the Phase-5 ErrorCard "escaped text" rule (T-5-10). |
| V6 Cryptography | no | No crypto in this phase. |

### Known Threat Patterns for {React SPA rendering API-sourced strings}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via API-sourced `reason`/`item_id`/`pallet_id` rendered into the rail | Tampering / Information Disclosure | Render as React text children only (auto-escaped); never `dangerouslySetInnerHTML`; no `innerHTML`. |
| Malformed/oversized cached `done` causing render crash | Denial of Service | The redirect-on-absent guard (C-02) + the Phase-5 zod parse at the network boundary bound the shape; `ResultPage` should guard `done.status === 'done'` before mapping. |
| `history.state` tampering (crafted `jobId`/`idToType`) | Tampering | `getQueryData(['job', jobId])` returns `undefined` for an unknown id → redirect `/`. Validate `idToType instanceof Map` before use (mirror `isLoadingNavState` in `LoadingPage.tsx`); fall back to `typeKeyOf` if absent/invalid. |

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: codebase]` `src/lib/__fixtures__/pack-done-response.json` — empirically resolved: CoG up-axis = `cog.z` (weighted-centroid match), max pallet = 19 boxes, all `support_ratio` = 1.0, 2 pallets, 7 unpacked, types D/T/F, 11/31 rotated.
- `[VERIFIED: codebase]` `src/lib/result-mapper.ts`, `src/lib/mapping.ts`, `src/lib/palette.ts`, `src/types/pack-contract.ts` — `ResultView`/`MappedPallet` shapes, `mapPlacement` formulae + `DECK_TOP_Y=100`, `colorForType`, contract types.
- `[VERIFIED: codebase]` `src/routes/ResultPage.tsx`, `src/routes/LoadingPage.tsx`, `src/router.tsx`, `src/api/usePollJob.ts`, `src/api/queryClient.ts` — the carrier seam: stateless `navigate('/result')`, cache key `['job', jobId]` + `gcTime: Infinity`, lazy `/result` route.
- `[VERIFIED: codebase]` `src/components/viewer/{Boxes,ViewerOverlay,CameraPresets,Pallet}.tsx` — reuse surfaces, `buildPalette`, preset/bbox effect deps, `__cameraState` e2e hook.
- `[VERIFIED: codebase]` `e2e/result-viewer.spec.ts`, `e2e/api-poll.spec.ts`, `scripts/check-code-split.mjs`, `.planning/config.json` — established Playwright route-interception + preview-build pattern, code-split gate, nyquist enabled.
- `[CITED: CLAUDE.md]` — locked version quartet, code-split rule, testing split, Tailwind v4 `@theme`.
- `[CITED: .planning/phases/06-result-page-3d-wiring/06-CONTEXT.md + 06-UI-SPEC.md]` — locked decisions, UI contract.

### Secondary (MEDIUM confidence)
- `[CITED: docs.pmnd.rs/react-three-fiber]` — declarative material-prop pattern for state-driven emissive (no imperative mutation). Cross-confirmed by the existing declarative-material usage in `Boxes.tsx`.

### Tertiary (LOW confidence)
- drei `<Line>` v10 API for the CoG drop-line — `[ASSUMED]`; plain `<line>`+`BufferGeometry` is the fallback if the helper API differs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; versions locked in CLAUDE.md + lockfile.
- Architecture / seams: HIGH — grounded in the actual source of every referenced module.
- CoG axis convention: HIGH — empirically proven against both fixture pallets this session.
- InstancedMesh / box counts: HIGH — counted from the real fixture (19 / 12).
- Support heatmap test design: HIGH — fixture all-1.0 confirmed; synthetic-input requirement documented.
- Cached `done` top-level shape vs `DoneResponse`: MEDIUM — `result` confirmed via e2e; top-level needs `pack-schema.ts` confirmation (A1 / Open Q1).
- Pitfalls: HIGH — derived from real code (carrier drop, camera bbox effect deps, all-1.0 support).

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable — internal codebase seams + locked stack; re-verify only if Phase 5 changes the cache key or `JobState` shape).
