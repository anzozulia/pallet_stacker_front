# Roadmap: Palletize

## Overview

Palletize wraps an existing asynchronous packing API in a free, no-login, single-Docker-image React SPA: a user describes a pallet and a box catalog, the app submits the job, polls to completion, and returns an explorable 3D packing plan with fill rate, weight, centre-of-gravity, and per-box support diagnostics. The build is a risk-first Vertical MVP built strictly inside-out — lock the version quartet and scaffolding, prove the single highest-risk piece (the API↔Three.js coordinate-mapping pure function) against a real captured API response before any UI depends on it, then layer the pure transform core, the persisted config form, the async API client, the full result viewer, and finally the self-hosting/export hardening. Each phase delivers an end-to-end, demonstrable capability where practical; correctness lives in tested pure functions and the API owns all placement math.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffolding & Version Lock** - Lock the React 19.2.x / r3f 9 / drei 10 / three 0.184.0 quartet, wire Vite + TS + Tailwind + test tooling, build/serve a skeleton (completed 2026-06-03)
- [x] **Phase 2: Coordinate Mapping & Fixture Viewer** - Capture a real `done` response, lock the API↔Three.js mapping with golden tests, render a static 3D scene matching the mockup (completed 2026-06-04)
- [x] **Phase 3: Pure Transform Core** - Build and fully unit-test the request-builder (qty expansion + rotation mapping) and result-mapper (grouping + diagnostics) (completed 2026-06-04)
- [x] **Phase 4: Config Form & Local Persistence** - Editable pallet + box catalog form with validation, live unit count, and localStorage that survives refresh (7 plans, waves 1→5) (completed 2026-06-04)
- [x] **Phase 5: API Client & Async Polling** - Typed client, submit-then-poll job lifecycle, loading screen, cancel, and all four terminal states handled (verification found 2 poll safety-cap blockers — CR-01/CR-02 — fixed in gap closure; re-verified 4/4, 2 optional human-UAT items) (completed 2026-06-05)
- [x] **Phase 6: Result Page & 3D Wiring** - Full vertical: real result → mapper → viewer + summary rail, multi-pallet switcher, placement list, unpacked panel, CoG + support diagnostics (completed 2026-06-05)
- [ ] **Phase 7: Edge States, Exports & Self-Hosting** - Graceful failure screens, JSON + printable export, single Docker image with SPA fallback, GitHub docs

## Phase Details

### Phase 1: Scaffolding & Version Lock

**Goal**: A version-locked Vite + React + TypeScript + react-three-fiber project builds, runs in dev, serves from a Docker image, and has unit + E2E test tooling wired — the foundation every later phase depends on.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: (none — foundational scaffolding; no v1 requirement is fully delivered here by design)
**Success Criteria** (what must be TRUE):

1. `npm install` resolves React 19.2.x, @react-three/fiber 9, @react-three/drei 10, and three 0.184.0 (three pinned exactly, no caret), with no peer-dependency conflicts
2. A developer can run `npm run dev` and load a skeleton page that renders an empty react-three-fiber `<Canvas>` without WebGL errors
3. `npm run test` runs a passing Vitest sample and `npm run test:e2e` runs a passing Playwright smoke test
4. The skeleton builds to static assets and serves from a multi-stage Docker image on a non-root nginx
5. `VITE_API_URL` is read from the environment at build time and a Vite dev proxy routes API calls without CORS errors locally

**Plans**: 4 plans (walking skeleton, sequential waves 1→4)Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Wave 1: version-locked package.json + lockfile, TS/Vite config (proxy + env + Tailwind v4 + path aliases), self-hosted fonts, flat ESLint/Prettier (SC-1, SC-5 config, quality gate)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 01-02-PLAN.md — Wave 2: app shell + react-router 7 SPA routing, eager `/` + lazy code-split `/result` empty r3f Canvas, signposted dirs (SC-2, code-split)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 01-03-PLAN.md — Wave 3: test harness — Vitest (jsdom) sample + Playwright preview-build smoke asserting the `/result` Canvas mounts with no WebGL errors (SC-3, SC-2 live)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 01-04-PLAN.md — Wave 4: multi-stage non-root nginx Docker image + SPA fallback, GitHub Actions CI, husky/lint-staged, MIT LICENSE (SC-4, SC-5 deploy)

**UI hint**: yes

### Phase 2: Coordinate Mapping & Fixture Viewer

