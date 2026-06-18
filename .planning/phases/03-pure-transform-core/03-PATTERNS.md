# Phase 3: Pure Transform Core - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 6 new (2 logic + 2 test + 2 type modules) + 1 optional consolidation touch
**Analogs found:** 6 / 6 (all strong; this is greenfield pure code on Phase 2 conventions)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/request-builder.ts` | utility (pure transform) | transform (config → request body) | `src/lib/mapping.ts` (`mapPlacement`, `typeKeyOf`) | role + flow exact |
| `src/lib/request-builder.test.ts` | test | transform | `src/lib/mapping.test.ts` | exact |
| `src/lib/result-mapper.ts` | utility (pure transform) | transform (done response → view model) | `src/lib/mapping.ts` + `src/lib/palette.ts` (`colorForType` keying) | role + flow exact |
| `src/lib/result-mapper.test.ts` | test | transform | `src/lib/mapping.test.ts` / `palette.test.ts` (fixture round-trip) | exact |
| `src/types/config.ts` | model (contract types) | n/a (declarations) | `src/lib/fixture-types.ts` | role-match |
| `src/types/pack-contract.ts` | model (contract types) | n/a (declarations) | `src/lib/fixture-types.ts` (response side consolidated in) | role-match (exact for response half) |
| `src/lib/fixture-types.ts` (optional re-export shim) | model | n/a | itself (current importers: `mapping.ts`, `mapping.test.ts`, `palette.test.ts`) | n/a |

## Pattern Assignments

### `src/lib/request-builder.ts` (pure transform, config → request)

**Analog:** `src/lib/mapping.ts`

**Purity-header pattern** (copy the module-doc convention — `mapping.ts` lines 1-16, `fixture-types.ts` lines 1-9). Every new `src/lib/` file MUST open with a comment stating: pure, no runtime `three`, no React, no IO — to protect the code-split gate. Mirror this wording:
```typescript
// Keep this module free of any runtime `three` import (type-only at most) so it stays
// outside the lazy /result chunk and does not threaten the code-split build gate (Pitfall 3).
```

**Import pattern** (relative `./` for sibling lib, `@/types/...` for the new contract types — match `mapping.ts:17`):
```typescript
import type { PalletDims, PlacementOut } from './fixture-types'; // mapping.ts:17 — type-only sibling import
```
New file imports only its contract types + (if reusing parse) `typeKeyOf` from `./mapping`. No runtime imports.

**Pure exported-function pattern** (mirror `mapPlacement` — small, total, non-mutating, named export with a doc comment; `mapping.ts:32-49`):
```typescript
/**
 * Map one API placement into a Three.js mesh transform.
 * Consumes ONLY `position` + `dimensions` — `orientation.perm` is intentionally ignored.
 */
