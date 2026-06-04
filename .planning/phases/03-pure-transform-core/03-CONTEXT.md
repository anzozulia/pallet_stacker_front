# Phase 3: Pure Transform Core - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **pure, IO-free transform layer** that sits between the Phase 4 config form and the Phase 5/6 result rendering — two transforms plus their co-located unit tests, importing **zero React and zero IO** (and no runtime `three`):

- **request-builder** — takes the canonical in-memory config (pallet + box catalog with per-type quantities + options) and produces the `POST /api/v1/pack` request body. Expands each box type's quantity into individually-identified boxes with stable, unique, type-recoverable IDs (PACK-02), and maps each type's rotation choice to exactly one of the API's three modes (BOX-04 mapping half).
- **result-mapper** — takes the API `done` response and regroups it **by type** and **by pallet**, surfacing per-pallet centre-of-gravity and per-box support-ratio diagnostics from the fixture.

**Success criteria (from ROADMAP.md):** stable unique `TYPE#index` IDs with an O(1) result→type round-trip; rotation choice → exactly one of `all`/`this_side_up`/`none`; mapper groups by type + pallet and exposes CoG + support-ratio; all transforms have passing co-located unit tests and import zero React/IO.

**Scope guardrail — explicitly NOT this phase:**
- The config **form**, validation, live unit count, and localStorage (PALLET-01/02, BOX-01/02/03/05/06, PACK-03 UI, DATA-02) → **Phase 4**. Phase 3 ships the config **types** the form fills, not the form.
- The live **API client / async polling / submit / cancel** → **Phase 5**. Phase 3 builds the request body but never sends it.
- The CoG **3D marker** (DIAG-01), support-ratio **tinting** (DIAG-02), placement list, multi-pallet switcher, and summary rail → **Phase 6**. The mapper surfaces raw diagnostics; Phase 6 derives the visual/coordinate forms.
- **Coordinate/geometry math** — already done and golden-locked in Phase 2 (`mapPlacement`); Phase 3 does not touch it.

</domain>

<decisions>
## Implementation Decisions

### App-side config model (request-builder input)
- **D-01:** **Define the canonical in-memory config model now.** Phase 3 declares the authoritative TS types (`PackConfig` = pallet + box catalog + options; plus `BoxType` and `PalletConfig`). The request-builder consumes this exact shape, and Phase 4's form is built to produce it. True inside-out: the pure layer **owns** the form↔builder contract; the form merely fills it.
- **D-02:** **Type placement — `src/types/` for contracts, `src/lib/` for logic.** The API request/response contract types **and** the app config model live in `src/types/` (Phase 1 signposted it as "API contract types"). The transform logic (`request-builder.ts`, `result-mapper.ts`) lives in `src/lib/`. The existing Phase 2 done-response interfaces in `src/lib/fixture-types.ts` **may be consolidated** into `src/types/` — planner's call — but any file imported by `src/lib/` MUST keep the no-runtime-`three` / no-React / no-IO purity (protects the code-split gate).
- **D-03:** **Only `max_pallets` is user-facing.** It is the single in-scope options requirement (PACK-03) and the one option the config model carries. The builder **bakes fixed constants** for `time_budget_s`, `seed`, and `support_ratio` (the captured fixture used `25` / `7` / `0.8` — sensible bake values; planner confirms) and **still sends them** in the request `options` block. None of these three is a v1 requirement, so they stay out of the Phase 4 form.
- **D-04 (carried forward):** Config + contract types are **plain hand-written TS interfaces** this phase — `zod` runtime validation stays deferred to Phase 5's live client (locked in Phase 2).

