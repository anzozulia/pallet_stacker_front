---
phase: 06-result-page-3d-wiring
reviewed: 2026-06-05T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - src/components/result/PalletSwitcher.tsx
  - src/components/result/PlacementList.tsx
  - src/components/result/SummaryBlock.tsx
  - src/components/result/UnpackedPanel.tsx
  - src/components/viewer/Boxes.tsx
  - src/components/viewer/CameraPresets.tsx
  - src/components/viewer/CogMarker.tsx
  - src/components/viewer/ViewerOverlay.tsx
  - src/lib/cog-map.ts
  - src/lib/mapping.ts
  - src/lib/result-summary.ts
  - src/lib/support-scale.ts
  - src/routes/LoadingPage.tsx
  - src/routes/ResultPage.tsx
  - src/styles.css
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** deep (cross-file: import graph + call chains + golden-fixture cross-check)
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This phase wires `/result` to a live `done` payload from the react-query cache and adds pure
derivation modules plus the result-rail UI and 3D diagnostics. The coordinate/CoG/support math was
cross-checked against the captured golden fixture and is correct: `mapCog`'s axis convention
(cog.x→length→three-x, cog.y→width→three-z, cog.z→height→three-y) reproduces the weighted box
centroid of the fixture EXACTLY (491.597 / 368.697 / 497.059), and `mapPlacement`/`support-scale`
are sound. The react-query carrier-seam read, nav-state validation, and the camera-preservation
`bbox`-ref decoupling in `CameraPresets` are all implemented correctly.

The dominant defect is a **cross-module type-key mismatch** between two different type-recovery
schemes (`typeKeyOf` vs `idToType`) that diverge for the REAL production item-id format
(`${typeId}-${index}`). This is masked in unit tests because the committed golden fixture uses a
legacy no-hyphen id format (`T000`) where both schemes happen to agree. In production the swatch in
the Placement list and the legend label both break. This is a BLOCKER because it produces
user-visible incorrect output on every real job. The remaining findings are robustness/consistency
warnings and minor info items.

## Critical Issues

### CR-01: Placement-list swatch + legend key mismatch — palette keyed by `typeKeyOf` but looked up by `idToType` value (diverge on real ids)

**File:** `src/components/result/PlacementList.tsx:76`, `src/components/viewer/Boxes.tsx:25-30,58-63`, `src/routes/ResultPage.tsx:115-119,294-302`

**Issue:** Two incompatible type-recovery functions feed one shared `palette` map.

- `buildPalette` (Boxes.tsx:27) keys the palette by `typeKeyOf(item_id)` — the leading **non-digit**
  prefix.
- `PlacementList` (PlacementList.tsx:76) looks the swatch up by `item.typeId`, which
  `mapDoneResponse` (result-mapper.ts:56) recovered **map-PRIMARY** via `idToType.get(item_id)`.

For the real production id format these two disagree. `makeItemId` (request-builder.ts:40) emits
`` `${typeId}-${index}` `` and the request-builder test (request-builder.test.ts:86-91) locks the
golden ids as `Da-0`, `Tb-0`, `Fc-0`. Then:

- `idToType.get("Da-0")` → `"Da"`  (split on `-`, see request-builder.test.ts:120)
- `typeKeyOf("Da-0")` → `"Da-"`     (leading non-digit prefix INCLUDES the hyphen)

So the palette is keyed `"Da-"` while `PlacementList` requests `palette.get("Da")` → **miss** →
every card silently falls to the `?? '#6d63f5'` default swatch (PlacementList.tsx:76). Meanwhile the
3D box mesh (Boxes.tsx:58-63) keys by `typeKeyOf` → `"Da-"` → hit → a DIFFERENT colour. The
placement-card swatch and the box it describes therefore disagree by type, defeating the whole point
of the stable per-type swatch ("the SAME map as the legend / box tint" — PlacementList.tsx:31 doc).

This is NOT caught by tests because the committed `pack-done-response.json` fixture uses the legacy
`T000`/`D003` id format (no hyphen), where `typeKeyOf("T000") === "T"` and the override map also maps
to `"T"`, so the two schemes coincide. The live `${typeId}-${index}` format is never exercised end to
end against the palette/legend path.

Knock-on: the legend in `ViewerOverlay` (fed `legend = [...palette.entries()]`, ResultPage.tsx:119)
will render labels like `"Da-"` with a dangling hyphen instead of `"Da"`.

**Fix:** Pick ONE canonical type key and use it for the palette key, the lookup, and the legend
label. The cleanest fix is to key the palette by the SAME recovered `typeId` the rest of the page
uses, so build it from the mapped `view` (which already carries `typeId` per item and `byType` keys)
instead of re-parsing ids inside `buildPalette`:

```ts
// ResultPage.tsx — build palette from the recovered typeIds (byType keys), not raw ids:
import { colorForType } from '@/lib/palette';
// ...
const palette = useMemo(
  () => (view ? colorForType([...view.byType.keys()]) : new Map<string, string>()),
  [view],
);
```

Then change `Boxes` to tint by the recovered `typeId` rather than re-deriving via `typeKeyOf`
(pass each item's `typeId` through, e.g. consume `MappedPallet.items` which already has `typeId`, or
look up `idToType` the same way). The invariant to enforce: **the palette key, the box tint key, the
PlacementList lookup key, and the legend label are all the same recovered `typeId`.** Add a test
using `Da-0`-style ids (not the legacy `T000` fixture) asserting `palette.get(item.typeId)` is
defined for every placement.

## Warnings

### WR-01: Empty pallet produces a degenerate bbox → NaN camera, broken canvas

**File:** `src/components/viewer/CameraPresets.tsx:62-73`, `src/lib/camera-presets.ts:46-69,75-78`

**Issue:** If the selected pallet has zero items (`pallet.items === []`), the `<group>` in `Boxes`
renders no meshes, and `new Box3().setFromObject(group)` returns an EMPTY box: `getCenter` → `NaN`,
`getSize` → `-Infinity`. That flows into `presetFromBbox` (radius `Infinity`, position components
`NaN`) and `distanceLimitsFromBbox` (`Infinity` clamps), producing a NaN camera transform and a
blank/black viewer with no recovery. A solver legitimately can return a pallet object with an empty
`items` array, and `selPallet` is rendered unconditionally (ResultPage.tsx:240-246).

**Fix:** Guard the measurement against an empty/degenerate box and fall back to the pallet footprint:

```ts
const box = new Box3().setFromObject(group);
if (box.isEmpty()) {
  // fall back to pallet-deck dims so the camera still frames the empty deck
  setBbox({ center: [0, DECK_TOP_Y, 0], size: [pallet.L, 100, pallet.W] });
  return;
}
```

### WR-02: `Math.min(sel, length-1)` clamps low but never re-syncs `sel`; an empty `pallets` array yields index -1

**File:** `src/routes/ResultPage.tsx:125-128`

**Issue:** `selIndex = Math.min(sel, result.pallets.length - 1)` defends against a too-large `sel`,
but two edge cases slip through:

1. If `result.pallets` were ever empty, `selIndex` becomes `-1` and `result.pallets[-1]` is
   `undefined`, so `selPallet.dimensions` (line 128) throws. The `hasResult` guard only checks
   `done.result` exists, not that it has pallets. A `done` job with all items unpacked + zero pallets
   is contractually possible.
2. The `sel` state itself is never corrected, so a stale `sel` keeps re-clamping silently rather than
   resetting to a valid row — the PalletSwitcher highlight (`selected={selIndex}`) and `sel` can
   diverge across renders.

**Fix:** Add a pallets-non-empty condition to the result guard, and/or clamp with a `Math.max(0, …)`
floor plus reset `sel` when out of range:

```ts
const hasResult =
  !!done && done.status === 'done' && !!done.result && done.result.pallets.length > 0;
// and floor the index:
const selIndex = Math.min(Math.max(sel, 0), result.pallets.length - 1);
```

### WR-03: Per-pallet weight rendered raw (unrounded float) — inconsistent with the 1-decimal summary

**File:** `src/components/result/PalletSwitcher.tsx:78`, `src/components/result/PlacementList.tsx:113`, `src/components/result/UnpackedPanel.tsx:60`

**Issue:** `{p.totalWeight} kg`, `{item.weight} kg`, and the unpacked `{item.weight} kg` render the
raw API float with no formatting. The API returns floats (golden fixture `total_weight: 119.0`, and
arbitrary item weights). A value like `12.3400000001` or `4.5` will render unrounded, while
`SummaryBlock` deliberately formats totals to 1 decimal (`s.totalWeightKg.toFixed(1)`,
SummaryBlock.tsx:78) and the overlay sub-line uses `.toFixed(1)` (ResultPage.tsx:132). The result is
inconsistent precision between the rail blocks for the same underlying quantity.

**Fix:** Format weights consistently, e.g. `{p.totalWeight.toFixed(1)} kg` (and the same in
PlacementList / UnpackedPanel), or centralise a `formatKg` helper so all weight displays agree.

### WR-04: `view` memo lists redundant `done` + `result` deps and re-casts a non-null assertion

