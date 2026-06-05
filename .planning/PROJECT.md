# Palletize

## What This Is

A free, open-source, self-hostable web tool for pallet packing. A user describes a pallet and a catalog of boxes, the app submits the job to an existing packing API, and returns an explorable 3D plan showing exactly where every box goes — fill rate, weight, centre-of-gravity, and stacking stability included. No login, no accounts, no stored history. Just the tool.

## Core Value

A user can describe their pallet and boxes and get back a correct, explorable 3D packing plan in seconds — with zero signup and nothing to install beyond a single Docker container.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

- [x] User can configure a pallet: length, width, max stack height, max weight, max overhang (mm / kg) — built in Phase 4
- [x] User can build a box catalog: per type — dimensions, unit weight, quantity, max load on top, fragile flag, rotation mode — built in Phase 4 (max load + fragile are persisted/displayed but NOT sent to the API per D-08)
- [ ] App expands per-type quantities into individual boxes with unique IDs for the API
- [x] User can submit a packing job and see a loading state while the app polls the async API to completion — built in Phase 5 (PACK-01 / PACK-04)
- [x] User can view the result: 3D pallet viewer + summary (pallets used, utilisation, unpacked, total weight) + per-box placement list — built in Phase 6 (RESULT-03 whole-job summary, RESULT-05 placement list with hover↔mesh highlight, RESULT-06 conditional unpacked panel)
- [x] User can pack across multiple pallets (`options.max_pallets`) and switch between generated pallets — switcher built in Phase 6 (RESULT-04; `max_pallets` is an API option, the UI drives the persistent canvas per selected pallet with the camera preserved)
- [ ] User can export the packing result (JSON / printable report)
- [x] User can save and reload their configuration locally (localStorage) so a refresh doesn't lose work — built in Phase 4
- [x] User can see stability diagnostics: centre-of-gravity and support ratios returned by the API — built in Phase 6 (DIAG-01 CoG marker + drop-line, DIAG-02 support-ratio heatmap toggle + per-card support%)
- [x] App handles API failure / timeout / unpacked-items states gracefully with clear messaging — built in Phase 5 (PACK-06: failure / timeout / unreachable-CORS / some-unpacked distinguished, none crash; PACK-05: cancel stops polling cleanly)
- [ ] App ships as a single Docker image, self-hostable, with the API base URL configurable at build time
- [ ] Project is published on GitHub with docs sufficient for someone to self-host in minutes

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- User accounts / registration / login — deliberately out for v1; "just a tool as is." May be added later.
- Server-side calculation history or saved jobs — no backend persistence in v1; this is a stateless client over the API. May be added later.
- The packing algorithm itself — owned by the existing API (`packerapi.anzozulia.xyz`); the frontend never computes placements.
- 6-way granular rotation control — the API only supports 3 modes (`all` / `this_side_up` / `none`); the UI will mirror those three, not the 6 chips in the mockup.
- CoG envelope as an _input_ constraint — the API does not accept a CoG limit; centre-of-gravity is an _output_ only, surfaced as a diagnostic.
- Native mobile apps — web-first, responsive where practical.

## Context

- **Existing API** at `https://packerapi.anzozulia.xyz` — asynchronous job model: `POST /api/v1/pack` returns `202 { job_id, status:"queued" }`, then `GET /api/v1/jobs/{job_id}` is polled until `done` / `failed` / `timeout`. Also `GET /api/v1/health` and `/api/v1/version`. The async model maps cleanly onto the mockup's loading screen.
- **Design mockups** in `design/` (`config.html`, `loading.html`, `result.html`) — high-fidelity vanilla HTML/CSS/JS + Three.js. They are the visual north star and overall vision, not the implementation; they will be reimplemented in the chosen stack and adjusted as the API dictates. Design is explicitly subject to change.
- **API returns more than the mockup shows** — per-item `support_ratio`, `supported_by`, `supports`, and per-pallet `cog`. v1 surfaces these as stability diagnostics.
- **Quantity gap** — the catalog groups boxes by type with a quantity; the API expects individual boxes with unique IDs, so the client expands them before submitting.
- **Extensibility** — accounts, history, and registration are anticipated future additions. Architect cleanly so they _can_ be added, but do not build them now.

## Constraints

