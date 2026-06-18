# Phase 8: Assembly Insight — Layer Explode & Isolation in the 3D Viewer - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make a **densely-packed pallet legible** — boxes hidden deep inside the stack become
visible and their placement understandable — by adding **two complementary, composable
controls** to the *existing* `/result` 3D viewer, both driven by **one shared, pure,
three-free `computeLayers(placements)` model**:

1. **Explode** — a slider that vertically separates the solver's layers (0 = the true
   assembled stack → max = clearly gapped, **animated**).
2. **Layer-focus** — a control that reveals layers **cumulatively from the floor up**
   (build-up) **or isolates a single layer**, dimming/hiding the rest.

Layers come from `computeLayers(placements)` (base-z banding, tolerant of tall/floating
boxes) so the math stays unit-testable and the viewer stays in the lazy `/result` chunk.

**Success criteria (from ROADMAP.md §Phase 8):**
1. Pure `computeLayers(placements)` groups each pallet's boxes into ordered layers by base
   z (with tolerance), unit-tested incl. single-layer, uneven-height, and tall/floating
   cases — imports no three/r3f (code-split gate stays green).
2. An "Explode" control animates the layers apart vertically: 0 reproduces the true
   assembled stack, higher values clearly gap each layer; the CoG marker + pallet wireframe
   behave sensibly while exploded.
3. A "Layers" control reveals layers cumulatively (build-up) and/or isolates a single
   layer, dimming or hiding non-focused layers; default is all-visible + assembled (no
   behavior change until used).
4. The new controls compose without regression with the ISO/TOP/FRONT presets, CoG +
   support-heatmap toggles, the pallet switcher, and placement-list hover highlighting.
5. Works on real multi-layer results (the demo presets) at interactive frame rates.

**Depends on:** Phase 6 (the result page + 3D viewer). NOT Phase 7 — this is purely a
viewer-comprehension layer over the existing scene.

**Scope guardrail — explicitly NOT this phase:**
- Rebuilding the scene, the coordinate mapping, the mapper, the rail blocks, or the
  diagnostics — all built in Phases 2/3/6 and **consumed** here, not re-derived.
- A 2D top-down layer view, a step-by-step load *animation* sequence, all-pallets-at-once
  overview, or per-layer stats in the rail → later/other work (see Deferred Ideas).
- New API calls or data — `computeLayers` derives layers purely from the already-mapped
  placements in memory.

</domain>

<decisions>
## Implementation Decisions

### Locked carry-forward (from Phase 6 / Phase 2 / PROJECT.md — do NOT re-litigate)
- **L-01 (selected-pallet-only, one persistent Canvas, individual meshes):** The viewer
  renders **only the selected pallet's boxes** in ONE persistent `<Canvas>` (Phase 6 D-01);
  `Boxes.tsx` is **per-box individual meshes** inside a single `<group ref>` (Phase 6 D-12,
  ~19 boxes — far below any instancing threshold). Layer controls operate on **the selected
  pallet's `MappedPallet.items` only**.
- **L-02 (coordinate semantics locked):** `mapPlacement` (`src/lib/mapping.ts`) consumes
  ONLY `position` (API min-corner, z-up mm) + `dimensions` (post-orientation extents);
  `orientation.perm` is diagnostic and **never re-applied**. A box's world centre is
  `center.y = DECK_TOP_Y + position.z + H/2`. **`computeLayers` MUST band by the API
  base-z = `position.z`** so layers line up with this mapping.
- **L-03 (CameraPresets owns framing; camera preserved on switch):** `CameraPresets`
  measures the boxes-group bbox and is the single framing authority; Phase 6 D-02 keeps the
  camera fixed on a pallet switch and re-frames only on an explicit ISO/TOP/FRONT press.
  (Phase 8 introduces ONE deliberate exception — see D-05.)
- **L-04 (overlay = absolute DOM, not drei `<Html>`):** All viewer chrome is
  absolute-positioned DOM over the Canvas (`pointer-events:none` except interactive
  controls), using the dark-overlay `--color-d-*` token group. The new control bar follows
  this pattern (Phase 2 decision, see `ViewerOverlay.tsx`).
