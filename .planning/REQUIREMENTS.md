# Requirements: Palletize

**Defined:** 2026-06-03
**Core Value:** A user can describe their pallet and boxes and get back a correct, explorable 3D packing plan in seconds — with zero signup and a single self-hostable Docker container.

## v1 Requirements

Requirements for the initial release. Each maps to a roadmap phase.

### Pallet Configuration

- [x] **PALLET-01**: User can set the pallet length, width, and max stack height (mm)
- [x] **PALLET-02**: User can set the pallet max weight (kg) and max overhang (mm)

### Box Catalog

- [x] **BOX-01**: User can add, edit, and remove box types in a catalog
- [x] **BOX-02**: User can set each box type's dimensions (L/W/H, mm), unit weight (kg), and quantity
- [x] **BOX-03**: User can set max-load-on-top per box type and mark a type fragile (fragile = nothing stacked on top)
- [x] **BOX-04**: User can choose a rotation mode per box type from the API's three modes (any orientation / keep upright / fixed)
- [x] **BOX-05**: App shows a live running total of box types and units and warns when the unit count is large
- [x] **BOX-06**: App validates pallet and box inputs and blocks submitting an invalid configuration with clear messages

### Packing Job

- [x] **PACK-01**: User can submit the configuration to run a packing calculation
- [x] **PACK-02**: App expands each box type's quantity into individual, uniquely-identified boxes before calling the API
- [x] **PACK-03**: User can set how many pallets the solver may use (max_pallets)
- [x] **PACK-04**: App shows a loading state and polls the asynchronous job until it reaches a terminal state
- [x] **PACK-05**: User can cancel an in-progress packing job, and polling stops cleanly
- [x] **PACK-06**: App distinguishes job failure, timeout, unreachable/CORS errors, and "some items unpacked" — none crash the app

### Result & Visualization

- [x] **RESULT-01**: User can view a 3D visualization of the packed pallet, with boxes coloured by type and a legend
- [x] **RESULT-02**: User can orbit, zoom, and pan the 3D scene and switch between ISO / TOP / FRONT camera presets
- [x] **RESULT-03**: User can view summary stats: pallets used, utilisation, unpacked count, and total weight
- [x] **RESULT-04**: User can switch between generated pallets and see each one's 3D layout and stats
- [x] **RESULT-05**: User can browse a per-box placement list (id, type, position, size, orientation, weight) with hover highlighting linked to the 3D scene
- [x] **RESULT-06**: User can see which items could not be packed, each with its reason
- [x] **RESULT-07**: User can make a dense pallet legible via two composable viewer controls: an **Explode** slider that vertically separates the solver's layers (animated, 0 = true assembled stack) and a **Layers** control that reveals layers cumulatively (build-up) or isolates a single layer (dimming/hiding the rest). Both derive from one pure `computeLayers(placements)` model and compose with the existing presets, CoG/heatmap toggles, pallet switcher, and placement-list.

### Stability Diagnostics

- [x] **DIAG-01**: User can see each pallet's centre-of-gravity indicated in the 3D scene
- [x] **DIAG-02**: User can see per-box support information (support ratio) returned by the API

### Export & Local Persistence

- [ ] **DATA-01**: User can export the packing result as JSON and as a printable report
- [x] **DATA-02**: User can save the current configuration locally and reload it after a page refresh (localStorage)

### Self-Hosting & Deployment

- [ ] **HOST-01**: App builds into a single Docker image that serves the static SPA and handles deep-link refresh (SPA fallback)
- [ ] **HOST-02**: The API base URL is configurable at build time via `VITE_API_URL`, with the CORS requirement documented
- [ ] **HOST-03**: Project is published on GitHub with a README/docs sufficient to self-host in minutes

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Configuration

- **CFG-V2-01**: Standard pallet presets (EUR / GMA / etc.) — *low cost; consider pulling into v1 during planning*
- **CFG-V2-02**: Duplicate an existing box type
- **CFG-V2-03**: CSV import / export of the box catalog

### Result

- **RES-V2-01**: 2D top-down layer view
- **RES-V2-02**: Step-by-step load sequence (requires inferring a physical load order)
- **RES-V2-03**: PNG snapshot of the 3D scene
- **RES-V2-04**: True PDF export (vs print-CSS)

