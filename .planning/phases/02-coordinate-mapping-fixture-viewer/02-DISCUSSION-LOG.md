# Phase 2: Coordinate Mapping & Fixture Viewer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 2-Coordinate Mapping & Fixture Viewer
**Areas discussed:** Fixture scenario & capture, Viewer visual fidelity, Camera presets & controls, Phase-2 / Phase-6 boundary

---

## Fixture scenario & capture

### Q1 — How do we obtain the real `done` response that becomes the committed golden fixture?

| Option                      | Description                                                                                                                               | Selected |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| I capture it via curl/proxy | Claude POSTs a config to packerapi.anzozulia.xyz (or via the Vite /api proxy), polls to `done`, saves raw JSON. Fastest; assumes no auth. | ✓        |
| You run it, hand me JSON    | User (API author) submits a trusted config, confirms a rotated box, hands over the response.                                              |          |
| I capture, you sanity-check | Claude captures, but shows config + response for confirmation before locking.                                                             |          |

**User's choice:** I capture it via curl/proxy
**Notes:** Claude will design a catalog that forces a rotated placement and capture the response. Assumes the author-controlled API needs no auth key (to be confirmed at execution).

### Q2 — What should the captured fixture scenario look like?

| Option                     | Description                                                                                                      | Selected |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| Multi-pallet, rich catalog | 2–3 pallets, 3+ box types, ≥1 forced rotation, a few unpacked items. Future-proofs Phases 3 & 6 — no re-capture. | ✓        |
| Single dense pallet        | One pallet, 3 mockup-style types, ≥1 rotation. Simplest; richer capture later for Phase 6.                       |          |
| Multi-pallet, no unpacked  | 2–3 pallets, 3+ types, ≥1 rotation, everything fits (no unpacked).                                               |          |

**User's choice:** Multi-pallet, rich catalog
**Notes:** Phase 2 viewer renders pallet 1 only; the rich multi-pallet + unpacked fixture serves Phases 3 and 6 without a re-capture. Claude noted a sensible default: commit the request alongside the response (reproducibility + Phase 3 reference) — accepted without objection.

---

## Viewer visual fidelity

### Q1 — How faithfully should the Phase 2 static viewer reproduce the mockup's scene?

| Option                  | Description                                                                                                                       | Selected |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Faithful to mockup      | Wood pallet model, full lighting, soft shadows, ground+grid, fog, edge-lines, tinting. Phase 6 then just swaps fixture→real data. | ✓        |
| Structured but unstyled | Correct pallet shape + colored boxes + basic lighting + grid; skip shadows/fog/wood.                                              |          |
| Lean proving scene      | Flat platform, 1–2 lights, colored boxes with edges; defer nearly all styling to Phase 6.                                         |          |

**User's choice:** Faithful to mockup
**Notes:** Aligns with SC-3 ("visually matching design/result.html"). Claude noted sensible defaults accepted without objection: port the dark-overlay Tailwind tokens now, deterministic palette seeded by the mockup's three colours, per-box meshes (instancing deferred to Phase 6).

---

## Camera presets & controls

### Q1 — How should orbit/zoom/pan and the ISO/TOP/FRONT presets be implemented?

| Option                     | Description                                                                                                                   | Selected |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| drei + auto-fit framing    | drei OrbitControls/CameraControls; presets computed from the scene bounding box (Bounds/fit) so any fixture frames correctly. | ✓        |
| drei + hardcoded positions | drei OrbitControls but presets driven by the mockup's fixed positions; must be re-tuned to our fixture's real size.           |          |
| Port mockup wholesale      | Reproduce the mockup's manual OrbitControls + lerpVectors as closely as possible.                                             |          |

**User's choice:** drei + auto-fit framing
**Notes:** Chosen because the captured fixture has real, different dimensions than the mockup's hardcoded 12-box scene, so hardcoded camera positions would mis-frame it. Feel defaults (animated transitions, damping, polar clamp above ground, scene-sized zoom limits) accepted without objection.

---

## Phase-2 / Phase-6 boundary

### Q1 — How much of the mockup's on-canvas viewer chrome should land in Phase 2?

| Option                    | Description                                                                                                                         | Selected |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Legend + buttons + header | Legend + ISO/TOP/FRONT buttons + dark overlay header (pallet name, dims tag, control hints). Static labels only; no computed stats. | ✓        |
| Legend + buttons only     | Just the required legend + ISO/TOP/FRONT buttons; full header built in Phase 6.                                                     |          |
| Header incl. live stats   | Adds fill%/weight/box-count to the overlay sub-line. ⚠ Flagged as possible scope creep into Phase 6.                                |          |

**User's choice:** Legend + buttons + header
**Notes:** The full right rail (summary, switcher, placement list, hover-highlight, diagnostics) is deferred to Phase 6 regardless. Overlay header carries static labels only — computed fill%/weight need the Phase 3 mapper and stay in Phase 6.

---

## Claude's Discretion

- Fixture file location/format (e.g. `src/lib/__fixtures__/done-response.json` + `request.json`).
- Exact pure-function signature and return shape (position/size/orientation representation).
- Dev-mode AABB sanity-assertion mechanism and where it fires.
- Palette-extension scheme beyond the mockup's three colours.
- Exact preset camera angles/distances and transition easing.
- Overlay implementation: drei `<Html>` vs absolute-positioned DOM over the `<Canvas>`.

## Deferred Ideas

- Multi-pallet switcher, summary-stats rail, placement list + hover↔mesh highlight, CoG marker, support-ratio tinting, unpacked panel → **Phase 6**.
- Request-builder + result-mapper → **Phase 3**.
- InstancedMesh performance optimization (verify ~100–200 threshold) → **Phase 6**.
- Live API client + async polling/cancel/terminal-state handling → **Phase 5**.
- Computed overlay stats (fill%/weight/box-count) → **Phase 6**.

---

## Research Items Carried Into Planning (not user decisions)

- `orientation.perm` gather-vs-scatter semantics, and whether `position.z` / `dimensions` are pre- or post-orientation — to be resolved **empirically from the captured `done` response**, never guessed. This is the roadmap's flagged research item and the reason a real fixture is captured before the mapper is written.
  </content>