- **L-05 (code-split discipline):** `/result` is the lazy three-only chunk;
  `scripts/check-code-split.mjs` is the build gate. **`computeLayers` and any layer math
  live in `src/lib/`, stay three-free** (import three as a *type* only, if at all), and are
  jsdom-unit-tested — same shape as `mapping.ts` / `result-summary.ts` / `cog-map.ts`.
- **L-06 (honest over pretty; existing diagnostics + hover):** CoG default ON, support
  heatmap default OFF (Phase 6 D-10); one-way placement-row → mesh emissive hover (Phase 6
  D-11). Don't editorialize beyond what the API says (C-05). Phase 8 must compose with all
  of these without regression (SC-4).

### Control UI & layout
- **D-01 (new bottom-center control bar):** Both controls live in a **dedicated
  bottom-center control strip** — separate from the top-center diagnostic toggles (CoG /
  heatmap) and the bottom-right presets. Sliders need width + room for labels; the corners
  stay as-is. Absolute DOM per L-04, dark-overlay tokens + existing pill/button styling.
- **D-02 (always visible, at no-op defaults):** The controls are **always shown** but sit
  at their **no-op defaults** (explode = 0, all layers visible, mode = build-up-full). The
  scene is therefore **unchanged until the user touches a control** (SC-3) while the feature
  stays discoverable at a glance. NOT hidden behind a disclosure toggle.
- **D-03 (desktop-first):** Prioritize the desktop experience. Controls may reflow on
  mobile but **no bespoke phone layout** is built — this is a power-user comprehension
  feature; phones are secondary (a narrowing of Phase 6 D-08 for this specific control set).

### Explode dynamics
- **D-04 (uniform additive gap):** As the slider rises, **layer `i` lifts by
  `i × (slider × fixedUnit)`** so the **gap between consecutive layers is equal** regardless
  of layer thickness. Predictable; easy to read which layer is which. (Exact `fixedUnit`
  magnitude + slider range = planner's call.)
- **D-05 (camera AUTO-FITS to the exploded bbox):** As explode changes, the camera
  **re-frames to keep the growing (taller) stack in view**. This is a **deliberate,
  explode-specific exception to L-03/Phase-6 D-02** — D-02 still governs pallet switches
  (camera preserved) and explicit preset presses still own their framing.
  ⚠ **Planner note:** `CameraPresets` today re-frames only on `presetNonce` change and
  re-measures (without re-framing) on `measureNonce` (= `selIndex`). Phase 8 must make an
  **explode change trigger a re-fit** while a **pallet switch still does NOT** re-frame —
  reconcile these two triggers carefully (don't let the explode-refit path also fire on
  switch).
- **D-06 (hide the CoG marker while exploded):** When `explode > 0`, **hide the CoG
  marker**; re-show it at explode = 0. The CoG refers to the *assembled* stack, which the
  exploded view no longer matches — hiding avoids a misleading floating marker (SC-2
  "behave sensibly"). The **pallet deck/wireframe stays at the base**; layers lift away
  from it.
- **D-07 (explode is animated):** The explode transition is **animated** (spring/tween) per
  the goal — not an instant jump. Easing/duration = implementer's discretion.

### Layer-focus model
- **D-08 (one slider + Build-up/Isolate mode toggle):** A **single layer slider (0…N)**
  plus a small **Build-up / Isolate mode toggle**. Build-up = show layers `1..k`; Isolate =
  show only layer `k`. Both behaviors come from the one slider. **Layers number floor-up**
  (Layer 1 = bottom).
- **D-09 (build-up HIDES, isolate DIMS):** In **Build-up**, the upper not-yet-revealed
  layers are **hidden** (natural "assembling" feel). In **Isolate**, the non-focused layers
  become **translucent ghosts** (dimmed, not removed) so the user keeps spatial context of
  where the focused layer sits in the stack.

### Compose & reset rules
- **D-10 (fully composable):** Explode + Layer-focus **compose simultaneously** (locked by
  the goal's "two complementary, composable controls"). E.g. build-up to layer `k` AND
  explode the visible layers apart. Isolate + explode = a single layer → explode is a
  harmless visual no-op (do NOT disable it).
- **D-11 (reset both on pallet switch):** Switching pallets **resets explode → 0 and
  layer-focus → default (all visible / build-up-full)**. A layer index from pallet A is
  meaningless on pallet B (different layer counts), so each pallet starts from the honest
  assembled view. The **camera is still preserved** across the switch (D-02 / L-03).
- **D-12 (placement rows DRIVE focus):** Clicking a placement-list row **isolates that
  box's layer** (sets mode = Isolate, focus index = the row's layer, **revealing it if
  currently hidden**). The existing one-way **hover↔mesh emissive highlight (Phase 6 D-11)
  keeps working unchanged**. This **expands `PlacementList` with a new click interaction** —
  net-new but **in-scope** because it serves SC-4 (controls compose with the placement
  list). Requires mapping each placement `item_id` → its layer index (from `computeLayers`
  output).

### Claude's Discretion
- **`computeLayers` semantics (D-13, locked default — researcher refines):** Pure,
  three-free `src/lib/computeLayers(placements)`. **Band boxes by base-z (`position.z`)
  with a tolerance**; each box is assigned to the layer of its **base** (tall boxes counted
  at their base layer even if they visually span into the next band — acceptable). A clear
  vertical gap (> tolerance) above a band starts a new band. Output: **ordered layers
  (floor-up)**, each exposing its member `item_id`s and base-z (and ideally top-z) so the
  viewer can offset/dim/hide per layer and resolve **item → layer** for D-12. **Researcher
  confirms the tolerance value + tall/floating handling against the real demo-preset
  results** (same empirical discipline as the Phase-2 mapping risk). Unit-test single-layer,
  uneven-height, and tall/floating cases (SC-1).
- Exact slider ranges/ticks/labels, the explode `fixedUnit` magnitude, animation
  duration/easing, ghost opacity value, and the precise bottom-bar geometry/styling — all
  implementer's call within the decisions above (follow the dark-overlay token group + the
  existing pill-button look in `ViewerOverlay.tsx`).
