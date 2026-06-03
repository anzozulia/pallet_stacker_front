# Phase 2: Coordinate Mapping & Fixture Viewer - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the single highest-risk piece of the whole product — the **pure function that maps the API's coordinate space (z-up, box-centre positions in mm from the pallet corner) into Three.js mesh transforms** — proven against a **real, captured `done` response** with golden-value tests, then render that fixture as a **static, explorable 3D scene** that echoes `design/result.html`.

Delivers **RESULT-01** (3D pallet, boxes coloured by type + legend) and **RESULT-02** (orbit / zoom / pan + ISO / TOP / FRONT presets).

**What's in scope:**

- Capture and commit a real multi-pallet `done` response (incl. ≥1 non-identity rotated box) as a fixture.
- A pure, IO-free mapping function in `src/lib/` with golden-value Vitest tests + a dev-mode AABB sanity assertion.
- A faithful static viewer (one pallet from the fixture) on the existing `/result` route: coloured boxes, legend, orbit/zoom/pan, animated ISO/TOP/FRONT presets, dark overlay header.

**Scope guardrail — explicitly NOT this phase:**

- The result-page **rail** (summary stats, pallet switcher, placement list, hover↔mesh highlight, CoG marker, support-ratio tinting, unpacked panel) → **Phase 6**.
- The **request-builder** (qty expansion, rotation-mode mapping) and **result-mapper** (group-by-type/pallet, diagnostics extraction) → **Phase 3**. The Phase 2 mapping function is geometry-only.
- The live **API client + async polling** → **Phase 5**. The Phase 2 capture is a one-off manual curl, not the app's runtime client.

</domain>

<decisions>
## Implementation Decisions

### Fixture capture & scenario

- **D-01:** **Capture via curl / dev-proxy.** Claude POSTs a config to `https://packerapi.anzozulia.xyz` (directly, or through the Vite `/api` dev proxy), polls `GET /api/v1/jobs/{job_id}` to `done`, and saves the raw JSON **verbatim**. Assumes the API needs no auth/key (author-controlled API — confirm during execution; if a key is required, the user provides it).
- **D-02:** **Scenario = multi-pallet rich catalog.** Size the input config so the solver uses **2–3 pallets**, with **3+ box types**, **≥1 forced non-identity rotation** (a box type set to rotation mode `all` that the solver actually rotates — SC-1/SC-2 requirement), and **a few intentionally unpacked items**. Rationale: this fixture is load-bearing for Phases 2/3/6; capturing it rich now future-proofs Phase 3 (group-by-pallet) and Phase 6 (multi-pallet switcher, unpacked panel) and avoids a re-capture.
- **D-03:** **Commit both the request and the `done` response** together (e.g. `request.json` + `done-response.json`). Gives reproducibility and hands Phase 3's request-builder a real reference example to test against.
- **D-04:** **The Phase 2 viewer renders pallet index 0 only.** The fixture may contain N pallets; the static viewer shows the first. The multi-pallet switcher is Phase 6.

### Coordinate mapping (the locked risk)

- **D-05:** The mapping is a **pure, IO-free function in `src/lib/`** — no React, no IO; ideally only plain math + types (it may import `three` types for vectors, but must be unit-testable in jsdom **without rendering a Canvas**). It returns mesh-ready position + size (+ rotation/orientation) for each placed box. **Golden-value Vitest tests** assert the exact mapped position and size for known fixture items **including the rotated case**, and a **dev-mode AABB sanity assertion** (each mapped box sits within the pallet envelope) passes.
- **D-06 (RESEARCH — NOT decided in discussion; resolve empirically during planning):** The mapping **semantics** must be derived from the **real captured response**, never guessed:
  - `orientation.perm` gather-vs-scatter meaning,
  - whether `position.z` / `dimensions` are **pre- or post-orientation**.
    This is the roadmap's flagged research item and the reason a real fixture is captured first. The mockup's hand-authored mapping (below) is a **visual hint only** — verify every field meaning against the live response before trusting it.

### Viewer fidelity

- **D-07:** **Faithful to the mockup.** Build the wood pallet model (slats + blocks), key/fill/ambient/hemisphere lighting, soft (PCF) shadows, ground plane + grid, fog, box **edge-lines** (`EdgesGeometry`), and per-type colour tinting — matching `design/result.html`. Phase 6 then swaps fixture→real data rather than rebuilding the scene (SC-3 demands a visual match).
- **D-08:** **Port the dark 3D-overlay Tailwind token group now** (`--d-bg:#0c0f17`, `--d-border:#222838`, `--d-text:#e6e8ee`, `--d-text-2:#838b9e` — from `design/result.html` `:root`) into the `@theme` block. Phase 1 deferred the mockup palette to be ported per-phase as UI lands; the viewer is when these land.
- **D-09:** **Box-type colours from a deterministic palette** seeded by the mockup's three (`#6d63f5` / `#0ea5a3` / `#e0892b`), extended harmoniously if the fixture has more types. Legend = swatch + type name, top-right of the viewer like the mockup.
- **D-10:** **Per-box individual meshes** (each with edge `LineSegments`). `InstancedMesh` is a Phase 6 concern (the ~100–200-box threshold is an unverified estimate); a single pallet's box count is well under it.