**Goal**: The single highest-risk piece — the pure function mapping the API's coordinate space (z-up, pallet-corner origin) into Three.js mesh transforms — is locked against a real captured API response and proven visually in a static 3D scene that matches the design mockup.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RESULT-01, RESULT-02
**Success Criteria** (what must be TRUE):

1. A real `done` response from `packerapi.anzozulia.xyz` (including at least one non-identity rotated box) is saved as a fixture and committed
2. Golden-value Vitest tests assert the exact mapped position and size for known fixture items, including the rotated case, with a dev-mode AABB sanity assertion passing
3. A static viewer renders the fixture as a 3D pallet with boxes coloured by type and a legend, visually matching `design/result.html`
4. A user can orbit, zoom, and pan the static scene and switch between ISO / TOP / FRONT camera presets

**Plans**: 2 plans (inside-out, sequential waves 1→2)

Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Wave 1: commit the captured golden fixture + pure src/lib/ coordinate-mapping (golden non-rotated/rotated + AABB tests) + deterministic box-type palette (RESULT-01 data/math half; locked-risk resolution)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 02-02-PLAN.md — Wave 2: dark-overlay @theme tokens + bbox camera-preset math, the drei viewer scene on /result (wood pallet, coloured edged boxes, legend, ISO/TOP/FRONT), Playwright Canvas + preset e2e, human visual sign-off (RESULT-01 viewer half + RESULT-02)
      **UI hint**: yes
      **Research flag:** NEEDS deeper research during planning — `orientation.perm` gather-vs-scatter semantics and whether `position.z` / `dimensions` are pre- or post-orientation must be resolved from the real captured response (first sub-task), not guessed.

### Phase 3: Pure Transform Core

**Goal**: The pure, IO-free transform layer is complete and fully unit-tested: the request-builder expands per-type quantities into uniquely-identified boxes and maps the three rotation modes, and the result-mapper regroups results by type and per pallet and surfaces diagnostics.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PACK-02, BOX-04
**Success Criteria** (what must be TRUE):

1. Given a config, the request-builder expands each box type's quantity into individual boxes with stable unique `TYPE#index` IDs and a round-trip test maps fixture results back to their type in O(1)
2. Each box type's rotation choice maps to exactly one of the API's three modes (`all` / `this_side_up` / `none`) in the built request
3. The result-mapper groups packed boxes by type and by pallet and exposes per-pallet CoG and per-box support-ratio fields from the fixture
4. All transform functions have co-located passing unit tests and import zero React or IO modules

**Plans**: 3 plans (interface-first foundation → 2 parallel vertical transform slices)

Plans:

**Wave 1**

- [x] 03-01-PLAN.md — Wave 1: pure type foundation — `src/types/config.ts` (PackConfig/BoxType/PalletConfig/RotationMode, D-01/D-05/D-06) + `src/types/pack-contract.ts` (PackRequest/BoxRequest/PackOptions + consolidated done-response interfaces, D-02) + `fixture-types.ts` re-export shim (PACK-02, BOX-04 contract seam)

**Wave 2** _(blocked on Wave 1 completion; the two slices run in parallel — no file overlap)_

- [x] 03-02-PLAN.md — Wave 2: request-builder vertical slice — failing tests → `buildPackRequest` (qty expansion, stable unique `{typeId}-{index}` ids + O(1) `idToType` map, D-07) + `rotationToApi` total table (free/uprightOnly/fixed → all/this_side_up/none) + baked options (25/7/0.8, D-03) (PACK-02 / SC-1, BOX-04 / SC-2)
- [x] 03-03-PLAN.md — Wave 2: result-mapper vertical slice — failing tests → `mapDoneResponse` single-pass dual-axis regrouping (by type + by pallet), map-primary/`typeKeyOf`-fallback recovery, raw cog + support_ratio pass-through (D-08), multi-pallet + unpacked (SC-1 round-trip, SC-3)

**UI hint**: no (pure library phase — no UI; verified by co-located Vitest + the code-split purity gate)

### Phase 4: Config Form & Local Persistence

**Goal**: A user can fully describe a pallet and a box catalog in a validated form, see a live running total, set how many pallets the solver may use, and have their work survive a page refresh via localStorage — with no API involved yet.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PALLET-01, PALLET-02, BOX-01, BOX-02, BOX-03, BOX-04, BOX-05, BOX-06, PACK-03, DATA-02
**Success Criteria** (what must be TRUE):