export function mapPlacement(p: PlacementLike, pallet: PalletXZ, typeKey: string): MappedBox {
```
Builder mirrors this shape: `export function buildPackRequest(config: PackConfig): { request: PackRequest; idToType: Map<string, string> }`.

**Baked-constant pattern** — VERIFIED option block from fixture (`pack-request.json` options = `{max_pallets:2, time_budget_s:25, seed:7, support_ratio:0.8}`; pallet = `{length:1000, width:800, height:1000, max_weight:250, max_overhang:0}`). Declare baked constants at module top as `as const` (mirrors `palette.ts:7` `SEED_COLORS` and `mapping.ts:19` `DECK_TOP_Y`):
```typescript
const BAKED_OPTIONS = { time_budget_s: 25, seed: 7, support_ratio: 0.8 } as const; // D-03, sent not user-facing
```

**ID scheme + parse-fallback compatibility** — reuse `typeKeyOf` as the FALLBACK channel only (`mapping.ts:55-58`):
```typescript
export function typeKeyOf(itemId: string): string {
  const m = /^[^\d]+/.exec(itemId);   // leading non-digit prefix: T000->T, D003->D
  return m ? m[0] : itemId;
}
```
Per D-07: builder `typeId` must be a non-digit-leading slug so this parse stays correct on the fallback path; the returned `Map<id,typeId>` is the primary, format-independent channel. Captured fixture (`D003`) round-trips via `typeKeyOf`.

---

### `src/lib/result-mapper.ts` (pure transform, done response → view model)

**Analog:** `src/lib/mapping.ts` (purity + recovery) and `src/lib/palette.ts` (key compatibility)

**Input types** come from the consolidated response interfaces (currently `fixture-types.ts` — `DoneResponse`/`DoneResult`/`PalletResult`/`PlacementOut`/`UnpackedItem`/`InputSummary`/`Cog`, lines 11-85). Type the mapper input from these verbatim.

**Non-mutating single pass + key compatibility** — `byType` keys MUST equal what `colorForType` consumes. `colorForType` dedupes+sorts its input (`palette.ts:15-25`):
```typescript
export function colorForType(typeKeys: string[]): Map<string, string> {
  const sorted = [...new Set(typeKeys)].sort();   // legend stability — keys must be the recovered typeIds
```
So `[...view.byType.keys()]` fed to `colorForType` yields the stable legend. Recovery: `idToType?.get(id) ?? typeKeyOf(id)` (map primary, parse fallback). Never assign onto input items — spread `{ ...it, typeId }` (Pitfall 5).

**Output shape (D-08)** — `{ summary, pallets, byType, unpacked }`; `cog` and `support_ratio` passed RAW (no Three.js mapping, no tint bucketing — that's Phase 6). `mapPlacement` stays untouched; the mapper does NOT call it.

---

### `src/lib/request-builder.test.ts` and `result-mapper.test.ts` (tests)

**Analog:** `src/lib/mapping.test.ts` (lines 1-8, 41-47) and `palette.test.ts` (lines 1-20)

**Test wiring pattern** (copy verbatim — `@/` alias, fixture JSON import, jsdom-WebGL-free, no Canvas/three):
```typescript
import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts / Hello.test.tsx: @/ alias, jsdom-WebGL-free.
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract'; // (or '@/lib/fixture-types' if shim kept)
const done = doneResponse as DoneResponse;
```

**Golden-literal assertion pattern** (assert exact captured values, NOT formula-derived — `mapping.test.ts:17-22`):
```typescript
// Literal numbers (NOT re-derived from the formula) so a formula bug fails loudly.
expect(m.size).toEqual([250, 700, 250]);
```
Builder test: assert the built request equals `pack-request.json` shape (ids `D000`/`D001`…, `rotations` strings, options block). Mapper test: the SC-1 round-trip centerpiece — `[...view.byType.keys()].sort()` → `['D','F','T']`, `view.pallets` length 2, `view.unpacked` length 7, `summary.items_packed` exact.

**Determinism/dedup assertion pattern** (mirror `palette.test.ts:9-18`):
```typescript
const a = colorForType(['F', 'T', 'D']);
const b = colorForType(['D', 'T', 'F']);
expect([...a.entries()]).toEqual([...b.entries()]); // sort-stable
```
Builder test mirrors this for id determinism: build same `PackConfig` twice, assert identical ids.

---

### `src/types/config.ts` and `src/types/pack-contract.ts` (contract types)

**Analog:** `src/lib/fixture-types.ts`

**Plain-interface, zero-import pattern** (`fixture-types.ts:1-9, 11-85`): hand-written `export interface` blocks, NO `zod` (deferred to Phase 5), NO runtime imports — preserves the code-split gate for anything `src/lib/` imports. Copy the module-header note verbatim in spirit:
```typescript
// These types must be safe to import from anywhere, so this file imports nothing
// (no `three`, no React) to preserve code-split discipline.
```
`config.ts` = `PackConfig`/`BoxType`/`PalletConfig`/`RotationMode` (D-01). `pack-contract.ts` = request side (`PackRequest`/`BoxRequest`/`PackOptions`) + consolidated response side (moved from `fixture-types.ts` per D-02).

**Consolidation impact (VERIFIED importers of `./fixture-types`):** `src/lib/mapping.ts:17`, `src/lib/mapping.test.ts:5`, `src/lib/palette.test.ts:4`. Recommended: leave a one-line re-export shim at `src/lib/fixture-types.ts` (`export * from '@/types/pack-contract';`) so the Phase 2-locked `mapping.ts` is untouched. Planner's call (D-02).

## Shared Patterns

### Purity rule (HARD constraint — all new `src/lib/` files)
**Source:** `src/lib/mapping.ts:14-15`, `src/lib/fixture-types.ts:4-5`, `src/lib/palette.ts:5`
**Apply to:** `request-builder.ts`, `result-mapper.ts`, and any `src/types/*` file they import.
No runtime `three`, no React, no IO (`fs`/`path`/`fetch`). Type-only `three` at most (none needed here). Backstop: `scripts/check-code-split.mjs` build gate (SC-4).

### Test wiring
**Source:** `src/lib/mapping.test.ts:1-8`
**Apply to:** both new `*.test.ts`. Vitest globals via `{ describe, expect, it } from 'vitest'`; fixture via `@/lib/__fixtures__/*.json`; type-only contract import; cast `as DoneResponse`; no Canvas/three.

### Deterministic constants
**Source:** `src/lib/palette.ts:7` (`SEED_COLORS ... as const`), `src/lib/mapping.ts:19` (`DECK_TOP_Y`)
**Apply to:** builder's `BAKED_OPTIONS` (D-03) and rotation table. Use `as const` / typed `Record` for compiler-enforced totality.

### Type-from-id recovery (round-trip basis)
**Source:** `src/lib/mapping.ts:55-58` (`typeKeyOf`)
**Apply to:** builder ID-format constraint (non-digit-leading slug) and mapper fallback path. Reuse — do not re-implement a parser (Don't Hand-Roll).

## No Analog Found

None. Every new file has a strong existing analog. The one genuinely new design surface — the dual-return builder (`{ request, idToType }`) and the rotation mapping table — has no prior analog but is fully specified in RESEARCH.md Patterns 1-2; planner should follow those, with the purity + naming conventions above.

## Metadata

**Analog search scope:** `src/lib/`, `src/types/` (empty except `.gitkeep`), `src/lib/__fixtures__/`
**Files scanned:** `mapping.ts`, `mapping.test.ts`, `palette.ts`, `palette.test.ts`, `fixture-types.ts`, `pack-request.json`, `pack-done-response.json`
**Pattern extraction date:** 2026-06-04
