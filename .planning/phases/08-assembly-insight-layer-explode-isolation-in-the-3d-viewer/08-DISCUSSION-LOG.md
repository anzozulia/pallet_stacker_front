# Phase 8: Assembly Insight — Layer Explode & Isolation in the 3D Viewer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 8-assembly-insight-layer-explode-isolation-in-the-3d-viewer
**Areas discussed:** Control UI & layout, Explode dynamics, Layer-focus model, Compose & reset rules

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Control UI & layout | Where/how the Explode + Layers controls live in the overlay | ✓ |
| Explode dynamics | Gap formula, camera behavior, CoG/wireframe while exploded | ✓ |
| Layer-focus model | Cumulative vs isolate; dim vs hide | ✓ |
| Compose & reset rules | Simultaneity, reset-on-switch, placement-list link | ✓ |

**User's choice:** All four areas.

---

## Control UI & layout

### Placement
| Option | Description | Selected |
|--------|-------------|----------|
| New bottom-center bar | Dedicated strip for the two sliders, separate from top toggles + presets | ✓ |
| Extend top-center cluster | Add to the CoG/heatmap pill row | |
| Collapsible side panel | Expandable 'Insight' panel; cleanest canvas, adds disclosure | |

### Visibility
| Option | Description | Selected |
|--------|-------------|----------|
| Always visible, at defaults | Shown but at no-op defaults; scene unchanged until touched, discoverable | ✓ |
| Behind a toggle | Hidden until an 'Assembly insight' button is clicked | |

### Mobile
| Option | Description | Selected |
|--------|-------------|----------|
| Same controls, compact | Same controls sized down | |
| Best-effort, desktop-first | Prioritize desktop; controls reflow, no bespoke phone layout | ✓ |

**Notes:** Bottom-center bar follows the absolute-DOM + dark-overlay-token chrome pattern.

---

## Explode dynamics

### Spread
| Option | Description | Selected |
|--------|-------------|----------|
| Uniform additive gap | Equal gap between consecutive layers regardless of thickness | ✓ |
| Proportional to layer height | Gap scales with each layer's thickness; uneven | |
| Scale whole stack ×N | Stretch entire stack to N×; gaps depend on position | |

### Camera
| Option | Description | Selected |
|--------|-------------|----------|
| Stay put (re-press preset) | Consistent with Phase 6 D-02; simplest | |
| Dolly back only | Keep angle/target, pull camera back | |
| Auto-fit to exploded bbox | Continuously re-frame to the growing bbox; smoothest | ✓ |

### CoG / deck
| Option | Description | Selected |
|--------|-------------|----------|
| Keep both truthful | CoG stays at real assembled position; may float in a gap | |
| Hide CoG while exploded | Auto-hide CoG once explode > 0; re-show at 0 | ✓ |
| Dim/fade CoG while exploded | Keep but de-emphasize | |

**Notes:** Auto-fit is a deliberate explode-specific exception to D-02 (which still governs
pallet switches + explicit presets). Pallet deck/wireframe stays at the base.

---

## Layer-focus model

### Interaction
| Option | Description | Selected |
|--------|-------------|----------|
| One slider + mode toggle | Single layer slider (0…N) + Build-up/Isolate toggle | ✓ |
| Build-up slider + click-to-isolate | Slider reveals cumulatively; click a layer to isolate | |
| Two separate controls | Dedicated build-up slider AND separate isolate picker | |

### Non-focus treatment
| Option | Description | Selected |
|--------|-------------|----------|
| Build-up hides, isolate dims | Build-up hides upper layers; isolate ghosts the rest | ✓ |
| Always hide | Non-focused layers removed in both modes | |
| Always dim (ghosts) | Non-focused layers always translucent | |

**Notes:** Layers number floor-up (Layer 1 = bottom).

---

## Compose & reset rules

### On pallet switch
| Option | Description | Selected |
|--------|-------------|----------|
| Reset both to defaults | Explode → 0, focus → all-visible; camera still preserved | ✓ |
| Keep explode, reset focus | Persist explode as a global preference, reset focus | |
| Keep both, clamp index | Persist all; clamp focus index to new pallet's range | |

### Placement list link
| Option | Description | Selected |
|--------|-------------|----------|
| Flat list, hover composes | List unchanged; hidden-row hover is a harmless no-op | |
| Also show layer number | Annotate each row with its layer index (read-only) | |
| Rows drive focus | Clicking a row isolates that row's layer | ✓ |

**Notes:** Rows-drive-focus expands PlacementList with a new click interaction — accepted as
in-scope for SC-4 composition. Hover↔mesh emissive highlight is preserved unchanged. Full
composability of Explode + Layer-focus was treated as locked by the goal and not re-asked.

---

## Claude's Discretion
- `computeLayers` banding tolerance + tall/floating handling (base-z banding locked;
  researcher confirms the tolerance against real demo-preset data).
- Slider ranges/ticks/labels, explode gap unit magnitude, animation easing/duration, ghost
  opacity, exact bottom-bar geometry/styling.
- Whether layer show/hide animates (fade) or is instant.

## Deferred Ideas
- Passive "Layer N" label per placement row (superseded by row-click→isolate; optional).
- 2D top-down per-layer view; step-by-step load-sequence animation.
- All-pallets-at-once overview; per-layer stats in the rail.
- InstancedMesh for large pallets (verify-don't-pre-optimize).
