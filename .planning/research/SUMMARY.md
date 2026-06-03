# Project Research Summary

**Project:** Palletize
**Domain:** Free, self-hostable stateless React SPA — form-driven pallet-packing config UI + async API polling + react-three-fiber 3D result viewer
**Researched:** 2026-06-03
**Confidence:** HIGH

## Executive Summary

Palletize is a free, no-login, single-Docker-image web tool that wraps an existing asynchronous packing API (`packerapi.anzozulia.xyz`) with a dynamic configuration form and an explorable 3D result viewer. The right architecture is a thin four-layer SPA: pure domain transforms → typed API client + polling → persistent config state → declarative r3f scene. Because the backend is fixed and the client is stateless, every piece of correctness risk lives in one place: the pure function that maps the API's coordinate space into Three.js mesh transforms. All four research streams independently identified this function as the single highest-leverage piece of code in the project.

The recommended approach is a Vertical MVP built strictly inside-out: lock the coordinate-mapping pure function and validate it against a real captured `done` response first; prove it visually with a hard-coded fixture scene second; then add the API client, config form, and result wiring on top of a tested foundation. The version-compatibility quartet (React 19.2.x + r3f 9 + drei 10 + exactly-pinned three 0.184.0) must be established in the scaffolding phase and never auto-upgraded — r3f 9 hard-caps React below 19.3 and three ships breaking changes on minor bumps. The differentiating feature is surfacing centre-of-gravity and per-box support-ratio diagnostics free — data the API already returns that competing paid tools gate behind subscriptions.

The critical unknown that cannot be guessed is the exact semantics of `orientation.perm` and whether the API's `position.z` / `dimensions` are pre- or post-orientation. This must be resolved by capturing one real `done` response from the live API as a fixture, writing golden-value unit tests against it, and only then implementing the mapper. Every other risk (runaway polling, WebGL context leaks, CORS for self-hosters, quantity-expansion explosion) is well-understood and avoidable with standard patterns — coordinate mapping is the only truly novel, project-specific risk.

---

## Key Findings

### Recommended Stack

The stack is driven by a hard peer-dependency constraint: `@react-three/fiber@9` requires `react >=19 <19.3` and `@react-three/drei@10` requires `@react-three/fiber ^9`. There is no flexibility — React 19.2.x is mandatory, and React must be pinned below 19.3 until r3f publishes a wider range. `three` must be pinned exactly (`0.184.0`) because Three.js ships breaking changes on minor bumps. All four packages must be version-locked in the initial scaffolding commit and treated as a single unit when upgrading. All versions were verified live against the npm registry on 2026-06-03.

TanStack Query v5 is the right tool for the async submit-then-poll flow: `useMutation` POSTs `/pack`, then `useQuery` with a function-form `refetchInterval` that returns `false` on terminal status handles the poll lifecycle correctly including abort-on-unmount and strict-mode safety. A hand-rolled `setInterval` + `useEffect` would reimplement this incorrectly. Zustand + `persist` middleware owns the config (input) state in localStorage; TanStack Query's in-memory cache owns the result (server state) — these must never be mixed.

**Core technologies:**
- **React 19.2.7** — UI runtime; only version r3f 9 supports, must stay below 19.3
- **Vite 8 + TypeScript ~6.0** — build tool; native `import.meta.env` for `VITE_API_URL`, built-in dev proxy for CORS-free local development
- **three 0.184.0 (exact pin)** — WebGL engine; minor-bump breaking changes make exact pinning mandatory
- **@react-three/fiber 9.6.1** — declarative React renderer for Three.js; React-19-locked
- **@react-three/drei 10.7.7** — OrbitControls, CameraControls, camera presets; locked to r3f 9
- **@tanstack/react-query 5.101.0** — async job lifecycle (submit + poll); canonical v5 `refetchInterval` pattern
- **react-hook-form 7 + zod 4 + @hookform/resolvers 5** — dynamic box catalog form with zod schema as API contract
- **Zustand + persist middleware** — config state persisted to localStorage with versioned migration
- **nanoid 5** — stable unique box IDs for qty-expansion
- **Tailwind CSS v4 + @tailwindcss/vite** — CSS-first config, maps onto the mockup's CSS-variable design token system
- **react-router 7 (SPA/library mode)** — nginx SPA fallback (`try_files`) is mandatory
- **vitest 4 + @testing-library/react 16 + @playwright/test 1.60** — unit tests for pure transforms; E2E for the full flow
- **Node 22-alpine build + nginxinc/nginx-unprivileged:alpine serve** — multi-stage Docker image, non-root, port 8080

