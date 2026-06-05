# Phase 6: Result Page & 3D Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 6-Result Page & 3D Wiring
**Areas discussed:** Multi-pallet & summary, Layout & topbar scope
**Areas offered but not selected:** Stability diagnostics, Placement↔scene link (locked as Claude's discretion)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Stability diagnostics | CoG marker (DIAG-01) + support-ratio (DIAG-02); undesigned in the mockup | |
| Placement↔scene link | RESULT-05 hover/click/bidirectional interaction depth | |
| Multi-pallet & summary | RESULT-04 + RESULT-03; canvas content, camera, summary scope, warn tint | ✓ |
| Layout & topbar scope | Rail port, unpacked panel, Export/pill, responsive | ✓ |

**User's choice:** Multi-pallet & summary; Layout & topbar scope.
**Notes:** The two unpicked areas were locked with mockup + roadmap-derived defaults (see Claude's Discretion below); user confirmed "I'm ready for context" rather than exploring them.

---

## Multi-pallet & summary

### Q1 — Canvas content on pallet switch
| Option | Description | Selected |
|--------|-------------|----------|
| Selected pallet only | Mockup `setMeshVisibility` behavior; one pallet's boxes on the single wood-pallet model | ✓ |
| All pallets at once | Lay every pallet in a row; selected highlighted — heavier scene, new layout math | |

### Q2 — Camera behavior on switch
| Option | Description | Selected |
|--------|-------------|----------|
| Keep current view | Preserve orbit/zoom + active preset; footprint identical pallet-to-pallet | ✓ |
| Re-fit to new pallet | Re-frame to new bbox each switch — more correct but jumpy | |

### Q3 — Summary block scope
| Option | Description | Selected |
|--------|-------------|----------|
| Whole-job aggregate | Mockup split: Summary = whole job; viewer + placement per-selected-pallet | ✓ |
| Per-selected-pallet | One scope everywhere; loses whole-job picture | |

### Q4 — Mockup's amber low-fill "warn" tint
| Option | Description | Selected |
|--------|-------------|----------|
| Drop the warn tint | Honest over pretty (D-01 carry-forward); neutral fill%, no threshold | ✓ |
| Keep amber warn | Flag low-fill pallets — implies a judgment the solver never makes | |

**User's choice:** Selected-pallet-only · keep current view · whole-job Summary · drop warn tint.
**Notes:** Pallet labeling/default selection left to Claude (index 0 default; label from `pallet_id`, fallback "Pallet 1/2/3", not the mockup's A/B/C).

---

## Layout & topbar scope

### Q1 — Unpacked-items panel (RESULT-06; absent from mockup)
| Option | Description | Selected |
|--------|-------------|----------|
| Conditional rail block | Dedicated block, only when unpacked > 0; rows id/type/dims/weight/reason; whole-job; non-interactive | ✓ |
| Tab toggle with Placement | Share a block via Placement/Unpacked tabs — hides one behind the other | |
| Always-visible block | Always render even at 0 — spends rail space on the common all-packed case | |

### Q2 — Topbar Export button + "Solved in" pill
| Option | Description | Selected |
|--------|-------------|----------|
| Omit both | No dead Export (Phase 7); no fabricated timing pill (no API field) | ✓ |
| Neutral pill, no Export | Drop Export, keep a neutral "Packed/Done" pill | |
| Stub Export + neutral pill | Disabled "Export (soon)" + neutral pill placeholders | |

### Q3 — Responsive behavior below 900px (mockup hides the rail)
| Option | Description | Selected |
|--------|-------------|----------|
| Stack rail below viewer | Viewer on top, rail content stacked + scrollable beneath — reachable on mobile | ✓ |
| Match mockup (hide rail) | Viewer-only below 900px — strands stats/placement/unpacked on a phone | |

**User's choice:** Conditional unpacked block · omit Export + pill · stack rail below viewer on narrow screens.
**Notes:** Topbar step nav + "Edit configuration" → `/` (draft intact) left to Claude.

---

## Claude's Discretion

- **Stability diagnostics (DIAG-01/02)** — CoG: marker + drop-line at the selected pallet's `cog`, mapped via a NEW pure point-map (verify the cog axis convention against the fixture, golden-test it), toggle-able. Support-ratio: field on each placement card + an opt-in "support heatmap" recolour toggle (roadmap "support-ratio tinting"); default colouring stays by-type.
- **Placement↔scene link (RESULT-05)** — one-way hover row → mesh emissive highlight, per the mockup + SC-3; click-select/isolate/bidirectional/camera-focus deferred.
- **InstancedMesh** — keep per-box individual meshes (simpler hover emissive); only adopt instancing if a real pallet's box count empirically demands it.
- **Pallet labeling & default selection** — index 0 default; label from `pallet_id`, fallback "Pallet 1/2/3".
- **Topbar chrome** — keep mockup step nav + "Edit configuration" back action → navigate('/') with draft intact (Phase 4 autosave).

## Deferred Ideas

- JSON + printable export, single Docker image + SPA fallback, build-time `VITE_API_URL`/CORS verification, GitHub docs (DATA-01, HOST-01/02/03) → Phase 7.
- Richer placement↔scene interaction (bidirectional, click-to-select/isolate, camera focus) → later.
- All-pallets-at-once 3D overview mode → rejected for v1 (selected-pallet-only).
- InstancedMesh for large pallets → verify threshold first.
- v2 result features (2D layer view, load sequence, PNG snapshot, true PDF) → v2.
