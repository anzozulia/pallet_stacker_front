# Phase 3: Pure Transform Core - Research

**Researched:** 2026-06-04
**Domain:** Pure TypeScript data transforms (request-builder + result-mapper) — no React, no IO, no runtime `three`
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Define the canonical in-memory config model now. Phase 3 declares the authoritative TS types (`PackConfig` = pallet + box catalog + options; plus `BoxType` and `PalletConfig`). The request-builder consumes this exact shape; Phase 4's form is built to produce it. The pure layer **owns** the form↔builder contract.
- **D-02:** Type placement — `src/types/` for contract types AND the app config model; transform logic (`request-builder.ts`, `result-mapper.ts`) in `src/lib/`. The Phase 2 done-response interfaces in `src/lib/fixture-types.ts` **may be consolidated** into `src/types/` (planner's call) — but any file imported by `src/lib/` MUST keep no-runtime-`three` / no-React / no-IO purity.
- **D-03:** Only `max_pallets` is user-facing (PACK-03). The builder **bakes fixed constants** for `time_budget_s=25`, `seed=7`, `support_ratio=0.8` and **still sends them** in the request `options` block.
- **D-04 (carried):** Plain hand-written TS interfaces this phase; `zod` runtime validation stays deferred to Phase 5.
- **D-05:** Domain rotation enum (friendly names, e.g. `free`/`uprightOnly`/`fixed` — exact spelling is planner's discretion) + a small **pure, unit-tested** function maps each to the API string (`all`/`this_side_up`/`none`). Not an identity pass-through.
- **D-06:** New box types default to `free` → `all` (any orientation).

### Claude's Discretion
- **D-07 (Unique-ID scheme & type round-trip):** Builder generates a self-describing, stable, unique item id of the form `{typeId}-{index}` (or equivalent) with **O(1)** type recovery, extending the `typeKeyOf` pattern. SHOULD also return/retain a `Map<item_id, typeId>` so the mapper has an O(1) lookup that does not depend on string-format fragility (real user box types may lack clean single-letter prefixes). IDs deterministic across rebuilds, unique, round-trippable. Planner resolves exact format and whether parse-vs-map is primary, under the constraint that the Phase 2 `typeKeyOf` + palette/legend rely on parseable prefixes for the captured fixture.
- **D-08 (Result-mapper output shape):** Mapper regroups the `done` response by type AND by pallet, passes diagnostics through **largely raw** (per-pallet `cog`, per-box `support_ratio`/`supported_by`/`supports`). Derives only **cheap, IO-free, coordinate-free** aggregates (per-type counts/total weight, per-pallet item lists, packed/unpacked split, pull-through of `input_summary`/`utilisation`). Does NOT pre-map `cog` into Three.js space, does NOT bucket support-ratio into tint tiers (Phase 6). Stays pure (no `three` import).

### Deferred Ideas (OUT OF SCOPE)
- Config **form**, validation, live unit count, localStorage (PALLET-01/02, BOX-01/02/03/05/06, PACK-03 UI, DATA-02) → **Phase 4**. Phase 3 ships only the config *types*, not the form.
- Live **API client / async polling / submit / cancel / terminal-state handling** (PACK-01/04/05/06) + `zod` response validation → **Phase 5**. Phase 3 builds the request body but never sends it.
- CoG **3D marker** (DIAG-01), support-ratio **tinting** (DIAG-02), placement list, multi-pallet switcher, summary rail (RESULT-03/04/05/06) → **Phase 6**. Mapper surfaces raw diagnostics only.
- **Coordinate/geometry math** — already golden-locked in Phase 2 (`mapPlacement`); Phase 3 does not touch it.
- InstancedMesh performance optimization → **Phase 6**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PACK-02** | App expands each box type's quantity into individual, uniquely-identified boxes before calling the API | ID scheme (§ID Scheme), request-builder structure (§Architecture Pattern 1), determinism/uniqueness validation (§Validation Architecture) |
| **BOX-04** (mapping half) | Map each box type's rotation choice to exactly one of the API's three modes (`all`/`this_side_up`/`none`) | Rotation mapping table (§Architecture Pattern 2), exhaustive-table validation (§Validation Architecture). NB: per REQUIREMENTS.md note, BOX-04 spans two phases — the *mapping* is delivered/tested here, the *user-facing choice* lands in Phase 4. |
</phase_requirements>

## Summary

Phase 3 is a pure-TypeScript data-transform phase: two functions (`buildPackRequest`, `mapDoneResponse`) plus co-located Vitest tests, with **zero new external packages** and **zero external environment dependencies**. The entire test corpus already exists in the repo as the captured paired fixtures (`pack-request.json` ↔ `pack-done-response.json`), which carry multi-pallet results, 7 unpacked items, all 3 rotation modes, and 3 box types (D/T/F). The phase is exceptionally low-risk: the API contract is captured and frozen, the coordinate math is out of scope, and all conventions (pure `src/lib/` modules, co-located `*.test.ts`, `@/` alias, jsdom-WebGL-free) are already established by the Phase 2 modules `mapping.ts` / `palette.ts` / `camera-presets.ts`.

The two non-trivial design decisions both fall under Claude's discretion. For **D-07 (ID scheme)** the evidence strongly favors a **Map-primary, parse-compatible** design: the builder returns both the request body AND a `Map<item_id, typeId>` (O(1), format-independent, the authoritative round-trip channel), while *also* using an id format that keeps the existing `typeKeyOf` parse working for the captured fixture. A deterministic per-type counter is sufficient — **`nanoid` is not needed and must not be used** (it would break determinism-across-rebuilds, which SC-1 explicitly requires). For **D-08 (mapper output)** the evidence favors a single pass over `pallets[].items[]` that builds both the by-pallet and by-type views simultaneously, keying the by-type grouping on the **same `typeId` the builder emitted** (recovered via the id→type map, falling back to `typeKeyOf`) so `colorForType` and the Phase 6 legend stay key-compatible.

**Primary recommendation:** Add `src/types/pack-contract.ts` (request-side contract: `PackRequest`/`BoxRequest`/`PackOptions`) and `src/types/config.ts` (app model: `PackConfig`/`BoxType`/`PalletConfig`/`RotationMode`); consolidate `fixture-types.ts` into `src/types/pack-contract.ts` (response-side); implement `src/lib/request-builder.ts` (returns `{ request, idToType }`) and `src/lib/result-mapper.ts` (returns `{ summary, pallets, byType, unpacked }`); each with a co-located `*.test.ts` whose centerpiece is the fixture round-trip. Use a deterministic counter for ids — no `nanoid`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Expand per-type quantities → individual boxes | Pure transform (`src/lib`) | — | Pure deterministic data transform; no IO, no UI |
| Generate stable unique item IDs | Pure transform (`src/lib`) | — | Deterministic counter; recoverable to type |
| Rotation domain-enum → API-string mapping | Pure transform (`src/lib`) | Config types (`src/types`) | Domain vocabulary lives in types; mapping fn is pure logic |
| Define app config model (`PackConfig` etc.) | Config types (`src/types`) | — | Contract owned by pure layer (D-01); form fills it (Phase 4) |
| Define API request/response contract | Contract types (`src/types`) | — | Hand-written TS interfaces (D-04); single source of shape truth |
| Regroup `done` response by type + pallet | Pure transform (`src/lib`) | — | Cheap coordinate-free aggregation; no `three` |
| Surface raw diagnostics (cog, support_ratio) | Pure transform (`src/lib`) | — | Pass-through only; Phase 6 derives visual forms |
| Map cog → Three.js space / tint tiers | **NOT THIS PHASE** | Phase 6 viewer | Coordinate/visual derivation lives at render boundary |
| Coordinate/geometry mapping (`mapPlacement`) | **NOT THIS PHASE** | Phase 2 (locked) | Golden-locked; Phase 3 does not touch it |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `~6.0.3` | The entire phase is hand-written TS | `[CITED: CLAUDE.md]` Already locked; transforms are plain functions + interfaces |
| vitest | `4.1.8` | Co-located unit test runner | `[CITED: CLAUDE.md]` `[VERIFIED: repo]` Already configured (`vitest.config.ts`, jsdom, globals, `@/` alias) |

**No new packages are installed in this phase.** Every capability uses TypeScript language features and the existing test runner. See Package Legitimacy Audit.

### Explicitly NOT used
| Library | Why excluded |
|---------|--------------|
| `nanoid` (`5.1.11`, available in stack) | `[CITED: CLAUDE.md / ROADMAP SC-1]` SC-1 requires IDs **deterministic across rebuilds**. `nanoid` is a random generator — it produces different ids each run, breaking the "stable" requirement and making the round-trip non-reproducible. A deterministic per-type counter is the correct tool. CLAUDE.md notes nanoid as *"if needed"* and *"A simple counter also works; nanoid avoids collision bookkeeping"* — here the counter is not just acceptable, it is **required** for determinism. |
| `zod` (`4.4.3`, in stack) | `[CITED: CLAUDE.md / D-04]` Deferred to Phase 5's live client (validate at the trust boundary). Phase 3 uses hand-written interfaces. |
| `three` / `@react-three/*` | `[CITED: D-02/D-08]` Importing runtime `three` would pull this module into — or break — the lazy `/result` code-split chunk and fail the `scripts/check-code-split.mjs` build gate. Type-only `three` imports are also unnecessary here (no geometry). |

**Installation:** None.

## Package Legitimacy Audit

> This phase installs **no external packages**. The legitimacy gate is therefore satisfied trivially — there is nothing to slopcheck.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages considered)
**Packages flagged as suspicious [SUS]:** none

All functionality is built from TypeScript language features and the already-installed, already-verified Vitest. `nanoid` is *available* in the locked stack but is deliberately **not used** (see Standard Stack → Explicitly NOT used).

## Architecture Patterns

### System Architecture Diagram

```
                          PHASE 3 PURE TRANSFORM CORE (src/lib, no React/IO/three)

  [Phase 4 form]                                                              [Phase 5 client]
  produces                                                                    sends
       │                                                                          │
       ▼                                                                          ▼
  PackConfig  ──────────►  buildPackRequest(config)  ──────────►  { request:  PackRequest,    ──► POST /api/v1/pack
  (src/types/config)            (src/lib/                              idToType: Map<id,type> }
   • pallet                      request-builder.ts)                       │
   • boxTypes[]                       │                                     │ idToType retained for
     (qty, rotation,                  │ for each boxType:                  │ O(1) type recovery
      dims, weight)                   │   repeat qty times →               │ (format-independent)
   • maxPallets                       │     id = `${typeId}-${index}`      │
                                      │     rotations = ROTATION_MAP[mode] ▼
                                      │   options = { maxPallets,      [Phase 5 returns done response]
                                      │     time_budget_s:25,                │
                                      │     seed:7, support_ratio:0.8 }      ▼
                                      └──────────────────────────►  DoneResponse (src/types, ex-fixture-types)
                                                                          │
                                                                          ▼
                                              mapDoneResponse(done, idToType?)  ──────► ResultView
                                                  (src/lib/result-mapper.ts)            (src/types)
                                                       │ single pass over                  │
                                                       │ pallets[].items[]:                ├─ summary (input_summary pass-through)
                                                       │   typeId = idToType.get(id)        ├─ pallets[] (by pallet: cog, util,
                                                       │            ?? typeKeyOf(id)         │    total_weight, items[] raw + typeId)
                                                       │   bucket into byPallet + byType    ├─ byType (Map<typeId, {count, weight, ids}>)
                                                       │                                    └─ unpacked[] (raw pass-through)
                                                       ▼                                          │
                                              colorForType(byType keys) ◄────────────────────────┘
                                              (Phase 6 legend — keys MUST match builder's typeId)
```

### Recommended Project Structure
```
src/
├── types/
│   ├── config.ts            # NEW: PackConfig, BoxType, PalletConfig, RotationMode (app model — D-01)
│   └── pack-contract.ts     # NEW: PackRequest, BoxRequest, PackOptions (request side)
│                            #      + DoneResponse/DoneResult/PalletResult/PlacementOut/
│                            #        UnpackedItem/InputSummary/Orientation/Cog (response side,
│                            #        consolidated from fixture-types.ts per D-02)
└── lib/
    ├── request-builder.ts        # NEW: buildPackRequest(config) → { request, idToType }
    ├── request-builder.test.ts   # NEW: co-located
    ├── result-mapper.ts          # NEW: mapDoneResponse(done, idToType?) → ResultView
    ├── result-mapper.test.ts     # NEW: co-located (centerpiece: fixture round-trip)
    ├── mapping.ts                # EXISTING: typeKeyOf (reused), mapPlacement (NOT touched)
    ├── palette.ts                # EXISTING: colorForType (mapper keys must stay compatible)
    └── __fixtures__/
        ├── pack-request.json         # EXISTING: builder OUTPUT shape reference
        └── pack-done-response.json   # EXISTING: mapper INPUT + round-trip target
```

**On consolidating `fixture-types.ts` (D-02):** Recommended to **move** the response interfaces into `src/types/pack-contract.ts` and update the two existing importers (`mapping.ts`, `mapping.test.ts` import `PalletDims`/`PlacementOut`/`DoneResponse` from `./fixture-types`). Keep a thin re-export shim at `src/lib/fixture-types.ts` (`export * from '@/types/pack-contract'`) **or** update the imports — planner's call. Either way the moved file must import nothing runtime (it already imports nothing). This satisfies the Phase 1 signpost that `src/types/` holds contract types while preserving the purity gate.

### Pattern 1: Request-builder with quantity expansion + dual return (PACK-02, D-07)

**What:** Pure function consuming `PackConfig`, returning the `POST /api/v1/pack` body AND an `id→typeId` map.
**When to use:** The builder is the single producer of item ids; the map is the authoritative type-recovery channel.

```typescript
// Source: derived from src/lib/__fixtures__/pack-request.json (captured request shape)
//         + D-03 (baked option constants) + D-07 (dual return) + ASSUMED index format

// Baked solver constants — sent but not user-facing (D-03). [VERIFIED: pack-request.json options block]
const BAKED_OPTIONS = { time_budget_s: 25, seed: 7, support_ratio: 0.8 } as const;

export interface BuildResult {
  request: PackRequest;
  idToType: Map<string, string>; // item_id → typeId — O(1), format-independent (D-07)
}

export function buildPackRequest(config: PackConfig): BuildResult {
  const boxes: BoxRequest[] = [];
  const idToType = new Map<string, string>();

  for (const t of config.boxTypes) {
    for (let i = 0; i < t.quantity; i++) {
      const id = makeItemId(t.id, i);        // `${typeId}-${index}` — deterministic, stable
      idToType.set(id, t.id);
      boxes.push({
        id,
        length: t.length, width: t.width, height: t.height,
        weight: t.weight,
        rotations: rotationToApi(t.rotation), // domain enum → API string (Pattern 2)
      });
    }
  }

  const request: PackRequest = {
    boxes,
    pallet: {
      length: config.pallet.length, width: config.pallet.width, height: config.pallet.height,
      max_weight: config.pallet.maxWeight, max_overhang: config.pallet.maxOverhang,
    },
    options: { max_pallets: config.maxPallets, ...BAKED_OPTIONS },
  };
  return { request, idToType };
}
```

**Anti-patterns to avoid:**
- **Random ids (`nanoid`/`uuid`):** breaks SC-1 "stable across rebuilds". Use a deterministic counter.
- **Parse-only type recovery:** fragile for user-defined type names. Return the map; parse is a *fallback*, not the primary channel.
- **Omitting baked options:** D-03 requires `time_budget_s`/`seed`/`support_ratio` to be **sent** even though not user-facing.

### Pattern 2: Rotation domain-enum → API-string mapping table (BOX-04, D-05/D-06)

**What:** A small total mapping from the friendly domain enum to the API's 3 strings, isolating API vocabulary from the UI.
**When to use:** Every box's `rotations` field in the built request; SC-2's tested table.

```typescript
// Source: D-05 (domain enum + pure mapping) + D-06 (default free→all)
//         + API strings VERIFIED from pack-request.json (all / this_side_up / none)

export type RotationMode = 'free' | 'uprightOnly' | 'fixed';   // domain (spelling = planner's discretion)
export type ApiRotation  = 'all' | 'this_side_up' | 'none';    // [VERIFIED: pack-request.json `rotations` values]

const ROTATION_TO_API: Record<RotationMode, ApiRotation> = {
  free:        'all',           // D-06 default; matches fixture D-type boxes
  uprightOnly: 'this_side_up',  // matches fixture T-type boxes
  fixed:       'none',          // matches fixture F-type boxes
};

export function rotationToApi(mode: RotationMode): ApiRotation {
  return ROTATION_TO_API[mode];
}
```
Because `RotationMode` is a closed union and `ROTATION_TO_API` is typed `Record<RotationMode, ApiRotation>`, the compiler *enforces* total coverage — adding a domain mode without a mapping is a type error. The test then asserts each of the 3 entries explicitly (SC-2).

### Pattern 3: Single-pass dual-axis regrouping (D-08)

**What:** One traversal of `result.pallets[].items[]` that simultaneously builds the by-pallet view and the by-type aggregate, recovering each item's `typeId` via the id→type map (fallback `typeKeyOf`).
**When to use:** The result-mapper's core.

```typescript
// Source: D-08 (regroup by type + pallet, raw diagnostics) + fixture shape
//         + keep keys compatible with colorForType (src/lib/palette.ts)

export interface TypeAggregate { typeId: string; count: number; totalWeight: number; itemIds: string[]; }
export interface MappedPallet {
  palletId: string; utilisation: number; cog: Cog; totalWeight: number;
  items: Array<PlacementOut & { typeId: string }>;   // raw placement + recovered type
}
export interface ResultView {
  summary: InputSummary;                 // raw pass-through
  pallets: MappedPallet[];               // by pallet (Phase 6 switcher)
  byType: Map<string, TypeAggregate>;    // by type (legend / per-type aggregates)
  unpacked: UnpackedItem[];              // raw pass-through (Phase 6 panel)
}

export function mapDoneResponse(done: DoneResponse, idToType?: Map<string, string>): ResultView {
  const byType = new Map<string, TypeAggregate>();
  const recoverType = (id: string) => idToType?.get(id) ?? typeKeyOf(id); // map primary, parse fallback

  const pallets = done.result.pallets.map((p) => ({
    palletId: p.pallet_id, utilisation: p.utilisation, cog: p.cog, totalWeight: p.total_weight,
    items: p.items.map((it) => {
      const typeId = recoverType(it.item_id);
      const agg = byType.get(typeId) ?? { typeId, count: 0, totalWeight: 0, itemIds: [] };
      agg.count += 1; agg.totalWeight += it.weight; agg.itemIds.push(it.item_id);
      byType.set(typeId, agg);
      return { ...it, typeId };
    }),
  }));

  return { summary: done.result.input_summary, pallets, byType, unpacked: done.result.unpacked_items };
}
```

**Key-compatibility note:** `byType`'s keys are the recovered `typeId`s. `colorForType(typeKeys[])` dedupes+sorts its input, so feeding it `[...byType.keys()]` yields a stable legend. For the captured fixture (no id→type map available at mapper time, since the fixture wasn't built by *this* builder), `typeKeyOf('D003')→'D'` reproduces exactly the `D`/`T`/`F` keys the Phase 2 palette already uses. **This is the round-trip invariant SC-1 tests.**