### Camera & controls

- **D-11:** **drei `<OrbitControls>` (or `<CameraControls>`) + auto-fit framing.** Orbit/zoom/pan via drei; **ISO / TOP / FRONT computed from the scene's bounding box** (drei `<Bounds>`/fit) so any fixture frames correctly. Do **not** use the mockup's hardcoded camera positions — our fixture has different real dimensions and they would mis-frame it. Tune the preset angles to echo the mockup's composition.
- **D-12:** **Feel defaults:** animated preset transitions, damping on, a **polar clamp** so the camera can't orbit beneath the ground plane (mockup uses `maxPolarAngle ≈ π*0.495`), and min/max zoom derived from scene size. All tunable.

### Phase-2 / Phase-6 boundary (on-canvas chrome)

- **D-13:** **Chrome built now:** legend (top-right) + **ISO/TOP/FRONT buttons** + a **dark overlay header** (pallet name + dimensions tag + the drag/scroll/right-drag control hints), matching the mockup's viewer pane. **Static labels only.**
- **D-14:** **No computed summary stats** in the overlay (no fill % / weight / box-count sub-line) — those need the Phase 3 mapper and belong to Phase 6.
- **D-15:** The entire **right rail** (summary 2×2, pallet switcher, placement list, hover↔mesh highlight, CoG marker, support-ratio tinting, unpacked panel) is **Phase 6** — explicitly not built here.

### Claude's Discretion

The planner/executor may proceed on these without re-asking:

- Fixture file location & exact layout (e.g. `src/lib/__fixtures__/done-response.json` + `request.json`).
- The exact pure-function signature and return shape (position/size/orientation representation).
- The AABB sanity-assertion mechanism and where it fires (dev-only).
- Palette-extension scheme beyond the mockup's three colours.
- Exact preset camera angles/distances and transition easing.
- Overlay implementation: drei `<Html>` vs absolute-positioned DOM layered over the `<Canvas>`.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The mapping + visual north star (MOST IMPORTANT)

