# Phase 6: Result Page & 3D Wiring - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the **full result vertical**: take the *real* `done` payload produced by
Phase 5 (it currently lands in the react-query cache) and turn it into an explorable
result page. Concretely, that means **replacing the committed-fixture import in
`src/routes/ResultPage.tsx` with live data**, then building everything Phase 2
deliberately deferred:

- a **whole-job summary** rail block (pallets used, utilisation, unpacked, total weight),
- a **multi-pallet switcher** (one pallet's boxes rendered at a time in the existing canvas),
- a **per-box placement list** with **hover-row → mesh-highlight**,
- a **first-class unpacked-items panel** (id, dims, weight, reason),
- and the differentiating **stability diagnostics** — a **CoG marker** in the 3D scene and **per-box support-ratio** surfacing (incl. the roadmap's "support-ratio tinting").

Delivers **RESULT-03, RESULT-04, RESULT-05, RESULT-06, DIAG-01, DIAG-02** (6 requirements).

**Success criteria (from ROADMAP.md):**
1. Configure → run a real job → explore the **actual returned** 3D packing plan in a **single persistent canvas**.
2. View **summary stats** (pallets used, utilisation, unpacked count, total weight) and **switch between generated pallets**, seeing each pallet's 3D layout + stats.
3. Browse a **per-box placement list** (id, type, position, size, orientation, weight); hovering a row **highlights the matching mesh**.
4. See **which items could not be packed**, each with its reason, in a **first-class panel**.
5. See each pallet's **centre-of-gravity** in the 3D scene and **per-box support-ratio** diagnostics from the API.

**Scope guardrail — explicitly NOT this phase:**
- **JSON / printable export** (DATA-01), the **single Docker image + SPA fallback** (HOST-01), **build-time `VITE_API_URL` + CORS verification from a non-localhost origin** (HOST-02), **GitHub self-host docs** (HOST-03) → **Phase 7**. The mockup's topbar **Export** button is therefore **omitted** this phase (D-06).
- The **scene itself is already built** (Phase 2) — wood pallet, per-type-coloured edged boxes, lights/shadows/fog/grid, ISO/TOP/FRONT presets, overlay chrome. Phase 6 **feeds it real data + adds the rail**; it does **not** rebuild the scene (C-01).
- The **coordinate mapping, request-builder, and result-mapper** are built + unit-tested (Phases 2–3) — Phase 6 **consumes** them (`mapPlacement`, `mapDoneResponse`); it does not re-derive coordinate semantics. (Exception: the CoG **point** needs a small new point-mapping — D-08.)
- The **API client / submit-poll / loading / cancel / terminal states** are done (Phase 5). Phase 6 only **reads the `done` result** Phase 5 handed off.

</domain>

<decisions>
## Implementation Decisions

### Locked carry-forward (from prior phases / PROJECT.md / CLAUDE.md — do NOT re-litigate)
- **C-01 (scene is built — swap data + add rail, don't rebuild):** The Phase-2 viewer is faithful and locked: `src/components/viewer/{Pallet,Boxes,CameraPresets,ViewerOverlay}.tsx` + `src/routes/ResultPage.tsx`. Phase 6 **feeds real per-pallet data** into `Boxes`/`Pallet` and **adds the right rail**; it does not rebuild the scene (SC-3 of Phase 2 demanded a visual match, achieved). The locked **coordinate semantics** stay untouched: `position` = box **min-corner** (API z-up mm from pallet corner), `dimensions` = **post-orientation** extents, `orientation.perm` is a **diagnostic scatter index already baked into `dimensions` — NEVER re-applied** to geometry. `mapPlacement` is the single mapping authority (golden-locked, incl. the rotated case).
- **C-02 (real in-memory result; ephemeral; no-result → redirect):** `/result` reads the **real `done` payload from the react-query cache** (`gcTime: Infinity`, Phase 5 Wave 2), **NOT** the committed `pack-done-response.json` import it uses today (Phase 5 D-05). The result is **ephemeral by design** — a hard refresh / deep-link to `/result` with **no result in memory → redirect to `/`** (Phase 5 D-06). The *config* stays autosaved to localStorage; the *result* is never persisted.
- **C-03 (idToType primary type recovery):** Type recovery is **map-PRIMARY (`idToType`) / parse-FALLBACK (`typeKeyOf`)** (Phase 3 D-07, Phase 5 C-05). `mapDoneResponse(done, idToType)` already wires this. The `idToType` map must reach `/result` from the submit. ⚠ **Open integration item (research/planner):** the done→`/result` navigation today passes **no state** and `ResultPage` hard-imports the fixture — Phase 6 must resolve **how `idToType` (+ the `done` payload / its `job_id`) reaches `/result`** (nav state, a small shared in-memory store/context, or reading the latest cache entry). The payload is in the Query cache; pick a clean carrier. If `idToType` is unavailable on a path, `typeKeyOf` fallback must still produce a coherent legend.
- **C-04 (code-split discipline holds):** `/result` stays the **lazy, three-only chunk**; `scripts/check-code-split.mjs` is the build gate. The rail is plain DOM (no three) but lives inside the lazy `ResultPage` subtree — fine. Any new **pure data-derivation** (summary aggregation, per-pallet stats, support-ratio bucketing, the CoG point-map math) belongs in **`src/lib/` and must stay `three`-free** (import `three` only as a *type* if at all) so it can be unit-tested in jsdom without a Canvas.
- **C-05 (honest over pretty; mm/kg integers):** Carry the loading-screen ethos (Phase 5 D-01) — do not editorialize beyond what the API says (drives D-04 below). Units are mm integers / kg per PROJECT.md.

### Multi-pallet & summary (discussed)
- **D-01 (selected-pallet-only canvas):** The single persistent canvas renders **only the selected pallet's boxes at a time** on the one wood-pallet model (matches the mockup's `setMeshVisibility`). Switching pallets **swaps which pallet's `items` feed `Boxes`** — reuse the existing `Boxes` component, just hand it the selected `MappedPallet`. NOT all-pallets-at-once.
- **D-02 (keep current camera view on switch):** Switching pallets **preserves the user's current orbit/zoom and active preset** (ISO/TOP/FRONT) — it does **not** auto-re-fit per switch. Rationale: every pallet shares the **same pallet footprint** (one pallet config), so re-framing each click would be jarring. (Planner: guard against a much taller stack clipping — acceptable for v1; the user can re-press a preset. The existing `CameraPresets` bbox driver still owns explicit preset re-frames.)
- **D-03 (whole-job Summary; per-pallet viewer + placement):** The rail's **Summary block is whole-job** — pallets used (`input_summary.pallets_used` / `max_pallets`), **overall utilisation = `input_summary.total_volume_utilisation`**, unpacked (`items_unpacked` / total items), and **total weight summed across all pallets**. The **viewer overlay sub-line** (Phase-2 chrome — currently static; now gets the computed `N boxes · X% fill · Y kg`) and the **placement list** are **per-selected-pallet** (`MappedPallet.utilisation`, `.totalWeight`, `.items`). Two clearly-separated scopes, exactly as the mockup splits them.
- **D-04 (drop the amber "warn" low-fill tint):** Do **NOT** port the mockup's amber low-fill `warn` treatment on pallet switcher rows. Show each pallet's fill% **neutrally** — the solver decides placement; we don't imply a quality judgment it never makes (consistent with C-05 / Phase 5 D-01). No arbitrary client-side fill threshold.
- **D-05 (pallet labeling + default — Claude's discretion within this area):** Default-select **pallet index 0** on mount. Label pallets from the **API `pallet_id`**, falling back to **"Pallet 1 / 2 / 3"** — **not** the mockup's hardcoded `A / B / C` letters. Switcher rows show index + label + box count + weight + fill% + a mini fill bar (neutral, per D-04).

### Layout & topbar scope (discussed)
- **D-06 (unpacked-items panel = conditional rail block):** RESULT-06 lands as a **dedicated rail block that appears only when `unpacked_items.length > 0`**. Each row = item id / (recovered) type / dims (L·W·H mm) / weight / **reason** (`UnpackedItem.reason`). It is **whole-job scope** (unpacked items aren't on any pallet, so it does **not** change with pallet selection) and **non-interactive** (no mesh to highlight). When everything packed, **omit the block** (a small "All items packed ✓" affordance is acceptable — planner's call). The mockup has no such panel; this is net-new but mockup-consistent in styling.
- **D-07 (omit Export + "Solved in" pill):** The topbar **omits the Export button** (DATA-01 is Phase 7 — don't ship a dead button) **and omits the "Solved in 1.84s" pill** (the `DoneResponse` contract carries **no timing field** — don't fabricate one). Honest + clean, consistent with the loading-screen "no fake %" decision.
- **D-08 (responsive: stack rail below viewer):** Below the mockup's 900px breakpoint, **do NOT hide the rail** (the mockup does, which would strand all stats/placement/unpacked on mobile). Instead **stack**: 3D viewer on top, the rail content (summary → pallets → placement → unpacked) **stacked and scrollable beneath it**, so the data stays reachable on a phone. "Web-first, responsive where practical" (PROJECT.md) — practical here means reachable, not hidden.
- **D-09 (topbar chrome — Claude's discretion within this area):** Keep the mockup's **step nav** (Configure ✓ → Result active) and an **"Edit configuration" back action** that navigates to `/` with the **draft intact** (Phase 4 localStorage autosave already preserves it — no destructive unmount). Mirror the Phase-4 Configure topbar for visual continuity.

### Claude's Discretion (areas the user did NOT pick to discuss — locked defaults from mockup + roadmap "tinting" language; downstream agents may proceed without re-asking)
- **D-10 (Stability diagnostics — DIAG-01 CoG + DIAG-02 support-ratio):**
  - **CoG marker (DIAG-01):** Render a marker at the **selected pallet's `cog`** in the 3D scene — a small sphere/crosshair plus a vertical **drop-line to the deck**, per selected pallet, ideally **toggle-able** (overlay chrome). ⚠ **`cog` is a POINT, not a placement** — `mapPlacement` maps box **min-corners**, so the CoG needs a **small new point-mapping** that reuses the *same* pallet-centre + deck-top offset conventions (centre the pallet at world origin: `x' = cog.x − L/2`, `z' = cog.y − W/2`, with the height axis mapped through the same `deckTop` offset used for boxes). **Researcher/planner: confirm the `cog` axis convention against the committed fixture** (which of `cog.{x,y,z}` is the up-axis / height) before trusting it — same empirical discipline as the Phase-2 mapping risk. Keep this point-map a **pure, three-free `src/lib/` function with a golden test**.
  - **Support-ratio (DIAG-02):** Surface the **raw `support_ratio`** as a field on each **placement card** (e.g. "support 87%"). Additionally provide the roadmap's **"support-ratio tinting"** as an **opt-in toggle** that recolours boxes as a support heatmap (well-supported → low-support); **default box colouring stays by-type** (the legend), heatmap is the alternate view. Bucketing/colour-scale math is pure `src/lib/` (three-free, tested). `mapDoneResponse` already passes `support_ratio` through raw (Phase 3 D-08) — Phase 6 is where it's visualized.
- **D-11 (Placement↔scene link = one-way hover):** Implement RESULT-05 as **one-way hover: hovering a placement row highlights the matching mesh** (emissive glow), exactly per the mockup (`mouseenter`/`mouseleave` → `material.emissive`) and SC-3. Boxes are **individual meshes** (Phase 2 D-10), so per-box emissive control is feasible. **Bidirectional (hover-mesh → highlight-row), click-to-select/isolate, and camera-focus-on-box are deferred** (see Deferred Ideas) unless a later phase wants them.
- **D-12 (InstancedMesh threshold — verify, don't pre-optimize):** Boxes are per-box individual meshes today (Phase 2 D-10); the **~100–200-box InstancedMesh threshold is an unverified estimate** (STATE.md blocker). Default to **keeping individual meshes** (they make D-11's per-box hover emissive trivial); **only** switch to `InstancedMesh` if a real captured pallet's box count empirically demands it — and note that instancing complicates per-box emissive highlight. Research/planner verifies empirically; do not pre-optimize.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase goal, requirements & scope
- `.planning/ROADMAP.md` §"Phase 6: Result Page & 3D Wiring" — the goal and the **5 success criteria** this phase is measured against; note "support-ratio **tinting**" (D-10) and "single **persistent** canvas" (SC-1 / D-01).
- `.planning/REQUIREMENTS.md` — the 6 phase requirements: **RESULT-03** (summary stats), **RESULT-04** (pallet switcher + per-pallet layout/stats), **RESULT-05** (placement list + hover↔mesh), **RESULT-06** (unpacked panel + reasons), **DIAG-01** (CoG in scene), **DIAG-02** (per-box support ratio).
- `.planning/PROJECT.md` — constraints (mm/kg integer units; no backend / stateless; "responsive where practical, native mobile out of scope" → D-08), the API context (per-item `support_ratio`/`supported_by`/`supports` + per-pallet `cog` are returned — surfaced as diagnostics here), and the Key Decisions table (the four optional features incl. multi-pallet + stability diagnostics — "Pending" → realized here).

### Visual north star (the result page to port)
- `design/result.html` — the Result-screen mockup: topbar (brand + step nav + the Export button & "Solved in" pill we **omit**, D-07), the **viewer | 384px rail** split, the **Summary 2×2** block, the **pallet switcher** rows (incl. the amber `warn` we **drop**, D-04), and the **placement cards** with the **`mouseenter` → `material.emissive` hover↔mesh highlight** (the D-11 reference). ⚠ It has **no unpacked panel and no diagnostics** — those (RESULT-06, DIAG-01/02) are net-new, styled to match. The rail note "positions are box-centre · mm · origin = pallet corner" is a label hint (but our locked semantics say `position` is **min-corner**, C-01 — render the API's actual position values).

### The data contract & the mapper (mapper OUTPUT = render INPUT)
- `src/lib/result-mapper.ts` — **`mapDoneResponse(done, idToType?) → ResultView`** — the grouped view model Phase 6 renders: `summary: InputSummary`, `pallets: MappedPallet[]` (each `{ palletId, utilisation, cog, totalWeight, items: (PlacementOut & {typeId})[] }`), `byType: Map<string, TypeAggregate>`, `unpacked: UnpackedItem[]`. **This is the primary input to the entire rail + scene.** `cog` + `support_ratio` are passed **raw** (D-08 Phase 3) — Phase 6 visualizes them.
- `src/types/pack-contract.ts` — the response contract: **`PlacementOut`** (`item_id`, `position` min-corner, `dimensions` post-orientation, `orientation{perm,name}`, `weight`, `support_ratio`, `supported_by`, `supports`), **`PalletResult`** (`pallet_id`, `dimensions`, `utilisation`, `cog`, `total_weight`, `items`), **`UnpackedItem`** (`item_id`, `dimensions`, `weight`, `reason`), **`InputSummary`** (`items_packed`, `items_unpacked`, `pallets_used`, `total_volume_utilisation`), **`Cog`** (`x,y,z`).
- `src/lib/mapping.ts` — **`mapPlacement(item, palletDims, typeKey)`** (the locked box-min-corner → Three.js transform), **`typeKeyOf`** (id-prefix fallback recovery), **`assertWithinEnvelope`** (dev AABB invariant). The CoG **point**-map (D-10) reuses these conventions but is a **new** function (cog is a point, not a placement).
- `src/lib/palette.ts` — **`colorForType(keys[])`** deterministic per-type colours (legend + box tints + placement-card swatches must share this one map).
- `src/lib/__fixtures__/pack-done-response.json` + `pack-request.json` — the **real captured** multi-pallet response (2 pallets, 7 unpacked, types D/F/T, ≥1 rotated). Still the test corpus and the **confirm-the-`cog`-axis-convention** source for D-10.

### The scene + chrome to feed real data into (Phase-2 build, now wired)
- `src/routes/ResultPage.tsx` — **the integration target.** Currently hard-imports `pack-done-response.json` and renders **pallet 0 only** with static overlay labels. Phase 6: read the **real in-memory result** (C-02/C-03), drive the **selected pallet** through `Boxes`/`Pallet` (D-01), add the **rail**, the **computed overlay sub-line** (D-03), the **CoG marker** (D-10), and the **no-result redirect** (C-02).
- `src/components/viewer/Boxes.tsx` — per-box individual meshes + `<Edges>`, `buildPalette(data)`. Reused as-is fed the **selected** pallet; the per-box hover emissive (D-11) and the support heatmap recolour (D-10) hook in here.
- `src/components/viewer/ViewerOverlay.tsx` — absolute-DOM chrome (title, dims tag, legend, hints, ISO/TOP/FRONT buttons). Currently **static labels** (D-13/D-14 of Phase 2 deferred computed stats to here) — Phase 6 adds the **computed per-pallet sub-line** and (optionally) the CoG/heatmap toggles.
- `src/components/viewer/CameraPresets.tsx` — owns ISO/TOP/FRONT framing from the live bbox; preserved across switches per D-02 (it re-frames only on explicit preset press / `presetNonce`).
- `src/components/viewer/Pallet.tsx` — the wood pallet model (length/width). Unchanged; the selected pallet's `dimensions` feed it.

### The hand-off seam (Phase-5 → Phase-6)
- `src/routes/LoadingPage.tsx` — on `done` it `navigate('/result', { replace: true })` **with no state**; the done payload lives in the react-query cache (`gcTime: Infinity`). ⚠ Phase 6 resolves how `/result` reads it + how `idToType` reaches it (C-03 open item).
- `src/router.tsx` — route table (`/` eager · `/loading` eager three-free · `/result` lazy three-only). `/result` stays lazy (C-04).
- `src/api/usePollJob.ts` + `src/api/queryClient.ts` — the poll hook + the `QueryClient` (cache key + `gcTime`) — the in-memory carrier for the `done` result (C-02).

### Stack, styling & prior-phase decisions
- `CLAUDE.md` — locked version quartet (React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / three 0.184.0 exact), drei guidance (`<Edges>`/`<Bounds>`/`<Html>`/`<OrbitControls>`), Tailwind v4 `@theme`, react-query for server state, "test scene **logic** as pure functions, not the Canvas, in jsdom" + Playwright for the rendered canvas, the InstancedMesh ~100–200 note (D-12), and the code-split rule (C-04).
- `src/styles.css` — Tailwind v4 `@theme`; the **light rail palette** (`--accent`, surfaces, `--pos`, `--warn`, borders) + the **dark 3D-overlay token group** (`--d-bg/-border/-text/-text-2`) are already ported (Phases 2/4) — reuse; port any missing result-rail token rather than inline hex.
- `.planning/phases/02-coordinate-mapping-fixture-viewer/02-CONTEXT.md` — the locked coordinate semantics (D-05/D-06), faithful-viewer build (D-07–D-13), the **explicit Phase-6 boundary list** (D-15: rail / switcher / placement / hover↔mesh / CoG / support tinting / unpacked — all land **here**), and the InstancedMesh deferral (D-10).
- `.planning/phases/03-pure-transform-core/03-CONTEXT.md` — the `mapDoneResponse` dual-axis grouping + **raw cog/support_ratio pass-through** (D-08) that this phase visualizes; the `idToType` primary / `typeKeyOf` fallback recovery (D-07).
- `.planning/phases/05-api-client-async-polling/05-CONTEXT.md` — the **in-memory ephemeral result + no-result redirect** (D-05/D-06), the done→`/result` hand-off, and the "honest over pretty" loading decision (D-01) that drives D-04/D-07 here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/result-mapper.ts` → `mapDoneResponse`** — already produces the exact `ResultView` the rail + scene render; no changes needed beyond consuming it with the real result + `idToType`.
- **`src/components/viewer/*`** — the entire faithful scene (Pallet, Boxes, CameraPresets, ViewerOverlay) is reused; Phase 6 feeds it the **selected** `MappedPallet` (D-01) and extends the overlay with computed stats + CoG marker.
- **`src/lib/mapping.ts` / `palette.ts`** — `mapPlacement` (locked transform), `typeKeyOf` (fallback recovery), `colorForType` (shared legend/swatch/tint map). The CoG point-map (D-10) is new but reuses `mapping.ts` conventions.
- **`src/lib/config-tally.ts`** — pattern for pure `src/lib/` aggregation with co-located tests; the new summary/per-pallet aggregations + support bucketing follow the same shape (three-free, jsdom-tested).
- **`src/components/Card.tsx`, `SectionLabel.tsx`** — shared chrome primitives for the rail blocks (Summary / Pallets / Placement / Unpacked).
- **`src/styles.css`** — light rail + dark overlay tokens already present.

### Established Patterns
- **Code-split gate** (`scripts/check-code-split.mjs`): `/result` is the lazy three-only chunk; new **pure derivations live in `src/lib/` and stay three-free** (testable in jsdom). (C-04)
- **Pure logic in `src/lib/` + co-located Vitest**: the summary aggregation, per-pallet stats, support-ratio bucketing, and the **CoG point-map (golden test)** are all pure functions — not WebGL — and belong here.
- **Testing split**: rail/data logic + hover-highlight wiring testable in jsdom (mock the canvas / test the data + DOM); the **rendered scene + CoG marker + heatmap** verified via the **Playwright preview-build** against a **route-intercepted** `done` response — never the live API (Phase 5 pattern).
- **Per-phase Tailwind token porting**: any missing result-rail token lands in `src/styles.css` as the rail is built.

### Integration Points
- **`done` result → `/result`**: the Phase-5/6 seam — `LoadingPage` hands the `done` payload (via the Query cache) to `/result`; Phase 6 reads it + `idToType` (C-03 open item) and runs `mapDoneResponse`.
- **`ResultView` → rail + scene**: the mapper output drives the Summary (whole-job), the switcher + viewer + placement (per selected pallet), the unpacked block, and the diagnostics.
- **Placement row ↔ mesh**: hover a placement row → set the matching box mesh's emissive (D-11); both keyed by `item_id`.
- **Selected-pallet state**: a single piece of UI state (selected pallet index) drives the canvas boxes, the viewer overlay sub-line, the placement list, and the switcher highlight (D-01/D-03).

</code_context>

<specifics>
## Specific Ideas

- **Two scopes, kept honest:** Summary = **whole job**; viewer sub-line + placement = **selected pallet**. Don't blur them (D-03).
- **One canvas, swap the boxes:** selected-pallet-only rendering on the existing scene; camera stays put across switches (D-01/D-02) — a "single persistent canvas" (SC-1) means no Canvas remount on switch.
- **Honest, again:** no amber low-fill warn (D-04), no Export button (Phase 7), no fabricated "Solved in" timing (D-07). Mirrors the loading-screen ethos.
- **Mobile must stay usable:** stack the rail under the viewer below 900px rather than hiding it (D-08).
- **Diagnostics are the differentiator — and the riskiest new bit:** the **CoG `cog` is a point**, so it needs its own map (verify the axis convention against the fixture, golden-test it) — treat with the same empirical care as the Phase-2 mapping risk (D-10). Support-ratio: card field always + heatmap as an opt-in recolour toggle (D-10).
- **Hover stays one-way** (row → mesh) per the mockup + SC-3 (D-11); fancier selection is deferred.

</specifics>

<deferred>
## Deferred Ideas

- **JSON + printable export, single Docker image + SPA fallback, build-time `VITE_API_URL` + CORS-from-real-origin verification, GitHub self-host docs** (DATA-01, HOST-01/02/03) → **Phase 7**. (The mockup's Export button is omitted here, D-07.)
- **Richer placement↔scene interaction** — bidirectional (hover-mesh → highlight-row), click-to-select / isolate a single box, camera-focus-on-box, persistent selection. Beyond RESULT-05's one-way hover (D-11); revisit only if a later phase wants it.
- **All-pallets-at-once 3D layout** (every pallet in one scene side-by-side) — rejected for v1 in favor of selected-pallet-only (D-01); a possible future "overview" mode.
- **InstancedMesh box rendering** for large pallets — verify the ~100–200 threshold empirically before adopting; it complicates per-box hover emissive (D-12).
- **Amber low-fill / quality warnings on pallets** — deliberately dropped as editorializing the solver (D-04); could return if a real "this pallet is under-utilized" signal is ever defined.
- **v2 result features** — 2D top-down layer view (RES-V2-01), step-by-step load sequence (RES-V2-02), PNG snapshot (RES-V2-03), true PDF export (RES-V2-04) — not this phase.

None of the above are scope creep into Phase 6 — they are correctly-placed later work.

</deferred>

---

*Phase: 6-Result Page & 3D Wiring*
*Context gathered: 2026-06-05*