1. A user can set pallet length, width, max stack height (mm), max weight (kg), and max overhang (mm), and set how many pallets the solver may use
2. A user can add, edit, and remove box types, each with L/W/H (mm), unit weight (kg), quantity, max-load-on-top, a fragile flag, and a 3-mode rotation choice (no 6-chip UI, no CoG-envelope input field)
3. The form shows a live running total of box types and units and warns when the unit count is large
4. Invalid pallet or box inputs are flagged with clear messages and block submission
5. A user can save the current configuration locally and, after a page refresh, the catalog and pallet settings are restored intact

**Plans**: 7 plans (foundation → 2 parallel pure-lib waves → primitives → 2 parallel UI slices → integration + persistence + E2E)

Plans:

**Wave 1**

- [x] 04-01-PLAN.md — Wave 1: install rhf/zod/@hookform/resolvers (supply-chain gate), extend BoxType with label/maxLoad/fragile (D-08), port the light config @theme tokens, author the two zod schemas (strict submit + lenient restore) + DEFAULT_CONFIG/makeDefaultBoxType (D-09)

**Wave 2** _(blocked on Wave 1; the two pure-lib slices run in parallel — no file overlap)_

- [x] 04-02-PLAN.md — Wave 2: pure libs — box-fit conservative feasibility check (D-01/BOX-06) + config-tally live total & >1000 warning (BOX-05/D-03), TDD with golden tests
- [x] 04-03-PLAN.md — Wave 2: pure versioned localStorage (de)serialize/guard (D-07/DATA-02), TDD — never-throw, lenient restore

**Wave 3** _(blocked on Wave 1)_

- [x] 04-04-PLAN.md — Wave 3: shared UI primitives — NumberField, Switch (role=switch), SegmentedControl (3-mode rotation, C-03), Card, SectionLabel; three-free

**Wave 4** _(blocked on Waves 1-3; the two UI slices run in parallel — no file overlap)_

- [x] 04-05-PLAN.md — Wave 4: box-catalog slice — BoxRow (dims/weight/qty/maxLoad, fragile↔maxLoad D-08, rotation, swatch) + BoxCatalogCard (useFieldArray CRUD, live badge, empty state) (BOX-01/02/03/04/05)
- [x] 04-06-PLAN.md — Wave 4: pallet slice — PalletCard (Dimensions + Limits incl. Max pallets, no CoG C-04) (PALLET-01/02, PACK-03, D-10)

**Wave 5** _(blocked on Waves 1-4)_

- [x] 04-07-PLAN.md — Wave 5: integration — ConfigForm shell + resolver + Run gate (D-06) + fit-check, FooterBar (total + large-job advisory + Save draft), autosave/restore hook, ConfigurePage, restore-after-reload E2E + human visual sign-off (BOX-06/DATA-02/SC-5)

**UI hint**: yes

### Phase 5: API Client & Async Polling

**Goal**: A user can submit a real packing job and watch an honest loading state while the app polls the asynchronous job to a terminal state, can cancel cleanly, and every failure mode is distinguished and handled without crashing.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: PACK-01, PACK-04, PACK-05, PACK-06
**Success Criteria** (what must be TRUE):

1. A user can submit a valid configuration and the app POSTs to `/api/v1/pack` and polls `/api/v1/jobs/{job_id}` until a terminal state
2. A loading screen shows while polling, and reaching `done` advances the user toward the result
3. A user can cancel an in-progress job and polling stops cleanly with no leaked intervals or in-flight requests on unmount
4. Job failure, timeout, unreachable/CORS errors, and "some items unpacked" are each distinguished in the UI and none crash the app

**Plans**: 4 plans (sequential waves 1→4 — contracts → engine → happy-path slice → failure/cancel/e2e)

Plans:

**Wave 1**

- [x] 05-01-PLAN.md — Wave 1: supply-chain checkpoint (react-query 5.101.0 + msw 2.14.6, T-5-SC) + the three-free contract layer — zod network-boundary schema (C-02), PackError taxonomy + CORS/abort bucketing (D-07), AbortSignal fetch client (D-11/C-04), MSW transport + isolated QueryClient render helper (Wave-0 infra) (PACK-01/04/06)

**Wave 2** _(blocked on Wave 1)_

- [x] 05-02-PLAN.md — Wave 2: the submit-then-poll engine — useSubmitJob (useMutation) + usePollJob (useQuery + terminal-aware refetchInterval + ~120-140s safety cap, C-01/D-09) + the app-wide QueryClientProvider (PACK-01/04/05)

