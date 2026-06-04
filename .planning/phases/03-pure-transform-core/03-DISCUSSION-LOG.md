# Phase 3: Pure Transform Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 3-Pure Transform Core
**Areas discussed:** App-side config model, Rotation-mode representation (BOX-04)

---

## Gray-area selection

Four phase-specific gray areas were presented (multiSelect):

| Area | Description | Selected |
|------|-------------|----------|
| Unique-ID & type round-trip | item_id format + O(1) result→type recovery | |
| Result-mapper output: reshape vs derive | regroup + pass raw vs pre-derive CoG/tint tiers | |
| App-side config model (builder input) | define canonical model now vs minimal structural input | ✓ |
| Rotation-mode representation (BOX-04) | domain enum + mapping vs mirror API strings | ✓ |

The two unselected areas were carried to "Claude's Discretion" and re-offered at the end (see below).

---

## App-side config model (builder input)

### Q1 — Define canonical model now, or minimal structural input?

| Option | Description | Selected |
|--------|-------------|----------|
| Define canonical now | Phase 3 declares PackConfig + BoxType + PalletConfig; builder consumes them; Phase 4 form fills the exact shape | ✓ |
| Minimal structural input | Builder accepts only the fields it needs (Pick-style); Phase 4 defines the full model later | |

**User's choice:** Define canonical now (Recommended).

### Q2 — Where do config + contract types live?

| Option | Description | Selected |
|--------|-------------|----------|
| src/types/ for contracts, src/lib/ for logic | Contract + config types in src/types/; request-builder.ts / result-mapper.ts in src/lib/; may consolidate fixture-types.ts | ✓ |
| Everything co-located in src/lib/ | Keep types next to transforms (matches fixture-types.ts placement) | |

**User's choice:** src/types/ for contracts, src/lib/ for logic (Recommended).

### Q3 — Which solver options are user-facing vs baked?

| Option | Description | Selected |
|--------|-------------|----------|
| Only max_pallets user-facing; bake the rest | max_pallets in config (PACK-03); builder bakes time_budget_s / seed / support_ratio, still sends them | ✓ |
| Only max_pallets; OMIT the others | Send just max_pallets; rely on API server defaults | |
| Carry all four in the config model | Expose time_budget_s / seed / support_ratio too (future advanced panel) | |

**User's choice:** Only max_pallets user-facing; bake the rest (Recommended).

**Notes:** Config types are plain hand-written TS interfaces this phase — zod stays deferred to Phase 5 (carried-forward decision).

---

## Rotation-mode representation (BOX-04)

### Q1 — How to represent the 3 rotation modes internally?

| Option | Description | Selected |
|--------|-------------|----------|
| Domain enum + mapping table | Friendly internal names (free/uprightOnly/fixed) → API strings via a pure tested fn | ✓ |
| Mirror API strings directly | Use all/this_side_up/none as internal type and sent value; mapping is identity | |

**User's choice:** Domain enum + mapping table (Recommended).

### Q2 — Default rotation mode for a new box type?

| Option | Description | Selected |
|--------|-------------|----------|
| Any orientation / 'all' | Most permissive, best fill rate; matches fixture D-type boxes | ✓ |
| Keep upright / 'this_side_up' | Safer default; assumes cargo has an up direction | |
| No preference — your call | Let Claude pick during planning | |

**User's choice:** Any orientation / 'all' (Recommended).

---

## Claude's Discretion

Two gray areas were offered at the end; the user chose **"I'm ready for context"**, locking sensible defaults rather than discussing them:

- **Unique-ID scheme & type round-trip (gray area A):** self-describing `{typeId}-{index}` ids parseable in O(1) (extending `typeKeyOf`), with a `Map<item_id, typeId>` retained for format-independent O(1) lookup. → CONTEXT.md D-07.
- **Result-mapper output shape (gray area B):** regroup by type + pallet, pass diagnostics (cog, support_ratio) through raw, derive only cheap coordinate-free aggregates; no CoG→Three.js mapping and no support-ratio tint bucketing (those are Phase 6). → CONTEXT.md D-08.

## Deferred Ideas

No new scope-creep ideas surfaced during this discussion. The phase's deferred work (config form → Phase 4; API client → Phase 5; CoG marker / support-ratio tinting / placement list → Phase 6; zod validation → Phase 5; InstancedMesh perf → Phase 6) is documented in CONTEXT.md's Deferred Ideas and inherited from the Phase 2 boundary.