**What NOT to use:** React 18 (forces r3f 8/drei 9 legacy line), `three` with a caret version, hand-rolled polling, CSS-in-JS runtime libraries, CDN-imported three alongside bundled three.

### Expected Features

**Must have (table stakes) — v1:**
- Pallet config (L/W/H, max weight, max overhang)
- Dynamic box catalog (dims, weight, qty, fragile flag, 3-mode rotation: `all`/`this_side_up`/`none` — 6-chip mockup UI must be collapsed)
- Qty → unique-ID expansion before POST
- Async submit → poll → loading state → result
- 3D viewer with orbit/zoom/pan, ISO/TOP/FRONT camera presets, colour-by-type + legend
- Summary stats, multi-pallet switcher, placement list with hover↔mesh highlight
- Unpacked-items panel with reasons — trust feature; must be a first-class panel, not an afterthought
- Stability diagnostics: CoG marker in 3D + per-box support ratio — **the differentiator; data already returned free from the API, paywalled by competitors**
- Export: JSON + printable report (print-CSS)
- Save/reload config to localStorage (versioned schema)
- Graceful failure/timeout/CORS-unreachable handling
- Client-side input validation

**Remove from mockup:** the CoG envelope input field (API accepts no CoG limit; it's output-only per PROJECT.md).

**Should have (v1.x post-validation):** standard pallet presets (EUR/GMA/etc. — strongly consider pulling into v1, near-zero cost), duplicate box type, PNG snapshot, CSV export/import.

**Defer (v2+):** 2D layer view, step-by-step load sequence (needs order inference), share-by-URL (defer until schema is stable), true PDF, user accounts.

**Anti-features:** CoG envelope input, 6-chip rotation UI, manual drag-and-drop placement editor, mm/in toggle.

### Architecture Approach

A thin four-layer SPA with strict one-directional dependencies. The `transform/` module (pure functions, zero React/IO imports) is the testable core. The 3D viewer and form components never touch raw API shapes — they consume `MeshTransform` and `ViewModel` only. Config (input) lives in a Zustand persisted store; job result (server state) lives in TanStack Query's cache; the ViewModel is derived (not stored) via `useMemo`. One persistent `<Canvas>` serves all routes — per-route canvas mounting exhausts WebGL contexts.

**Major components:**
1. `types/` — `api.ts` (wire types) + `domain.ts` (UI domain types); transform layer bridges them
2. `transform/` — pure core: `request-builder.ts`, `result-mapper.ts`, `coordinate-map.ts` (co-located `.test.ts` files mandatory)
3. `api/` — `client.ts` (typed fetch, AbortSignal), `usePackJob.ts` (useMutation + useQuery polling)
4. `config/store.ts` — Zustand + persist, versioned schema with migration
5. `viewer/` — `Scene.tsx`, `Pallet.tsx`, `Boxes.tsx`, `useCameraPresets.ts`; consumes mapper output only
6. `pages/` — `ConfigPage`, `LoadingPage`, `ResultPage`; route-level orchestration
7. `components/` — presentational: BoxTypeCard, PalletForm, SummaryRail, PlacementList, UnpackedPanel

**ID strategy:** encode box type in individual-box IDs (`TYPE#index`). Makes `result-mapper` a pure string-split with zero side state and O(1) result→type lookup via `Map`.

### Critical Pitfalls

1. **Coordinate-system and orientation mapping (THE #1 RISK)** — Three conventions must be reconciled (API: z=up, origin=pallet corner, position=box centre; Three.js: y=up, scene-centred). The mapping is an axis swap PLUS a recentre. The mockup's height formula (`deckTopY + base + h/2`) is a demo cheat — the real API gives `position.z` as the true height centre. The semantics of `orientation.perm` cannot be guessed. Prevention: one pure `toMeshTransform` function, never inline coordinate math in components, golden-value unit tests from a real captured `done` response, dev-mode AABB sanity assertion.

2. **Runaway / leaking polling loops** — The loading mockup uses a fake 6s timeout. Porting it produces a naive `setInterval` that leaks on unmount and never stops. Prevention: TanStack Query `useQuery` with function-form `refetchInterval` returning `false` on terminal status; `signal` from `queryFn`; `queryClient.cancelQueries` on cancel.

3. **CORS failure for self-hosters** — Vite dev proxy hides CORS during development; only surfaces for self-hosters. Prevention: document CORS requirement prominently; distinguish CORS/network failure from job failure in UI; probe `GET /health`; ship nginx reverse-proxy recipe.

4. **WebGL context and resource leaks** — Mounting/unmounting `<Canvas>` per route exhausts WebGL contexts (Safari caps at ~8). Prevention: one persistent canvas; express geometry/material as JSX; dispose imperative resources in `useEffect` cleanup; 20+ mount/unmount stress test.

5. **Quantity expansion explosion** — Large catalogs → huge payloads + thousands of individual meshes → frame-rate collapse. Prevention: live total-unit count in config UI, soft-warn threshold, `InstancedMesh` per type above ~100–200 boxes, stable `TYPE#index` IDs for O(1) type lookup.

---

## Implications for Roadmap

### Recommended Vertical MVP Build Order

| # | Slice | Why this order | Demonstrable end state |
|---|-------|----------------|------------------------|
| 1 | Project Scaffolding + Version Lock | Lock the React 19.2.x / r3f 9 / drei 10 / three 0.184.0 quartet before any code is written | Vite+r3f skeleton builds + serves in Docker; vitest + Playwright wired |
| 2 | Coordinate Mapping + Fixture Viewer **(THE CRITICAL SLICE)** | Highest risk, zero deps. Lock the API↔three contract before anything renders | vitest golden-value tests pass against a real captured `done` fixture; static r3f scene visually matches `design/result.html` |
| 3 | Pure Transform Core + Tests | Pure, deps only on types. Locks qty-expansion and type-regrouping | Round-trip test: config → request → fixture result → ViewModel groups correctly |
| 4 | Config Form + localStorage Persistence | Editable catalog persisted to localStorage; no API needed | Edit boxes, refresh page, config survives; 3-mode rotation UI (not 6 chips); CoG input removed |
| 5 | API Client + Async Polling + Loading Page | Deps on types + request-builder. Wire real submit-then-poll; verify `perm`/`z` ambiguity resolved | Submit real job, poll to `done`, cancel works, all four terminal states handled |
| 6 | Result Page — Full Vertical Wiring | Connects everything: real result → mapper → viewer + rail | Full vertical: configure → run → explore real 3D plan; CoG marker + support tinting |
| 7 | Edge States + Exports + Docker | Hardens for real use and self-hosting | Self-hostable image; graceful failures; JSON/print export; deep-link refresh works |

### Phase Details

**Phase 1 — Scaffolding + Version Lock**
Rationale: Version quartet must be locked before any code is written. A wrong version choice forces a complete dependency audit later.
Avoids: React auto-upgrading past 19.2.x; three loaded from CDN alongside bundled version.
Research flag: Standard patterns — skip research-phase.

**Phase 2 — Coordinate Mapping + Fixture Viewer**
Rationale: This is the only truly novel, project-specific risk. Must be proven against real API data before any UI work depends on it.
First sub-task: capture a real `done` response from `packerapi.anzozulia.xyz` and save it as a fixture. Read `orientation.perm` values directly — do not assume.
Success criteria: golden-value unit tests assert exact `position`/`size` for known items; at least one rotated-box case; dev AABB assertion passes; static viewer visually matches `design/result.html`.
Research flag: **NEEDS deeper research-phase** — `orientation.perm` semantics and `dimensions` pre/post-orientation status are explicit unknowns that must be resolved from a real response.

**Phase 3 — Pure Transform Core**
Delivers: `request-builder.ts` (qty expansion, stable IDs, 3-mode rotation mapping) + `result-mapper.ts` (group by type, per-pallet, CoG/support diagnostics) + full unit tests.
Research flag: Standard patterns — skip research-phase.

**Phase 4 — Config Form + localStorage**
Delivers: Zustand store + persist (versioned schema), ConfigPage, box catalog with `useFieldArray`, pallet form, 3-mode rotation UI, CoG input field removed, live unit count, client-side validation.
Research flag: Standard patterns — skip research-phase.

**Phase 5 — API Client + Polling**
Delivers: `client.ts` (typed fetch, AbortSignal, health probe), `usePackJob.ts` (useMutation + useQuery), LoadingPage with honest indeterminate spinner, all four terminal states, CORS/network error distinguished from job failure.
Research flag: Standard TanStack Query v5 patterns — skip research-phase. CORS verification (built bundle served from a different origin) is an explicit acceptance criterion.

**Phase 6 — Result Page Wiring**
Delivers: ResultPage wiring real PackResult → ViewModel → viewer + SummaryRail + PalletSwitcher + PlacementList + UnpackedPanel; CoG marker; support-ratio tinting; hover↔highlight; single persistent canvas; instancing above ~100–200 boxes.
Research flag: r3f disposal patterns are documented — standard. Instancing threshold must be verified empirically.

**Phase 7 — Edge States + Exports + Docker**
Delivers: Error screens with retry; JSON download; print-CSS report; multi-stage Docker build; nginx SPA fallback; nginx reverse-proxy recipe in docs; VITE_API_URL documented; deep-link refresh verified.
Research flag: Standard patterns — skip research-phase.

### Phase Ordering Rationale

- **Inside-out:** Pure transforms before API before UI — the testable core is proven before anything depends on it.
- **Risk-first:** The coordinate-mapping slice (Phase 2) is the only truly novel risk; it comes before the form and API client so a bug in the math doesn't propagate through half-built features.
- **Fixture-driven:** Capturing a real `done` response in Phase 2 gives every later phase a realistic test anchor.
- **Deferred Docker:** The self-hosting layer wraps a complete product; adding nginx complexity before the app works is wasted iteration.

### Research Flags

**Needs research-phase during planning:**
- **Phase 2 (Coordinate Mapping):** `orientation.perm` semantics (gather vs scatter; pre- vs post-orientation `dimensions`) must be resolved from a real API response. This is a hard blocker for the viewer and the only gap all four research files explicitly flag.

**Standard patterns (skip research-phase):**
- Phase 1 (scaffolding), Phase 3 (pure transforms), Phase 4 (config form), Phase 5 (polling), Phase 6 (result wiring), Phase 7 (Docker/nginx)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified live against npm registry 2026-06-03; peer constraints read from published manifests |
| Features | HIGH | Market analysis (BoxFit, EasyCargo, 3DBinPacking) + direct API contract mapping from PROJECT.md |
| Architecture | HIGH | Coordinate convention read from the working mockup user validated; TanStack Query v5 patterns from Context7 docs |
| Pitfalls | HIGH | Coordinate pitfall from working mockup; r3f disposal from pmndrs GitHub issues; CORS/Docker/polling from established practice |

**Overall confidence:** HIGH

### Gaps to Address

1. **`orientation.perm` semantics** — gather (`out[i] = in[perm[i]]`) vs scatter (`out[perm[i]] = in[i]`)? Are `dimensions` in the result already permuted or in original catalog order? **Resolution:** capture a real `done` response with a non-identity rotation; read raw values; write fixture test. Phase 2, sub-task 1, hard blocker.

2. **`position.z` convention** — box-centre height (as architecture research concludes) or box-corner/deck-relative bottom? If corner, `+ H/2` must be added. **Resolution:** same fixture as above.

3. **CORS allowlist for the public API** — `packerapi.anzozulia.xyz` must allow the production serving origin. The API is author-controlled; configure the allowlist before Phase 7 ships. Phase 7 sub-task.

4. **Instancing threshold** — The ~100–200 box estimate is a starting point; empirical testing in Phase 6 establishes the real threshold. Not a blocker but determines whether `InstancedMesh` is needed for typical real-world catalogs.

---

## Sources

### Primary (HIGH confidence)
- npm registry (live, 2026-06-03) — exact published versions and peer-dependency manifests (see STACK.md for full list)
- `design/result.html` (lines 204–334) — authoritative coordinate convention, geometry order (L,H,W), centre-origin note
- `design/config.html` (lines 263–377) — box catalog model, rotation chips, seed types
- `.planning/PROJECT.md` — async API contract, qty-expansion, 3-mode rotation, CoG output-only, mm/kg, stateless/localStorage, single Docker image
- TanStack Query v5 Polling + Query Cancellation docs (Context7 `/tanstack/query`, 2026-06-03)
- pmndrs/react-three-fiber GitHub issues #2655, #3093, #2457, discussion #723 — disposal scope, one-canvas recommendation, context loss

### Secondary (MEDIUM confidence)
- [BoxFit](https://boxfit.space/) — closest free no-login analog; feature baseline
- [EasyCargo](https://www.easycargo3d.com/) — paid feature superset
- [3DBinPacking](https://www.3dbinpacking.com/) — paid API + frontend; import/export norms

### Tertiary (must validate)
- `orientation.perm` semantics — inferred; MUST be verified against a real API response before Phase 2 implementation
- Instancing threshold (~100–200 boxes) — extrapolated; verify empirically in Phase 6

---
*Research completed: 2026-06-03*
*Ready for roadmap: yes*