**Wave 3** _(blocked on Wave 2)_

- [x] 05-03-PLAN.md — Wave 3: the happy-path vertical slice — LoadingPage (comet spinner + tally-derived summary + honest real-status sub-line, D-01) on the eager three-free /loading route (D-03) + the ConfigForm Run seam swap (console.log → navigate('/loading'), C-03/C-05) + done→navigate('/result',replace) (PACK-01/04)

**Wave 4** _(blocked on Wave 3)_

- [x] 05-04-PLAN.md — Wave 4: the failure/cancel slice — distinguish failed/timeout/unreachable-CORS + unpacked-is-success (D-07), ErrorCard with Retry/Back, Cancel/Back/unmount clean abort (D-04/D-08/SC-3), Playwright route-intercepted e2e + code-split gate + human sign-off (PACK-05/06)

**UI hint**: yes

### Phase 6: Result Page & 3D Wiring

**Goal**: The full vertical is complete — a real packing result flows through the mapper into the persistent 3D viewer alongside summary stats, a multi-pallet switcher, a placement list with hover↔mesh highlighting, an unpacked-items panel, and the differentiating stability diagnostics (CoG marker + support-ratio tinting).
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: RESULT-03, RESULT-04, RESULT-05, RESULT-06, DIAG-01, DIAG-02
**Success Criteria** (what must be TRUE):

1. A user can configure boxes, run a real job, and explore the actual returned 3D packing plan in a single persistent canvas
2. A user can view summary stats (pallets used, utilisation, unpacked count, total weight) and switch between generated pallets, seeing each pallet's 3D layout and stats
3. A user can browse a per-box placement list (id, type, position, size, orientation, weight) and hovering a row highlights the matching mesh
4. A user can see which items could not be packed, each with its reason, in a first-class panel
5. A user can see each pallet's centre-of-gravity in the 3D scene and per-box support-ratio diagnostics surfaced from the API

**Plans**: 5 plans (inside-out MVP: pure-lib foundation → carrier/live-data slice → summary+switcher → placement+unpacked → diagnostics; sequential waves 1→5)

Plans:

**Wave 1**

- [x] 06-01-PLAN.md — Wave 1: pure src/lib foundation — `result-summary` (whole-job aggregation, RESULT-03), `cog-map` (cog.z up-axis point-map + exported `DECK_TOP_Y`, DIAG-01), `support-scale` (synthetic-ratio heatmap scale, DIAG-02), `--color-pos`/`--color-warn` tokens; golden/synthetic tests, three-free (Nyquist Wave 0)

**Wave 2** _(blocked on Wave 1)_

- [x] 06-02-PLAN.md — Wave 2: the carrier + live-data slice — `LoadingPage` carries `{ jobId, idToType }` on done-nav, `ResultPage` reads the real `done` from the react-query cache + no-result redirect (C-02) + `mapDoneResponse(done, idToType)` (C-03) + selected-pallet state + topbar/grid shell (D-07/D-08/D-09); makes /result REAL (RESULT-04, SC-1)

**Wave 3** _(blocked on Wave 2)_

- [x] 06-03-PLAN.md — Wave 3: summary + switcher slice — `SummaryBlock` (whole-job 2×2, RESULT-03), `PalletSwitcher` (neutral fill single-select, RESULT-04/D-04/D-05), overlay sub-line (D-03), camera-preserved-on-switch guard (D-02/Pitfall 3) + e2e

**Wave 4** _(blocked on Wave 3)_

- [x] 06-04-PLAN.md — Wave 4: placement + unpacked slice — `PlacementList` (per-pallet cards + always-shown support%, RESULT-05) with one-way row→mesh emissive hover (D-11), `UnpackedPanel` (conditional whole-job + reasons, RESULT-06/D-06), `Boxes` hoveredId emissive prop + hover e2e

**Wave 5** _(blocked on Wave 4)_

- [x] 06-05-PLAN.md — Wave 5: stability diagnostics slice — `CogMarker` (golden cog.z point-map + drop-line, toggle default ON, DIAG-01), `Boxes` support-heatmap colour mode + legend swap (toggle default OFF, DIAG-02), diagnostics e2e + phase gate

**UI hint**: yes

### Phase 7: Edge States, Exports & Self-Hosting

