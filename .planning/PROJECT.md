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

- [ ] User can configure a pallet: length, width, max stack height, max weight, max overhang (mm / kg)
- [ ] User can build a box catalog: per type — dimensions, unit weight, quantity, max load on top, fragile flag, rotation mode
- [ ] App expands per-type quantities into individual boxes with unique IDs for the API
- [ ] User can submit a packing job and see a loading state while the app polls the async API to completion
- [ ] User can view the result: 3D pallet viewer + summary (pallets used, utilisation, unpacked, total weight) + per-box placement list
- [ ] User can pack across multiple pallets (`options.max_pallets`) and switch between generated pallets
- [ ] User can export the packing result (JSON / printable report)
- [ ] User can save and reload their configuration locally (localStorage) so a refresh doesn't lose work
- [ ] User can see stability diagnostics: centre-of-gravity and support ratios returned by the API
- [ ] App handles API failure / timeout / unpacked-items states gracefully with clear messaging
- [ ] App ships as a single Docker image, self-hostable, with the API base URL configurable at build time
- [ ] Project is published on GitHub with docs sufficient for someone to self-host in minutes

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- User accounts / registration / login — deliberately out for v1; "just a tool as is." May be added later.
- Server-side calculation history or saved jobs — no backend persistence in v1; this is a stateless client over the API. May be added later.
- The packing algorithm itself — owned by the existing API (`packerapi.anzozulia.xyz`); the frontend never computes placements.
- 6-way granular rotation control — the API only supports 3 modes (`all` / `this_side_up` / `none`); the UI will mirror those three, not the 6 chips in the mockup.
- CoG envelope as an *input* constraint — the API does not accept a CoG limit; centre-of-gravity is an *output* only, surfaced as a diagnostic.
- Native mobile apps — web-first, responsive where practical.

## Context

- **Existing API** at `https://packerapi.anzozulia.xyz` — asynchronous job model: `POST /api/v1/pack` returns `202 { job_id, status:"queued" }`, then `GET /api/v1/jobs/{job_id}` is polled until `done` / `failed` / `timeout`. Also `GET /api/v1/health` and `/api/v1/version`. The async model maps cleanly onto the mockup's loading screen.
- **Design mockups** in `design/` (`config.html`, `loading.html`, `result.html`) — high-fidelity vanilla HTML/CSS/JS + Three.js. They are the visual north star and overall vision, not the implementation; they will be reimplemented in the chosen stack and adjusted as the API dictates. Design is explicitly subject to change.
- **API returns more than the mockup shows** — per-item `support_ratio`, `supported_by`, `supports`, and per-pallet `cog`. v1 surfaces these as stability diagnostics.
- **Quantity gap** — the catalog groups boxes by type with a quantity; the API expects individual boxes with unique IDs, so the client expands them before submitting.
- **Extensibility** — accounts, history, and registration are anticipated future additions. Architect cleanly so they *can* be added, but do not build them now.

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

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React + Vite + TypeScript + react-three-fiber | Dynamic catalog UI, type-safe API contract, large contributor pool, r3f wraps existing Three.js scene declaratively | — Pending |
| Build-time `VITE_API_URL` for API base URL | Simplest path chosen over a runtime nginx proxy; accept rebuild-to-reconfigure and a CORS requirement | — Pending |
| Simplify rotation UI to the API's 3 modes | The 6-chip mockup implies control the API can't honor; mirror `all` / `this_side_up` / `none` honestly | — Pending |
| Include all four optional features in v1 (multi-pallet, export, local save/load, stability diagnostics) | They are high-value, low-coupling, and the API already returns the needed data | — Pending |
| Async submit-then-poll integration with the pack API | Required by the API's job model; aligns with the mockup loading screen | — Pending |
| No accounts / no server-side persistence in v1 | "Just a tool as is"; keep it stateless and self-hostable, leave room to add later | — Pending |

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
*Last updated: 2026-06-03 after initialization*