### Rotation-mode representation (BOX-04 mapping)
- **D-05:** **Domain enum + pure mapping table.** The internal type uses friendly names (e.g. `free` / `uprightOnly` / `fixed` — exact spelling is planner's discretion) and a small **pure, unit-tested function** maps each to the API string (`all` / `this_side_up` / `none`). This makes SC-2 ("maps to exactly one of three modes") a real, tested table rather than an identity pass-through, isolates API vocabulary from the domain model, and gives Phase 4's form clean labels. Honors PROJECT.md's "mirror the API's 3 modes honestly" (the *meaning* is mirrored; the raw API string is not leaked into the UI).
- **D-06:** **New box types default to `free` → `all` (any orientation).** Most permissive, best fill rate (the tool's core value), and matches the fixture's D-type boxes. This is a UX seed for Phase 4's form, not a hard rule.

### Claude's Discretion (user opted to let me decide; defaults locked here for downstream agents)
- **D-07 (Unique-ID scheme & type round-trip — was gray area A):** The builder generates a **self-describing, stable, unique** item id of the form `{typeId}-{index}` (or equivalent) from which the box type is recoverable in **O(1)** — extending the existing `typeKeyOf` parse pattern (`src/lib/mapping.ts`). **Rationale:** the `item_id` is the *only* channel carrying type identity through the API (the API echoes ids back but is type-agnostic). **Robustness requirement:** the builder SHOULD also return/retain a `Map<item_id, typeId>` alongside the request so the result-mapper has an O(1) lookup that does **not** depend on string-format fragility — important because real user-defined box types may not have clean single-letter prefixes like the fixture's `D`/`T`/`F`. IDs must be **deterministic across rebuilds** (stable), unique, and round-trippable. Planner resolves the exact format and whether parse-vs-map is primary, under the constraint that the Phase 2 `typeKeyOf` + palette/legend currently rely on parseable prefixes for the captured fixture.
- **D-08 (Result-mapper output shape — was gray area B):** The mapper **regroups** the `done` response by type and by pallet and passes diagnostics through **largely raw** (per-pallet `cog`, per-box `support_ratio` / `supported_by` / `supports`). It derives only **cheap, IO-free, coordinate-free** aggregates (per-type counts/total weight, per-pallet item lists, packed/unpacked split, pull-through of `input_summary`/`utilisation`). It does **NOT** pre-map `cog` into Three.js space and does **NOT** bucket support-ratio into tint tiers — those coordinate/visual derivations belong to the Phase 6 viewer that owns coordinate concerns (mirroring how `mapPlacement` lives at the render boundary, not in the data mapper). The mapper stays pure (no `three` import) to protect the code-split gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase goal, requirements & scope
- `.planning/ROADMAP.md` §"Phase 3: Pure Transform Core" — the goal and the **4 success criteria** this phase is measured against.
- `.planning/REQUIREMENTS.md` — **PACK-02** (expand quantities into individual unique-ID boxes) and **BOX-04** (rotation mode → API's three modes). ⚠ See the **note at the bottom** of REQUIREMENTS.md: BOX-04 spans two phases — the *mapping* is delivered/tested here in Phase 3; the *user-facing rotation choice* lands in Phase 4.
- `.planning/PROJECT.md` — constraints (mm/kg integer units, async submit-then-poll API, no backend, localStorage-only), the **Key Decisions** table (esp. "Simplify rotation UI to the API's 3 modes" and the coordinate-mapping decision), and **Out of Scope** (6-way rotation, CoG-as-input).

### The API contract (builder OUTPUT shape + mapper INPUT shape — the real round-trip data)
- `src/lib/__fixtures__/pack-request.json` — the **real captured request**. The request-builder must produce this exact shape: `boxes[]` = `{id, length, width, height, weight, rotations}`, `pallet` = `{length, width, height, max_weight, max_overhang}`, `options` = `{max_pallets, time_budget_s, seed, support_ratio}`. Note `rotations` is the per-box API string (`all`/`this_side_up`/`none`) and ids are `D###`/`T###`/`F###`.
- `src/lib/__fixtures__/pack-done-response.json` — the **real captured `done` response**: the mapper's input and the round-trip test target. `result.input_summary` (items_packed/unpacked, pallets_used, total_volume_utilisation), `result.pallets[]` (pallet_id, dimensions, utilisation, **cog**, total_weight, **items[]**), per-item `{item_id, position, dimensions, orientation{perm,name}, weight, support_ratio, supported_by, supports}`, and `result.unpacked_items[]` (`{item_id, dimensions, weight, reason}`). Multi-pallet (2), 7 unpacked, 3 types (D/T/F).
- `src/lib/fixture-types.ts` — hand-written TS interfaces for the `done` response (`DoneResponse` / `DoneResult` / `PalletResult` / `PlacementOut` / `UnpackedItem` / `InputSummary` / `Orientation` / `Cog`). Reuse/extend as the mapper's input types; may be consolidated into `src/types/` per D-02.

### Prior-phase decisions & reusable code
- `.planning/phases/02-coordinate-mapping-fixture-viewer/02-CONTEXT.md` — coordinate-mapping decisions (`orientation.perm` is **diagnostic-only**, baked into `dimensions`, never re-applied), the rich fixture-capture scenario, and the explicit **Deferred Ideas** that hand the request-builder + result-mapper to Phase 3.
- `src/lib/mapping.ts` — the existing `typeKeyOf(itemId)` (type-from-id parse, leading non-digit prefix — the round-trip basis for D-07) and `mapPlacement` (geometry boundary, NOT touched here). Read the module-header purity rule.
- `src/lib/palette.ts` — `colorForType(typeKeys[])` consumes the type keys the mapper's grouping produces; keep grouping keys consistent so the Phase 6 legend stays stable.
- `CLAUDE.md` — locked stack (`nanoid` available for IDs if needed; `zod` reserved for Phase 5), the "test scene logic as pure functions, not the Canvas" rule, and the inside-out `lib → api → features` ordering.
- `.planning/phases/01-scaffolding-version-lock/01-CONTEXT.md` — signposted dirs (`src/types/` = contract types, `src/lib/` = pure transforms) and the code-split discipline this phase must not violate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/mapping.ts` → `typeKeyOf(itemId)`** — already derives a type key from an item id (leading non-digit prefix, `T000`→`T`). The SC-1 round-trip can reuse/extend it (see D-07). `mapPlacement` is the geometry boundary and is out of scope here.
- **`src/lib/palette.ts` → `colorForType(typeKeys[])`** — deterministic type→colour Map; consumes the grouping keys the result-mapper produces. Grouping must stay key-compatible.
- **`src/lib/fixture-types.ts`** — the `done`-response interfaces; type the mapper's input from these. The request-builder needs **new** request-side types (`PackRequest`, `BoxRequest`, `PackOptions`) that do not exist yet.
- **`src/lib/__fixtures__/pack-request.json` + `pack-done-response.json`** — real paired round-trip test data (request ids ↔ response `item_id`s) covering multi-pallet, unpacked items, 3 types, and all three rotation modes. This is the unit-test corpus.

### Established Patterns
- **Pure `src/lib/` modules:** no runtime `three`, no React, no IO (protects the code-split build gate; enables WebGL-free jsdom unit tests). Co-located `*.test.ts`. SC-4 restates this verbatim.
- **Type-from-id derivation** via `typeKeyOf` (parse), already relied on by the Phase 2 viewer + palette.
- **`zod` deferred to Phase 5** → Phase 3 uses hand-written TS interfaces for all contracts.

### Integration Points
- **request-builder:** INPUT = the canonical config Phase 4's form fills; OUTPUT = the `POST /api/v1/pack` body Phase 5's client sends. Two seams defined here.
- **result-mapper:** INPUT = the `done` response Phase 5's client returns; OUTPUT = the grouped view model Phase 6's result page + viewer consume.
- The builder's **ID scheme** (D-07) and the mapper's **type recovery** are the *same contract* viewed from both ends — design them together.

</code_context>

<specifics>
## Specific Ideas

- The captured request used single-letter type prefixes (`D`/`T`/`F`) + zero-padded index; the **real** builder generates ids from **user-defined** box types whose identity may not be a single letter. The id scheme (D-07) must handle that while keeping the Phase 2 `typeKeyOf` / palette round-trip working for the captured fixture.
- Solver-option constants observed in the fixture (sensible bake values per D-03): `time_budget_s = 25`, `seed = 7`, `support_ratio = 0.8`. `max_pallets = 2` is the one user-facing option carried in the config (PACK-03).
- The mapper's grouping should expose both axes the SC names — **by type** (for legend/per-type aggregates) and **by pallet** (for the Phase 6 multi-pallet switcher) — from the same single pass over `result.pallets[].items[]`.

</specifics>

<deferred>
## Deferred Ideas

- **Config form, validation, live unit count, localStorage** (PALLET-01/02, BOX-01/02/03/05/06, PACK-03 UI, DATA-02) → **Phase 4**. Phase 3 ships only the config *types* + the request-builder, not the form.
- **Live API client, async polling, submit, cancel, terminal-state handling** (PACK-01/04/05/06) + **`zod` response validation at the trust boundary** → **Phase 5**. Phase 3 builds the request body but never sends it.
- **CoG 3D marker** (DIAG-01), **support-ratio tinting** (DIAG-02), placement list with hover↔mesh highlight, multi-pallet switcher, summary-stats rail, unpacked panel (RESULT-03/04/05/06) → **Phase 6**. The mapper surfaces raw `cog` / `support_ratio`; Phase 6 derives the Three.js-space marker and tint tiers.
- **InstancedMesh performance optimization** → **Phase 6**.

None of the above are scope creep into Phase 3 — they are correctly-placed later work.

</deferred>

---

*Phase: 3-Pure Transform Core*
*Context gathered: 2026-06-04*