**File:** `src/routes/ResultPage.tsx:102,108-111`

**Issue:** `result` is derived from `done?.result` (line 102), then the `view` memo depends on
`[done, result, idToType]` and internally does `{ ...done!, result }`. `result` is fully a function of
`done`, so listing both is redundant; more importantly the `done!` non-null assertion inside the memo
is only safe because the `result ? … : null` ternary short-circuits when `result` is null — which is
correct today but is a fragile coupling (if someone removes the `result` guard the `done!` becomes an
unchecked deref). Not a live bug, but a latent footgun in the hottest derivation on the page.

**Fix:** Drop the assertion by guarding on `done` directly and removing the redundant dep:

```ts
const view = useMemo(
  () => (done?.result ? mapDoneResponse(done as DoneResponse, idToType) : null),
  [done, idToType],
);
```

### WR-05: `mapDoneResponse` cast loses runtime validation of the `result` body shape

**File:** `src/routes/ResultPage.tsx:102,108-109`, `src/api/pack-schema.ts:44`

**Issue:** `result` is typed `z.unknown().nullish()` at the poll boundary (pack-schema.ts:44) and the
page casts it to `DoneResult` (`as DoneResult`, line 102) without any runtime parse before handing it
to `mapDoneResponse`, which immediately does `done.result.pallets.map(...)` and reads
`p.items`, `p.cog`, `it.weight`, etc. (result-mapper.ts:60-80). The page header comment claims "The
body was zod-parsed upstream (Phase 5)" but pack-schema.ts deliberately leaves `result` as opaque
`unknown` — it is NOT shape-validated anywhere. A `done` job whose `result` is malformed (missing
`pallets`, or `pallets[i].items` not an array, or missing `cog`/`dimensions`) will crash the render
instead of degrading via the no-result guard. This contradicts the file's own stated threat model
(T-06-04: "redirects rather than crashing the render").

**Fix:** Either narrow the guard to validate the minimal shape it depends on before mapping, or add a
zod `doneResultSchema.safeParse` at this boundary and treat a parse failure like a missing result
(redirect home). At minimum, a defensive `Array.isArray(done.result.pallets)` check in `hasResult`.

## Info

### IN-01: `assertWithinEnvelope` uses `console.error` rather than throwing — silent in CI-as-dev

**File:** `src/lib/mapping.ts:78`

**Issue:** The dev-only AABB invariant logs `console.error` instead of throwing. A box that escapes
the pallet envelope (a genuine mapping regression) will scroll past in the console and not fail any
dev assertion or test run. The doc calls it a "sanity assertion," but it never asserts.

**Fix:** In DEV, `throw new Error(...)` (or use an actual assertion), so a coordinate regression fails
loudly during development/tests rather than emitting a log nobody reads.

### IN-02: Hover state duplicated between local `useState` and parent `onHover` — easy to desync

**File:** `src/components/result/PlacementList.tsx:58,85-92`

**Issue:** `PlacementList` keeps its own `hovered` state AND calls `onHover` on the same events. The
two are independent; if a future change adds an early-return or conditional to one branch they can
desync (card highlight vs mesh glow). Today they fire together so it works, but it is redundant state.

**Fix:** Derive the local accent from the parent-owned hovered id (lift the single source of truth to
ResultPage and pass `hoveredId` down), or keep only the local id and let the parent read it via the
same callback — but not both as independent stores.

### IN-03: Legend label rendered verbatim from the (parse-derived) type key

**File:** `src/components/viewer/ViewerOverlay.tsx:79-88`, `src/routes/ResultPage.tsx:119`

**Issue:** Downstream of CR-01, the legend prints the raw palette key as its human label. Even after
CR-01 is fixed, the label is whatever the recovered `typeId` string is (could be a long user catalog
id). No truncation/`title` is applied, so a long type id can overflow the top-right overlay column.
Cosmetic, but worth a `max-w`/`truncate` like the PalletSwitcher label uses (PalletSwitcher.tsx:76).

**Fix:** Add `truncate max-w-[…]` (and a `title={key}`) to the legend label span.

### IN-04: `--color-warn` token declared but intentionally unused

**File:** `src/styles.css:49`

**Issue:** `--color-warn` is defined and self-documented as "UNUSED on pallet rows (D-04)". This is a
deliberate parity token, not a defect, but a lint/dead-token sweep will flag it. Flagging only so it
is not mistaken for an oversight; no action required unless a token-usage gate is added.

**Fix:** None required — keep if the parity rationale stands; otherwise drop to reduce dead CSS.

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