**Goal**: The product is hardened for real use and self-hosting — failures recover gracefully, results export as JSON and a printable report, and the whole app ships as a single configurable Docker image with deep-link refresh and GitHub docs sufficient to self-host in minutes.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: DATA-01, HOST-01, HOST-02, HOST-03
**Success Criteria** (what must be TRUE):

1. A user can export the packing result as JSON and as a printable report (print-CSS)
2. The app builds into a single Docker image that serves the static SPA and handles deep-link refresh via nginx SPA fallback
3. The API base URL is configurable at build time via `VITE_API_URL`, with the CORS requirement (built bundle served from a different origin reaching the live API) verified and documented
4. The project is published on GitHub with a README/docs — including an nginx reverse-proxy recipe — sufficient for someone to self-host in minutes

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase                                  | Plans Complete | Status      | Completed  |
| -------------------------------------- | -------------- | ----------- | ---------- |
| 1. Scaffolding & Version Lock          | 4/4            | Complete    | 2026-06-03 |
| 2. Coordinate Mapping & Fixture Viewer | 2/2 | Complete    | 2026-06-03 |
| 3. Pure Transform Core                 | 3/3 | Complete    | 2026-06-04 |
| 4. Config Form & Local Persistence     | 7/7 | Complete    | 2026-06-04 |
| 5. API Client & Async Polling          | 4/4 | Complete    | 2026-06-04 |
| 6. Result Page & 3D Wiring             | 5/5 | Complete    | 2026-06-05 |
| 7. Edge States, Exports & Self-Hosting | 0/TBD          | Not started | -          |
| 8. Assembly Insight (layer explode/isolation) | 2/3 | In Progress|  |

### Phase 8: Assembly Insight — Layer Explode & Isolation in the 3D Viewer

**Goal**: A densely-packed pallet is made legible — boxes hidden deep inside the stack become visible and their placement understandable — via two complementary, composable controls in the existing 3D viewer that share one derived layer model: (1) an **Explode** slider that vertically separates the solver's layers (0 = the real assembled stack → max = clearly gapped, animated), and (2) a **Layer-focus** control that reveals layers cumulatively from the floor up (build-up) or isolates a single layer, dimming/hiding the rest. Layers come from a pure, three-free `computeLayers(placements)` (base-z banding, tolerant of tall/floating boxes) so the math stays testable and the viewer stays in the lazy `/result` chunk.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: RESULT-07
**Success Criteria** (what must be TRUE):

1. A pure `computeLayers(placements)` groups each pallet's boxes into ordered layers by base z (with tolerance), unit-tested incl. single-layer, uneven-height, and tall/floating-box cases — imports no three/r3f (code-split gate stays green)
2. An "Explode" control in the viewer overlay animates the layers apart vertically: 0 reproduces the true assembled stack, higher values clearly gap each layer; the CoG marker and pallet wireframe behave sensibly while exploded
3. A "Layers" control reveals layers cumulatively (build-up) and/or isolates a single layer, dimming or hiding non-focused layers; default is all-visible + assembled (no behavior change until used)
4. The new controls compose without regression with the ISO/TOP/FRONT presets, CoG + support-heatmap toggles, the pallet switcher, and placement-list hover highlighting
5. Works on real multi-layer results (the demo presets) at interactive frame rates

**Plans**: 3 plans (inside-out MVP: pure layer-model foundation -> Explode vertical slice -> Layers focus slice; sequential waves 1->3)

Plans:

**Wave 1**

- [x] 08-01-PLAN.md — pure foundation: three-free `computeLayers(placements)` base-z banding + 8 golden SC-1 tests, pure `inflateBboxForExplode` (D-05 helper) + golden cases, promote `maath` to a direct dep

**Wave 2** _(blocked on Wave 1)_

- [x] 08-02-PLAN.md — Explode vertical slice: per-layer offset + `maath` animation in Boxes, explode-decoupled camera re-fit in CameraPresets, the bottom-center LayerControls Explode slider + ResultPage explode state + CoG-hide gate, route-intercepted explode e2e (0=assembled, >0 gaps, camera-unchanged-on-switch, compose)

**Wave 3** _(blocked on Wave 2)_

- [x] 08-03-PLAN.md — Layers focus slice: build-up hide + isolate ghost-opacity in Boxes, the Layers slider + Build-up/Isolate toggle, PlacementList row-click -> isolate (+ selected cue), ResultPage focus state + reset-on-switch + row wiring, isolate/build-up/compose/reset e2e + phase gate

**UI hint**: yes