- **Tech stack**: React + Vite + TypeScript, with react-three-fiber (+ drei) wrapping the Three.js 3D viewer — chosen for the dynamic box-catalog UI, a type-safe API contract, and a broad contributor pool.
- **API integration**: must use the async submit-then-poll flow; the frontend never blocks on a synchronous response.
- **API base URL**: configurable via build-time env var (`VITE_API_URL`). Consequence — the API must allow CORS for the serving origin, and changing the backend requires a rebuild. A dev proxy will be provided for local development.
- **Deployment**: a single Docker image, optimized for easy self-hosting (static build served by a lightweight web server).
- **No backend of our own**: stateless client; all persistence is client-side (localStorage) only.
- **Units**: millimetres for dimensions (integers), kilograms for weight — matching the API and mockups.
- **Licensing**: open-source, GitHub-published.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision                                                                                                | Rationale                                                                                                           | Outcome                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| React + Vite + TypeScript + react-three-fiber                                                           | Dynamic catalog UI, type-safe API contract, large contributor pool, r3f wraps existing Three.js scene declaratively | ✓ Realized in Phase 1 — version-locked quartet (React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / three 0.184.0 exact) builds, runs, and serves  |
| Build-time `VITE_API_URL` for API base URL                                                              | Simplest path chosen over a runtime nginx proxy; accept rebuild-to-reconfigure and a CORS requirement               | ✓ Seam wired in Phase 1 — typed `import.meta.env.VITE_API_URL`, Docker build-arg bake, `/api` dev proxy (live grep deferred to Phase 5) |
| Coordinate mapping is a pure `src/lib/` fn consuming API `position` (min-corner) + `dimensions` (post-orientation) only; `orientation.perm` is diagnostic-only, never applied to geometry | Wrong coordinate semantics would corrupt every 3D plan — the product's highest risk; resolved empirically against the live API/OpenAPI spec, not guessed | ✓ Realized in Phase 2 — golden-locked (incl. a 3-cycle rotated case) and rendered in the static `/result` viewer; Phases 3/6 read `perm`/`name` separately |
| Simplify rotation UI to the API's 3 modes                                                               | The 6-chip mockup implies control the API can't honor; mirror `all` / `this_side_up` / `none` honestly              | ◐ Transform half realized in Phase 3 — `rotationToApi` is a compile-total `Record<RotationMode, ApiRotation>` (free→all / uprightOnly→this_side_up / fixed→none); the UI mirror lands with the box-catalog form in Phase 4 |
| Include all four optional features in v1 (multi-pallet, export, local save/load, stability diagnostics) | They are high-value, low-coupling, and the API already returns the needed data                                      | — Pending                                                                                                                               |
| Async submit-then-poll integration with the pack API                                                    | Required by the API's job model; aligns with the mockup loading screen                                              | ✓ Realized in Phase 5 — TanStack Query useSubmitJob + usePollJob (terminal-aware refetchInterval + a client safety cap that latches the tripped job identity and disables the query so the loop actually stops), zod network boundary, PackError taxonomy, honest loading status; 4 terminal states + clean cancel. CR-01/CR-02 cap blockers found in verification and fixed in gap closure; 153 unit + 6 e2e tests |
| No accounts / no server-side persistence in v1                                                          | "Just a tool as is"; keep it stateless and self-hostable, leave room to add later                                   | — Pending                                                                                                                               |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-06-05 — Phase 6 (Result Page & 3D Wiring) complete: the full result vertical is live. `/result` now reads the real `done` payload from the react-query cache (the committed fixture is gone), carries `{ jobId, idToType }` from `/loading` via nav state, redirects home when no result is in memory, and runs it through `mapDoneResponse` (map-PRIMARY type recovery) into one persistent r3f canvas. The rail delivers a whole-job SummaryBlock (RESULT-03), a multi-pallet PalletSwitcher that swaps the scene with the camera preserved (RESULT-04 / D-02), a per-pallet PlacementList with always-shown support% and one-way hover↔mesh emissive highlighting (RESULT-05 / D-11), and a conditional UnpackedPanel with reasons (RESULT-06). Differentiating diagnostics: an in-scene CoG marker + drop-line on the empirically-confirmed cog.z-up axis (DIAG-01) and a support-ratio heatmap toggle (DIAG-02), built on three pure three-free golden-tested derivations (`summarise`, `mapCog`, `supportColor`) so the entry chunk stays three-free (three only in the lazy `/result` chunk). A deep code review caught a real BLOCKER masked by the legacy test fixture — the placement-swatch/legend palette keyed by `typeKeyOf` diverged from the `idToType`-recovered `typeId` on the live `${typeId}-${index}` id format — fixed by unifying all four lookups on the recovered `typeId`, plus three render-crash guards (empty-pallet NaN camera, zero-pallet index, unchecked result cast), all regression-tested with real `Da-0` ids. Verified 19/19 must-haves (status passed). 183 unit + 14 Playwright e2e green. Deferred advisory debt: WR-03 (raw weights), WR-04 (memo deps), IN-01..04 — tracked in `06-REVIEW.md`. Next: Phase 7 (Edge States, Exports & Self-Hosting). ⟢ Prior — Phase 5 (API Client & Async Polling) complete: the Configure screen's Run button now drives the real async pack API end-to-end — `useSubmitJob` (POST /api/v1/pack) → `usePollJob` (poll GET /api/v1/jobs/{id} with a terminal-aware `refetchInterval` and a client wall-clock safety cap) over a zod-validated network boundary and a `PackError` taxonomy (failure / timeout / unreachable-CORS / contract-drift), wrapped by an app-wide `QueryClientProvider`. The eager three-free `/loading` route shows the comet spinner + tally summary + an HONEST status sub-line (no fake %), advances to `/result` on `done`, treats "some items unpacked" as success, and distinguishes all four terminal states + clean cancel/Back without crashing — proven by a route-intercepted Playwright e2e (never the live API). Verification initially found 2 poll-cap blockers (CR-01 Retry-after-cap; CR-02 cap didn't stop the network loop); both were fixed in gap closure via an identity-latched cap that disables the query on trip, plus all 6 review warnings + 4 info items. Re-verified 4/4 must-haves (status human_needed — `05-HUMAN-UAT.md` tracks the loading-fidelity + live Retry-after-cap walkthrough, the former already covered by the approved 05-04 visual sign-off). 153 unit/component + 6 E2E tests green; entry chunk stays three-free; PACK-01/04/05/06 delivered. Next: Phase 6 (Result Page & 3D Wiring) flows a real packing result through the mapper into the persistent 3D viewer._