### Anti-Patterns to Avoid
- **Pre-mapping `cog` into Three.js space in the mapper** — that's Phase 6's `mapPlacement`-boundary job (D-08). Pass `cog` raw.
- **Bucketing `support_ratio` into tint tiers in the mapper** — Phase 6 (DIAG-02). Pass `support_ratio` raw.
- **Importing `three` (even type-only) here** — unnecessary and risks the code-split gate. The mapper deals in plain numbers/strings.
- **Mutating the input fixture/response** — keep the transform non-mutating (spread, don't assign onto input objects).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-from-id recovery | A new regex parser | Reuse `typeKeyOf` from `mapping.ts` as the *fallback* path | Already tested + relied on by the palette/legend; one source of truth |
| Type→colour legend | A second colour scheme in the mapper | Keep mapper keys compatible with `colorForType` (`palette.ts`) | Phase 6 legend stability depends on identical keys |
| Unique-id generation | `nanoid`/`uuid`/`crypto.randomUUID` | A deterministic per-type counter | SC-1 demands *stable across rebuilds*; random breaks reproducibility |
| Runtime schema validation | Hand-rolled response guards | (Deferred) `zod` at the Phase 5 trust boundary | D-04 defers validation; Phase 3 trusts the typed contract |

**Key insight:** This phase's only genuine design work is the *contract* (id format + return shape) — the algorithms are trivial loops. Spend effort making the id↔type round-trip robust (map-primary) and the rotation table total/typed; everything else is straightforward data shaping.

## Runtime State Inventory

> Phase 3 creates new pure modules; it is **not** a rename/refactor/migration. The only existing-file touch is the optional consolidation of `fixture-types.ts` into `src/types/` (D-02), which is a pure code move with no runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore, no localStorage in this phase (deferred to Phase 4) | None — verified by scope (CONTEXT Deferred) |
| Live service config | None — builder never sends a request; no live service touched | None — verified by D-08 / Deferred (API client is Phase 5) |
| OS-registered state | None | None |
| Secrets/env vars | None — `VITE_API_URL` not consumed until Phase 5 | None — verified by STATE.md (D-16, typed but unconsumed) |
| Build artifacts | If `fixture-types.ts` is moved: 2 importers (`mapping.ts`, `mapping.test.ts`) reference `./fixture-types`; the `__fixtures__/*.json` are imported by 2 existing tests | Update import paths OR leave a re-export shim at `src/lib/fixture-types.ts` (planner's call per D-02) |

**Import-path impact if `fixture-types.ts` is consolidated:** `[VERIFIED: repo grep]` Current importers of `./fixture-types` are `src/lib/mapping.ts` (type-only `PalletDims`, `PlacementOut`) and `src/lib/mapping.test.ts` / `src/lib/palette.test.ts` (`DoneResponse`). A re-export shim avoids editing the locked Phase 2 `mapping.ts`.

## Common Pitfalls

### Pitfall 1: Random/non-deterministic IDs
**What goes wrong:** Using `nanoid`/`uuid` yields different ids every build, so the same config produces different requests and the round-trip can't be reproduced in a golden test.
**Why it happens:** CLAUDE.md lists `nanoid` as available, tempting its use.
**How to avoid:** Deterministic per-type counter (`${typeId}-${index}`). The test asserts that `buildPackRequest(sameConfig)` twice yields identical ids.
**Warning signs:** Test needs to mock a random source, or asserts on id *shape* instead of exact id value.

### Pitfall 2: Parse-only type recovery breaks on real user type names
**What goes wrong:** `typeKeyOf('Heavy-Duty-001')` returns `'Heavy-Duty-'` (leading non-digit prefix) — wrong/ambiguous for arbitrary user names; collisions when two type names share a prefix.
**Why it happens:** The captured fixture uses clean single-letter prefixes (D/T/F), masking the fragility.
**How to avoid:** Make the `Map<item_id, typeId>` the primary recovery channel (D-07); parse is a fallback only used when the map is absent (e.g. the captured fixture). Builder's `typeId` should be a safe slug/index the builder controls — NOT derived from a free-text label that could contain digits or separators.
**Warning signs:** Mapper depends on `typeKeyOf` for builder-produced ids; type names with digits or hyphens in tests.

### Pitfall 3: ID format that `typeKeyOf` mis-parses
**What goes wrong:** If the builder uses `${typeId}-${index}` where `typeId` itself contains digits, `typeKeyOf` (leading-non-digit prefix) recovers the wrong key for the *fixture-style* fallback path.
**Why it happens:** Two id conventions (captured fixture `D003` vs new `D-3`) must both round-trip.
**How to avoid:** Keep the builder `typeId` a non-digit-leading slug for the parse-fallback to remain correct; rely on the map for the authoritative path. Document the format choice. The captured fixture (`D003` etc.) is recovered by `typeKeyOf` and is the SC-1 target — the *new* builder format only needs the map to round-trip.
**Warning signs:** Round-trip test passes via map but fails when the map is omitted.

### Pitfall 4: Leaking `three` or React into the pure modules
**What goes wrong:** A stray `import` of `three` (even type-only via a barrel) pulls the module toward the lazy chunk or fails `scripts/check-code-split.mjs`.
**Why it happens:** Importing from a shared `src/types` barrel that transitively re-exports a `three`-touching type.
**How to avoid:** `src/types/config.ts` and `pack-contract.ts` import nothing runtime; `request-builder.ts`/`result-mapper.ts` import only those types + `typeKeyOf`. Confirm with a grep/lint that neither new lib file imports `three`/`react`/`fs`/`path`.
**Warning signs:** `check-code-split` fails after the phase; transform module appears in the `/result` chunk.

### Pitfall 5: Mutating the input response
**What goes wrong:** Assigning `typeId` directly onto fixture item objects mutates the shared JSON import, leaking across tests.
**How to avoid:** Spread (`{ ...it, typeId }`) — never assign onto input.
**Warning signs:** Test order dependence; a second test sees `typeId` already present.

## Code Examples

See Architecture Patterns 1–3 above for the three concrete implementations (request-builder dual return, rotation mapping table, single-pass regrouping). All are derived from the captured fixtures + locked decisions, not from external sources.

### Round-trip test skeleton (the SC-1 centerpiece)
```typescript
// Source: pattern from existing src/lib/mapping.test.ts (fixture import, @/ alias, jsdom-WebGL-free)
import { describe, expect, it } from 'vitest';
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { mapDoneResponse } from '@/lib/result-mapper';

const done = doneResponse as DoneResponse;

describe('mapDoneResponse — fixture round-trip (SC-1, SC-3)', () => {
  it('recovers every packed item to its type in O(1) and regroups by type', () => {
    const view = mapDoneResponse(done); // no id→type map → typeKeyOf fallback (captured fixture)
    // 31 packed (input_summary.items_packed), 3 types D/T/F
    expect(view.summary.items_packed).toBe(31);
    expect([...view.byType.keys()].sort()).toEqual(['D', 'F', 'T']);
    expect(view.byType.get('T')!.count).toBe(12);     // 12 T placed across pallets
    expect(view.pallets).toHaveLength(2);             // multi-pallet
    expect(view.unpacked).toHaveLength(7);            // 7 unpacked
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse type from id (`typeKeyOf`) as the *only* channel | Builder-returned `Map<id,type>` as primary, parse as fallback | This phase (D-07) | Robust to arbitrary user-defined type names |
| Identity pass-through of rotation strings | Domain enum + typed mapping table | This phase (D-05) | API vocabulary isolated from UI; total coverage compiler-enforced |

**Deprecated/outdated:** None relevant — this is greenfield pure code building on stable Phase 2 conventions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ID format `${typeId}-${index}` (hyphen separator, zero-based index) is the chosen self-describing format | Pattern 1, D-07 | LOW — exact format is explicitly planner's discretion (D-07); the *map* guarantees round-trip regardless of separator. The captured fixture's own format (`D003`) is fixed and unaffected. |
| A2 | Domain enum spelling `free`/`uprightOnly`/`fixed` | Pattern 2 | LOW — D-05 states spelling is planner's discretion; only the *mapping targets* (`all`/`this_side_up`/`none`) are fixed and verified |
| A3 | Baked option values `time_budget_s=25`, `seed=7`, `support_ratio=0.8` | Pattern 1, D-03 | LOW — D-03 says "planner confirms"; values are VERIFIED present in the captured `pack-request.json` and are sensible defaults |
| A4 | `colorForType` keys should equal the mapper's `byType` keys | Pattern 3 | LOW — required for Phase 6 legend stability; `typeKeyOf` on the fixture reproduces exactly D/T/F which the Phase 2 palette already consumes |
| A5 | `ResultView` field names (`summary`/`pallets`/`byType`/`unpacked`, `MappedPallet`, `TypeAggregate`) | Pattern 3 | LOW — output shape is D-08 discretion; only the *content* (raw diagnostics, dual grouping) is mandated |

## Open Questions

1. **Consolidate `fixture-types.ts` or leave it?**
   - What we know: D-02 makes this the planner's call; importers are `mapping.ts` + 2 tests.
   - What's unclear: whether editing the Phase 2-locked `mapping.ts` import is acceptable.
   - Recommendation: Move interfaces to `src/types/pack-contract.ts` and leave a one-line re-export shim at `src/lib/fixture-types.ts` so `mapping.ts` is untouched.

2. **Exact `typeId` slug rule for the builder (vs the user's free-text label).**
   - What we know: Phase 4 owns the form; box types will have user labels.
   - What's unclear: whether `BoxType.id` is a generated slug or the raw label.
   - Recommendation: `BoxType` carries a stable generated `id` (slug/index) distinct from its display `label`; the builder uses `id` for item-id construction so user labels with digits/spaces never break recovery. This is a config-model decision (D-01) worth pinning in the plan.

## Environment Availability

> Skipped — this phase has no external tool/service/runtime dependencies beyond the already-installed TypeScript + Vitest. It is pure code + co-located tests run by the existing `npm run test`. (Step 2.6: SKIPPED — no external dependencies identified.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.8` (jsdom env, globals on) `[VERIFIED: vitest.config.ts]` |
| Config file | `vitest.config.ts` (registers `react()` + `tsconfigPaths()`; `setupFiles: ./src/test/setup.ts`) |
| Quick run command | `npm run test -- src/lib/request-builder.test.ts src/lib/result-mapper.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACK-02 | Each box type's `quantity` expands into exactly N individual boxes with unique ids | unit | `npm run test -- src/lib/request-builder.test.ts -t "expands quantity"` | ❌ Wave 0 |
| PACK-02 | IDs are unique across the whole request (no collisions across types) | unit | `… -t "ids are unique"` | ❌ Wave 0 |
| PACK-02 | IDs are deterministic across repeated builds (stable) | unit | `… -t "deterministic across rebuilds"` | ❌ Wave 0 |
| PACK-02 (SC-1) | `idToType` map recovers every item's type in O(1); round-trip of fixture ids via `typeKeyOf` fallback yields D/T/F | unit | `npm run test -- src/lib/result-mapper.test.ts -t "round-trip"` | ❌ Wave 0 |
| BOX-04 (SC-2) | Each of the 3 domain modes maps to exactly one distinct API string (`all`/`this_side_up`/`none`); table is total | unit | `… request-builder.test.ts -t "rotation"` | ❌ Wave 0 |
| SC-3 | Mapper groups by type AND by pallet; exposes per-pallet `cog` + per-box `support_ratio` raw | unit | `npm run test -- src/lib/result-mapper.test.ts -t "groups by type and pallet"` | ❌ Wave 0 |
| SC-3 | Multi-pallet (2) + 7 unpacked items surfaced correctly | unit | `… -t "multi-pallet"` / `-t "unpacked"` | ❌ Wave 0 |
| SC-4 | Transform modules import zero React/IO/runtime-three | static | grep/lint assertion + existing `npm run build && node scripts/check-code-split.mjs` | partial (gate exists) |

### Sampling Rate
- **Per task commit:** `npm run test -- src/lib/request-builder.test.ts src/lib/result-mapper.test.ts` (the two co-located files, < 5s)
- **Per wave merge:** `npm run test` (full Vitest suite — includes the existing mapping/palette/camera-preset tests to catch grouping-key regressions)
- **Phase gate:** Full suite green + `npm run build` + `node scripts/check-code-split.mjs` green (proves SC-4 purity) before `/gsd-verify-work`

### Test Inputs (corpus)
The **paired captured fixtures are the entire corpus** — no new fixtures needed:
- `src/lib/__fixtures__/pack-request.json` — the builder OUTPUT golden (assert the built request matches this shape: `boxes[].{id,length,width,height,weight,rotations}`, `pallet`, `options`).
- `src/lib/__fixtures__/pack-done-response.json` — the mapper INPUT + round-trip target: 2 pallets, 31 packed, 7 unpacked, 3 types (D/T/F), all 3 rotation modes present in the *request*, all per-box diagnostics (`support_ratio`/`supported_by`/`supports`) and per-pallet `cog` present.
- A small **synthetic `PackConfig`** for the builder tests (e.g. 2 box types × small quantities, one of each rotation mode) to assert expansion count, id determinism, uniqueness, and the rotation table — independent of the captured single-letter-prefix convention so it exercises the map-primary recovery path.

### Wave 0 Gaps
- [ ] `src/lib/request-builder.test.ts` — covers PACK-02 (expansion/uniqueness/determinism), BOX-04 (rotation table), builder-output-shape vs `pack-request.json`
- [ ] `src/lib/result-mapper.test.ts` — covers SC-1 round-trip, SC-3 dual grouping + raw diagnostics, multi-pallet + unpacked
- [ ] No new framework install or shared fixtures required — existing `vitest.config.ts` + `__fixtures__/*.json` cover everything

*(Framework + fixtures already present; the only Wave 0 work is authoring the two test files alongside the two implementation files.)*

## Security Domain

> `security_enforcement` is not present in `.planning/config.json`. This phase has **no security surface**: pure in-memory data transforms, no IO, no network, no untrusted input parsing (the API contract is trusted-by-type per D-04; runtime validation is deferred to Phase 5's `zod` trust boundary). No auth, no sessions, no access control, no crypto.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in a stateless no-login tool) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | deferred | Phase 5 validates `GET /jobs/{id}` / `done` responses with `zod` at the network trust boundary (D-04). Phase 3 trusts the typed contract; inputs are in-process config objects, not external data. |
| V6 Cryptography | no | — (deterministic counter ids are not security tokens; no secrets) |

**Note for the planner:** the one forward-looking security item is that the result-mapper will eventually consume *network* data (Phase 5). Keeping the mapper non-mutating and tolerant of missing fields (defensive `?? fallback`) eases the Phase 5 hardening, but full validation is correctly out of scope here.

## Sources

### Primary (HIGH confidence)
- `src/lib/__fixtures__/pack-request.json` — `[VERIFIED: repo]` builder OUTPUT shape; option constants (25/7/0.8); rotation strings (`all`/`this_side_up`/`none`); id convention (`D###`/`T###`/`F###`)
- `src/lib/__fixtures__/pack-done-response.json` — `[VERIFIED: repo]` mapper INPUT + round-trip target; 2 pallets / 31 packed / 7 unpacked / 3 types; per-pallet `cog`; per-box `support_ratio`/`supported_by`/`supports`
- `src/lib/fixture-types.ts` — `[VERIFIED: repo]` response interfaces (mapper input types; consolidation candidate)
- `src/lib/mapping.ts` — `[VERIFIED: repo]` `typeKeyOf` (parse-fallback basis), module purity-rule header, `mapPlacement` (out of scope)
- `src/lib/palette.ts` — `[VERIFIED: repo]` `colorForType` (dedupe+sort, grouping-key compatibility)
- `vitest.config.ts`, `src/lib/mapping.test.ts`, `src/lib/palette.test.ts`, `src/lib/camera-presets.test.ts` — `[VERIFIED: repo]` test conventions (`@/` alias, fixture import, jsdom-WebGL-free)
- `scripts/check-code-split.mjs` — `[VERIFIED: repo]` the build gate enforcing `three` absence from the entry chunk (SC-4 purity backstop)
- `.planning/phases/03-pure-transform-core/03-CONTEXT.md` — `[CITED]` D-01…D-08
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — `[CITED]` SC-1…SC-4, PACK-02, BOX-04
- `CLAUDE.md` — `[CITED]` locked stack, purity rules, nanoid/zod guidance

### Secondary (MEDIUM confidence)
- None — every claim is grounded in repo files or locked decisions.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; everything verified in the repo's locked config
- Architecture: HIGH — patterns derived directly from captured fixtures + locked D-01…D-08
- Pitfalls: HIGH — grounded in the actual `typeKeyOf` parse behavior, the code-split gate, and the determinism requirement
- Validation: HIGH — the entire corpus already exists as committed fixtures

**Research date:** 2026-06-04
**Valid until:** Stable indefinitely for this phase — the API contract is captured/frozen, no external dependencies, no fast-moving libraries involved (re-check only if the captured fixtures or locked decisions change).