### Sharing

- **SHR-V2-01**: Share a configuration via URL (deferred until the config schema is stable)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| User accounts / login / registration | "Just a tool as is" — stateless v1; may be added later |
| Server-side calculation history | No backend of our own in v1; client is stateless over the API |
| The packing algorithm itself | Owned by the existing API; the frontend never computes placements |
| 6-way granular rotation UI | API only supports 3 modes; richer UI would imply control the API ignores |
| CoG envelope as an input constraint | API accepts no CoG limit; CoG is an output diagnostic only |
| mm/in unit toggle | API contract is mm/kg; runtime conversion adds rounding bugs for marginal benefit |
| Manual drag-and-drop placement editor | The solver is authoritative; overriding it would require client-side physics |
| Native mobile apps | Web-first, responsive where practical |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PALLET-01 | Phase 4 | Complete |
| PALLET-02 | Phase 4 | Complete |
| BOX-01 | Phase 4 | Complete |
| BOX-02 | Phase 4 | Complete |
| BOX-03 | Phase 4 | Complete |
| BOX-04 | Phase 4 | Complete |
| BOX-05 | Phase 4 | Complete |
| BOX-06 | Phase 4 | Complete |
| PACK-01 | Phase 5 | Complete |
| PACK-02 | Phase 3 | Complete |
| PACK-03 | Phase 4 | Complete |
| PACK-04 | Phase 5 | Complete |
| PACK-05 | Phase 5 | Complete |
| PACK-06 | Phase 5 | Complete |
| RESULT-01 | Phase 2 | Complete |
| RESULT-02 | Phase 2 | Complete |
| RESULT-03 | Phase 6 | Complete |
| RESULT-04 | Phase 6 | Complete |
| RESULT-05 | Phase 6 | Complete |
| RESULT-06 | Phase 6 | Complete |
| RESULT-07 | Phase 8 | Complete |
| DIAG-01 | Phase 6 | Complete |
| DIAG-02 | Phase 6 | Complete |
| DATA-01 | Phase 7 | Pending |
| DATA-02 | Phase 4 | Complete |
| HOST-01 | Phase 7 | Pending |
| HOST-02 | Phase 7 | Pending |
| HOST-03 | Phase 7 | Pending |

**Note:** BOX-04 (rotation mode) spans two phases by nature — the request-builder *mapping* of the three modes is delivered/tested in Phase 3, and the *user-facing rotation choice* is delivered in Phase 4. It is assigned to Phase 4 above (the phase where the user-observable behavior lands) to keep a one-phase-per-requirement mapping; Phase 3's success criteria reference the underlying mapping.

**Coverage:**
- v1 requirements: 28 total (27 original v1 IDs + RESULT-07 added during Phase 8 planning)
- Mapped to phases: 28 ✓
- Unmapped: 0 ✓

Phase distribution:
- Phase 1 (Scaffolding & Version Lock): 0 requirements (foundational only)
- Phase 2 (Coordinate Mapping & Fixture Viewer): RESULT-01, RESULT-02
- Phase 3 (Pure Transform Core): PACK-02 (+ BOX-04 mapping)
- Phase 4 (Config Form & Local Persistence): PALLET-01, PALLET-02, BOX-01, BOX-02, BOX-03, BOX-04, BOX-05, BOX-06, PACK-03, DATA-02
- Phase 5 (API Client & Async Polling): PACK-01, PACK-04, PACK-05, PACK-06
- Phase 6 (Result Page & 3D Wiring): RESULT-03, RESULT-04, RESULT-05, RESULT-06, DIAG-01, DIAG-02
- Phase 7 (Edge States, Exports & Self-Hosting): DATA-01, HOST-01, HOST-02, HOST-03
- Phase 8 (Assembly Insight — Layer Explode & Isolation in the 3D Viewer): RESULT-07

---
*Requirements defined: 2026-06-03*
*Last updated: 2026-06-04 — RESULT-02 completed (Phase 2 / Plan 02-02); RESULT-01 + RESULT-02 delivered*
