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
- [ ] **Phase 4: Config Form & Local Persistence** - Editable pallet + box catalog form with validation, live unit count, and localStorage that survives refresh
- [ ] **Phase 5: API Client & Async Polling** - Typed client, submit-then-poll job lifecycle, loading screen, cancel, and all four terminal states handled
- [ ] **Phase 6: Result Page & 3D Wiring** - Full vertical: real result → mapper → viewer + summary rail, multi-pallet switcher, placement list, unpacked panel, CoG + support diagnostics
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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase                                  | Plans Complete | Status      | Completed  |
| -------------------------------------- | -------------- | ----------- | ---------- |
| 1. Scaffolding & Version Lock          | 4/4            | Complete    | 2026-06-03 |
| 2. Coordinate Mapping & Fixture Viewer | 2/2 | Complete    | 2026-06-03 |
| 3. Pure Transform Core                 | 3/3 | Complete    | 2026-06-04 |
| 4. Config Form & Local Persistence     | 0/TBD          | Not started | -          |
| 5. API Client & Async Polling          | 0/TBD          | Not started | -          |
| 6. Result Page & 3D Wiring             | 0/TBD          | Not started | -          |
| 7. Edge States, Exports & Self-Hosting | 0/TBD          | Not started | -          |