- Whether the layer show/hide is animated (a quick opacity fade is natural for the
  isolate-dim path) or instant — not load-bearing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase goal, requirements & scope
- `.planning/ROADMAP.md` §"Phase 8: Assembly Insight — Layer Explode & Isolation in the 3D
  Viewer" — the goal and the **5 success criteria** this phase is measured against (note
  "base-z banding", "0 reproduces the true assembled stack", "default is all-visible +
  assembled", and the explicit compose-without-regression list).
- `.planning/REQUIREMENTS.md` — **Requirements are TBD** for this phase ("a new
  viewer-comprehension requirement to be mapped during planning" per ROADMAP). Planner maps
  one (or more) here; the 5 SC are the working acceptance contract until then.
- `.planning/PROJECT.md` — constraints (mm/kg integer units; stateless / no backend; "web-
  first, responsive where practical, native mobile out of scope" → D-03) and the locked
  version quartet context.

### The shared layer model (the NEW pure module) + its data input
- `src/lib/result-mapper.ts` — **`mapDoneResponse` → `ResultView`**; the selected pallet's
  **`MappedPallet.items: (PlacementOut & { typeId })[]`** is the **input to
  `computeLayers`**. (cog + support_ratio pass through raw.)
- `src/lib/mapping.ts` — **`mapPlacement`** (the locked min-corner→Three.js transform) +
  **`DECK_TOP_Y`**. `computeLayers` bands by the same API `position.z` base axis these use
  (L-02); the per-layer vertical explode offset is applied on top of `center.y`.
- `src/types/pack-contract.ts` — **`PlacementOut`** (`item_id`, `position` min-corner,
  `dimensions` post-orientation, `weight`, `support_ratio`), **`PalletResult`**, **`Cog`** —
  the field shapes `computeLayers` and the viewer read.
- `src/lib/__fixtures__/pack-done-response.json` — the real captured multi-pallet response;
  the corpus for confirming the **layer-banding tolerance + tall/floating handling** (D-13).
  ⚠ Also validate against the **demo-catalog presets** (see Quick Task `260617-w8a`) — the
  multi-layer "wow" results this feature is really for.

### The scene + chrome to extend (Phase-2/6 build — do NOT rebuild)
- `src/routes/ResultPage.tsx` — **the integration target + viewer-state owner.** Holds
  `sel` / `hoveredId` / `cogOn` / `heatmap` / `active` / `presetNonce`. Phase 8 adds the
  **explode amount + layer-focus (mode + index) state** here, computes `computeLayers` from
  `selMapped.items`, passes per-layer info to `Boxes`, wires the bottom-bar controls, the
  D-12 row-click → focus, the D-05 explode-refit trigger, and the D-06 CoG hide-while-
  exploded. Resets explode/focus on `setSel` (D-11).
- `src/components/viewer/Boxes.tsx` — per-box individual meshes in one `<group>`; tints by
  `typeId` (or heatmap). Phase 8 adds **per-box vertical explode offset + per-layer
  visibility/opacity** (each box knows its layer). Keep the declarative-prop pattern (no
  imperative material mutation) — mirrors the D-11 hover-emissive approach.
- `src/components/viewer/ViewerOverlay.tsx` — the absolute-DOM chrome (top-center toggles,
  bottom-right presets, bottom-left hints, legend). The **new bottom-center control bar**
  (D-01) is added here (or a sibling overlay component) following the same token/styling +
  `pointer-events` rules.
- `src/components/viewer/CameraPresets.tsx` — bbox-measuring framing authority. Phase 8
  wires the **explode-driven auto-fit** (D-05) WITHOUT breaking the preserve-on-switch
  behavior (D-02). Read its `presetNonce` / `measureNonce` mechanics before changing.
- `src/components/viewer/CogMarker.tsx` — the CoG marker; Phase 8 **hides it while
  exploded** (D-06). Currently fed the selected pallet's `cog` + footprint by ResultPage.
- `src/components/viewer/Pallet.tsx` — the wood pallet/deck model; **stays at the base** as
  layers lift away (D-06). Unchanged.
- `src/components/result/PlacementList.tsx` — gains the **row-click → isolate-that-layer**
  interaction (D-12) on top of its existing `onHover`. (Read the current file; it's fed
  `selMapped.items` + `onHover` by ResultPage.)

### Stack, styling & prior-phase decisions
- `CLAUDE.md` — locked version quartet (React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / three
  0.184.0 exact), drei guidance, Tailwind v4 `@theme`, "test scene **logic** as pure
  functions, not the Canvas, in jsdom" + Playwright for the rendered canvas, and the
  code-split rule (L-05).
- `src/styles.css` — Tailwind v4 `@theme`; the dark 3D-overlay token group
  (`--color-d-bg/-border/-text/-text-2`) the new control bar reuses.
- `scripts/check-code-split.mjs` — the build gate that keeps three out of the eager chunk;
  `computeLayers` must stay three-free to pass it (L-05).
- `.planning/phases/06-result-page-3d-wiring/06-CONTEXT.md` — the locked viewer decisions
  Phase 8 builds on: D-01 selected-pallet-only / single canvas, D-02 camera-preserved-on-
  switch, D-10 CoG/heatmap diagnostics, D-11 one-way hover↔mesh, D-12 individual meshes.
- `.planning/phases/02-coordinate-mapping-fixture-viewer/02-CONTEXT.md` — the locked
  coordinate semantics (L-02) and CameraPresets framing-ownership rules (L-03).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/result-mapper.ts` (`MappedPallet.items`)** — ready-made input for
  `computeLayers`; no mapper change needed.
- **`src/lib/mapping.ts` (`mapPlacement`, `DECK_TOP_Y`)** — the box transform the explode
  offset rides on; `DECK_TOP_Y` is the shared deck height the deck/drop-line use.
- **`src/lib/result-summary.ts` / `cog-map.ts` / `support-scale.ts`** — the established
  shape for a small pure three-free `src/lib/` module with a co-located golden/synthetic
  test. `computeLayers` follows this exactly.
- **`src/components/viewer/Boxes.tsx`** — already maps + tints per-box; extend with explode
  offset + per-layer visibility using the same `useMemo` + declarative-prop pattern.
- **`src/components/viewer/ViewerOverlay.tsx`** — the chrome pattern (absolute DOM, dark
  tokens, pill buttons, `role=switch` toggles) the new bottom bar mirrors.
- **`src/components/result/PlacementList.tsx`** — existing per-pallet card list with
  `onHover`; add the row-click → focus seam (D-12).

### Established Patterns
- **Pure logic in `src/lib/` + co-located Vitest, three-free** (L-05): `computeLayers` and
  the explode-offset math (if extracted) belong here, jsdom-tested without a Canvas.
- **Declarative r3f prop updates** (no imperative `material.*` mutation): the Phase-6 hover
  emissive + heatmap recolour set the precedent; explode offset (`position`) and layer
  opacity/visibility should likewise be derived props, not imperative scene edits.
- **Testing split:** layer math + item→layer mapping + control state logic → jsdom unit
  tests; the rendered exploded/isolated scene + camera auto-fit + CoG-hide → Playwright
  preview-build against a **route-intercepted** `done` response (never the live API).
- **Single source of viewer state in `ResultPage.tsx`** — add explode/focus state here
  alongside `sel`/`hoveredId`/toggles; reset on `setSel` (D-11).

### Integration Points
- **`computeLayers(selMapped.items)` → Boxes + controls + PlacementList:** one derived layer
  model drives the explode offsets, the build-up/isolate visibility/opacity, the slider's
  max (= layer count), and the item→layer lookup for D-12.
- **Explode change → CameraPresets re-fit (D-05) + CogMarker hide (D-06):** new triggers
  off the explode value, kept separate from the pallet-switch path (D-02).
- **PlacementList row click → ResultPage focus state (D-12):** isolate the row's layer;
  hover stays the existing one-way emissive link.
- **`setSel` → reset explode + focus (D-11):** the pallet-switch path clears the new state.

</code_context>

<specifics>
## Specific Ideas

- **Always-on but invisible-until-used:** controls always render, but at defaults the scene
  is byte-for-byte the assembled Phase-6 view (D-02/SC-3). Honesty first.
- **Equal gaps read best:** uniform additive spacing between layers (D-04), not
  proportional — the user wants to *count and identify* layers, not see a literal unfold.
- **Camera should follow the explosion:** the user explicitly wants the exploded stack to
  **stay framed** (auto-fit, D-05), accepting the deliberate departure from the
  camera-stays-put rule that governs pallet switches.
- **Don't show a CoG that's no longer true:** hide it the moment the stack is exploded
  (D-06) rather than leave a marker floating among spread layers.
- **Isolate keeps context, build-up doesn't need it:** isolate dims the rest to ghosts;
  build-up just hides what isn't "placed yet" (D-09).
- **The placement list is a layer remote:** clicking a row should jump the viewer to that
  box's isolated layer (D-12) — the most integrated option, chosen over a passive layer-
  number column.

</specifics>

<deferred>
## Deferred Ideas

- **Passive "Layer N" label per placement row** — a read-only layer column was an option;
  the user chose the richer row-click→isolate (D-12) instead. A small layer label MAY still
  accompany the clickable row (planner discretion) but is not required.
- **2D top-down per-layer view** (RES-V2-01) and a **step-by-step load *sequence*
  animation** (RES-V2-02) — adjacent comprehension features, but distinct from explode/
  isolate; not this phase.
- **All-pallets-at-once overview** — still deferred (Phase 6 D-01 selected-pallet-only).
- **Per-layer stats in the rail** (weight/count/fill per layer) — a possible future
  enhancement once layers are modeled; out of scope here (this phase is viewer-only).
- **InstancedMesh for large pallets** — still a verify-don't-pre-optimize item (Phase 6
  D-12); individual meshes keep per-box explode offset + emissive trivial. Only revisit if a
  real pallet's box count empirically demands it (and note it complicates per-box transforms).

None of the above are scope creep into Phase 8 — they are correctly-placed later work.

</deferred>

---

*Phase: 8-Assembly Insight — Layer Explode & Isolation in the 3D Viewer*
*Context gathered: 2026-06-19*