- `design/result.html` — the Three.js mockup. **Lines ~319–334** contain the reference mapping: `geo = new THREE.BoxGeometry(b.l, b.h, b.w)` (API `l→x`, `h→y`, `w→z` — note API `w` becomes three's `z`) and `m.position.set(b.x - PL.L/2, deckTopY + (b.base||0) + b.h/2, b.y - PL.W/2)` where `deckTopY = blockH(78) + deckH(22) = 100`. **Lines ~336–352** are the ISO/TOP/FRONT preset positions/targets (a feel reference, NOT to copy verbatim — see D-11). The rail note **"positions are box-centre · mm · origin = pallet corner"** confirms the API's coordinate convention. ⚠ The mockup's `base`/`rot`/`x`/`y` are **hand-authored** — treat as visual intent, verify against the real response (D-06).

### Live API (capture target)

- `https://packerapi.anzozulia.xyz` — async job model: `POST /api/v1/pack` → `202 { job_id, status:"queued" }`, then poll `GET /api/v1/jobs/{job_id}` until `done` / `failed` / `timeout`. Also `GET /api/v1/health`, `GET /api/v1/version`. This is where the fixture is captured (D-01). Per-item `support_ratio` / `supported_by` / `supports` and per-pallet `cog` are returned (surfaced as diagnostics in Phase 6, not Phase 2).

### Phase goal, requirements & scope

- `.planning/ROADMAP.md` §"Phase 2: Coordinate Mapping & Fixture Viewer" — the goal, the **4 success criteria** this phase is measured against, and the **Research flag** (orientation.perm semantics; pre/post-orientation z & dimensions).
- `.planning/REQUIREMENTS.md` — **RESULT-01** (3D viewer, colour-by-type, legend) and **RESULT-02** (orbit/zoom/pan + ISO/TOP/FRONT presets), plus the Out-of-Scope notes (6-way rotation, CoG-as-input — neither applies here).
- `.planning/PROJECT.md` — constraints (mm/kg integer units, API context, async model) and the Key Decisions table.

### Stack & prior-phase decisions

- `CLAUDE.md` — the locked version quartet (React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / three 0.184.0 exact), drei guidance ("prefer drei first" for `<OrbitControls>`/`<CameraControls>`/`<Bounds>`/`<Edges>`/`<Grid>`/`<Html>`), the "test scene logic as pure functions, not the Canvas, in jsdom" rule, and the InstancedMesh ~100–200 threshold note.
- `.planning/phases/01-scaffolding-version-lock/01-CONTEXT.md` — the `/result` route is **`React.lazy` code-split** (three/r3f/drei isolated in that chunk; `scripts/check-code-split.mjs` enforces it); `src/lib/` is where pure transforms land; Tailwind `@theme` tokens are ported **per-phase** (D-07/D-08 here continue that); jsdom tests stay WebGL-free, Canvas-mount asserted only in the Playwright preview-build smoke.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/routes/ResultPage.tsx` — currently an **empty `<Canvas>`** (single `ambientLight`) on the lazy `/result` route. The Phase 2 viewer **replaces this body**; the `100dvh` wrapper + `data-testid="r3f-canvas"` pattern stays.
- `src/lib/` (`.gitkeep` only) — the **coordinate-mapping pure function** and the committed **fixture JSON** land here (or a `__fixtures__/` subdir). Co-located golden tests.
- `src/styles.css` — the Tailwind v4 `@theme` block; the dark-overlay token group (D-08) is added here.
- **Vite `/api` dev proxy** (Phase 1) → `https://packerapi.anzozulia.xyz` — usable for the fixture capture (D-01) without CORS friction.

### Established Patterns

- **Code-split boundary:** all three/r3f/drei usage must stay inside the lazy `/result` chunk — the viewer naturally satisfies this since it lives in `ResultPage`. `scripts/check-code-split.mjs` is a build gate.
- **Testing split:** mapping correctness is tested as **pure functions in Vitest/jsdom** (no Canvas render — jsdom has no WebGL). The rendered Canvas is smoke-asserted only via the **Playwright preview-build** test.
- **Inside-out architecture:** `lib/` pure transforms before any UI depends on them — this phase is the first real `lib/` content.

### Integration Points

- The viewer (in `ResultPage`) imports the mapping function from `src/lib/` and the committed fixture JSON, maps placed boxes → mesh transforms, and renders them in the `<Canvas>`.
- drei components (`OrbitControls`/`CameraControls`/`Bounds`/`Edges`/`Grid`/`Html`) are introduced here for the first time — first real drei usage beyond the empty Canvas.

</code_context>

<specifics>
## Specific Ideas

- **Mapping reference (verify, don't trust):** mockup centres the pallet at the world origin and converts z-up→three's y-up: `x' = x - L/2`, `y' = deckTopY + base + h/2`, `z' = y - W/2`, with geometry `Box(l, h, w)`. The API gives **box-centre** positions in **mm** from the **pallet corner**. The real `done` response's exact field names/semantics (esp. `orientation.perm`, and whether dims/z are pre- or post-orientation) must be confirmed from the captured JSON.
- The fixture **must** contain a visibly rotated box — verify in the captured response that at least one placement has a non-identity orientation before locking it as the golden baseline.
- ISO/TOP/FRONT must **visibly** reframe: TOP looks straight down, FRONT looks along an axis. Auto-fit so our real-dimension fixture is always composed, while echoing the mockup's ISO feel.
- Capture flow note: the API is async (`202` then poll) — the capture script must poll to `done` before saving; budget for `failed`/`timeout` and retry with a config that the solver can actually solve (and that forces a rotation + leaves a few items unpacked, per D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Multi-pallet switcher, summary-stats rail, placement list + hover↔mesh highlight, CoG marker, support-ratio tinting, unpacked-items panel** → **Phase 6** (RESULT-03/04/05/06, DIAG-01/02). The fixture is deliberately captured rich (multi-pallet + unpacked) so these need no re-capture.
- **Request-builder** (qty→unique-ID expansion, 3-mode rotation mapping) and **result-mapper** (group-by-type/pallet, diagnostics extraction) → **Phase 3** (PACK-02, BOX-04). Phase 2's mapping function is geometry-only.
- **InstancedMesh performance optimization** (and verifying the ~100–200-box threshold empirically) → **Phase 6**.
- **Live API client + async polling, cancel, terminal-state handling** → **Phase 5** (PACK-01/04/05/06). Phase 2 capture is a manual one-off, not the runtime client.
- **Computed overlay stats** (fill % / weight / box count) → **Phase 6** (needs the Phase 3 mapper).

None of the above are scope creep into Phase 2 — they are correctly-placed later work.

</deferred>

---

_Phase: 2-Coordinate Mapping & Fixture Viewer_
_Context gathered: 2026-06-03_
</content>
</invoke>
