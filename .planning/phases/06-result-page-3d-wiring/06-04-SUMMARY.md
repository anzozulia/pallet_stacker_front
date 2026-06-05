---
phase: 06-result-page-3d-wiring
plan: 04
subsystem: ui
tags: [react, result-page, rail, placement-list, unpacked-panel, three, emissive, hover, e2e, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: MappedPallet.items (PlacementOut & {typeId}), ResultView.unpacked, summarise
  - phase: 06-02
    provides: ResultPage carrier (live cache, selectedPalletIndex, hoveredId/setHoveredId seam, buildPalette)
  - phase: 06-03
    provides: rail mounts SummaryBlock + PalletSwitcher; CameraPresets measureNonce/bboxRef camera-preservation
  - phase: 03-pure-transform-core
    provides: typeKeyOf parse-fallback type recovery; pack-contract types
provides:
  - "PlacementList: per-selected-pallet placement cards (swatch + item_id + orientation tag + weight + typeId sub-line + Size/Position/Support grid) with ONE-WAY hover→onHover(item_id|null) (RESULT-05 / D-11 / DIAG-02)"
  - "UnpackedPanel: conditional whole-job panel (Could-not-pack rows: id / recovered type / dims / weight / reason as plain text) OR an `All items packed ✓` --color-pos affordance when none (RESULT-06 / D-06)"
  - "Boxes hoveredId?: string|null prop → declarative emissiveIntensity={hoveredId===b.id?0.45:0} (r3f patches the live material in place; no imperative emissive.set, no ref, no remount, no InstancedMesh — D-11/D-12)"
  - "ResultPage rail wired: PlacementList (selMapped.items, onHover=setHoveredId) + UnpackedPanel (view.unpacked, idToType) mounted; hoveredId passed to <Boxes>"
  - "ViewerOverlay data-viewer-legend hook so type-key assertions scope to the legend (rail now also renders type ids)"
affects: [06-05, result-page, cog-marker, support-heatmap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declarative hover→emissive: a parent state (hoveredId) flows as a prop to per-mesh <meshStandardMaterial emissiveIntensity={...}>; r3f diffs the prop and patches the live material in place — never imperative material.emissive.set, never a remount (D-11)"
    - "One-way hover link: the DOM card owns onMouseEnter/Leave → onHover(item_id|null); the rail block keeps a local hovered id only for its OWN accent cue, never reading back from the mesh (D-11)"
    - "Conditional whole-job block: UnpackedPanel renders the Could-not-pack section ONLY when unpacked.length>0, else a calm single-line positive affordance — no empty-state block (D-06)"
    - "Rail components stay three-free even inside the lazy /result subtree (code-split gate green): PlacementList + UnpackedPanel import no 3D renderer/viewer module"
    - "Test-hook for occlusion-robust WebGL e2e: a data-* attribute on the DOM card (data-placement-card) + iterate cards until one glows, since back/bottom boxes are occluded in the ISO frame"

key-files:
  created:
    - src/components/result/PlacementList.tsx
    - src/components/result/PlacementList.test.tsx
    - src/components/result/UnpackedPanel.tsx
    - src/components/result/UnpackedPanel.test.tsx
  modified:
    - src/components/viewer/Boxes.tsx
    - src/components/viewer/ViewerOverlay.tsx
    - src/routes/ResultPage.tsx
    - e2e/api-poll.spec.ts
    - e2e/result-viewer.spec.ts

key-decisions:
  - "Hover highlight is declarative-only: emissiveIntensity is a prop on the per-mesh material; r3f patches it in place (D-11) — no material.emissive.set, no ref, no remount, no InstancedMesh (D-12, ≤19 boxes)"
  - "PlacementList holds a LOCAL hovered id (for its own accent border) in addition to calling onHover — keeps the block self-contained while the mesh glow is owned by ResultPage state (one-way, D-11)"
  - "Support % is ALWAYS shown on every placement card (DIAG-02) — never gated behind hover; every datum readable without hovering (a11y)"
  - "Placement note copy corrected to `positions are box min-corner · mm · origin = pallet corner` (C-01) — NOT the mockup's box-centre"
  - "UnpackedPanel reason rendered as PLAIN React text (V5 / T-06-07) — never a raw-HTML sink; grep gate 0 on both new rail files"
  - "Added data-viewer-legend to ViewerOverlay (Rule 1 fix): Task 3's rail type-id rows (typeId sub-line + unpacked type) collide with the legend's D/F/T text, breaking the pre-existing getByText('D', exact) e2e assertions — scope them to the legend container"
  - "e2e hover test iterates placement cards until one produces a canvas-pixel change: back/bottom boxes (e.g. T000 at the pallet corner) are occluded in the ISO frame, so a single .first() hover can render no visible glow even when correctly wired"

patterns-established:
  - "Pattern 1: declarative hover→emissive (prop-driven material patch, no imperative mutation, no remount)"
  - "Pattern 2: conditional whole-job rail block (render only when populated, else a calm positive affordance)"

requirements-completed: [RESULT-05, RESULT-06]

# Metrics
duration: 11min
completed: 2026-06-05
---

# Phase 6 Plan 04: Placement + Unpacked Vertical Slice Summary

**The result rail completes its reading surface: a per-selected-pallet Placement list (swatch + `item_id` + rotation tag + weight + `typeId` sub-line + a Size/Position/Support grid where the support% is ALWAYS shown, DIAG-02) whose one-way hover lights the matching box mesh via a declarative `emissiveIntensity` prop (D-11 — r3f patches the live material in place, no imperative `material.emissive.set`, no remount), and a conditional whole-job Unpacked panel (`Could not pack` rows with id / recovered type / dims / weight / reason-as-plain-text, or an `All items packed ✓` affordance when nothing is unpacked, D-06) — proven by an e2e that hovers a placement card and asserts the canvas pixels change then clear.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-05T10:09:55Z
- **Completed:** 2026-06-05T10:21:00Z
- **Tasks:** 4
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- **PlacementList (RESULT-05 / D-11 / DIAG-02, TDD):** one card per selected-pallet item — the 13px type swatch (`colorForType` by `typeId`), the mono `{item_id}` id-tag, an accent-weak rotation tag `{orientation.name}`, a right mono `{weight} kg`, the `{typeId}` sub-line, and a three-cell field grid: `Size L·W·H` (post-orientation dims), `Position x,y,z` (the API min-corner), and `Support` `{(support_ratio*100).toFixed(0)}%` (ALWAYS shown). Block head is `Placement` + a right mono `{palletLabel} · {N} items` (per-selected-pallet, D-03). The note reads `positions are box min-corner · mm · origin = pallet corner` (C-01 correction, not box-centre). `onMouseEnter` → `onHover(item_id)`, `onMouseLeave` → `onHover(null)` (one-way, D-11); the hovered card gets an accent border + accent-weak bg. Three-free; API strings as React text only (T-06-07).
- **UnpackedPanel (RESULT-06 / D-06, TDD):** when `unpacked.length > 0`, a `Could not pack` block + right mono `{N} items`, each row mirroring the BoxRow head — mono `{item_id}`, the recovered type (`idToType?.get ?? typeKeyOf`, C-03), dims `{L}·{W}·{H} mm`, `{weight} kg`, and the `{reason}` as PLAIN React text (V5 / T-06-07). When `unpacked.length === 0`, the block is OMITTED and a calm single-line `All items packed ✓` shows using the `--color-pos` token. Whole-job scope (does not change on switch); non-interactive. Three-free.
- **Boxes hover emissive (D-11/D-12):** `BoxesProps` gained `hoveredId?: string | null`; the per-mesh `<meshStandardMaterial>` now carries `emissive={b.color}` + `emissiveIntensity={hoveredId === b.id ? 0.45 : 0}`. Declarative — r3f diffs the prop and patches the live material in place. NO imperative `material.emissive.set`, NO ref, NO remount, NO InstancedMesh (individual meshes keep per-box emissive trivial, ≤19 boxes). `roughness={0.62} metalness={0.04}` and the `<Edges>` are unchanged.
- **Rail wired:** `ResultPage` mounts `PlacementList` (`selMapped.items`, `palette`, `palletLabel`, `onHover={setHoveredId}`) + `UnpackedPanel` (`view.unpacked`, `idToType`) after Summary + Switcher, and passes `hoveredId` to `<Boxes>`. The `hoveredId`/`setHoveredId` carrier seam (declared in Plan 06-02) is now fully consumed — the `void` placeholders removed.
- **e2e (RESULT-05 / D-11):** a new `api-poll.spec.ts` test drives the stubbed Configure→Run→Result flow to a populated `/result`, hovers placement cards (iterating to skip ISO-occluded boxes), asserts the card's `border-accent` cue fires AND the canvas pixels change (the matching mesh glowed), then moves off and asserts the pixels change again (the glow cleared). All routes stubbed; never the live API.

## Task Commits

1. **Task 1: Placement list cards + one-way hover wiring (RESULT-05, D-11)** — `d4e762d` (feat, TDD RED→GREEN)
2. **Task 2: Conditional unpacked panel with reasons (RESULT-06, D-06)** — `4fcd035` (feat, TDD RED→GREEN)
3. **Task 3: Boxes hoveredId emissive prop + wire placement/unpacked into rail (D-11)** — `966e161` (feat)
4. **Task 4: e2e hover→emissive glow + legend scoping fix (RESULT-05, D-11)** — `f1c0fd7` (test)

## Files Created/Modified

- `src/components/result/PlacementList.tsx` (created) — per-pallet placement cards + one-way hover; three-free
- `src/components/result/PlacementList.test.tsx` (created) — jsdom RTL test (datum render + hover callbacks)
- `src/components/result/UnpackedPanel.tsx` (created) — conditional whole-job panel + all-packed affordance; reason as plain text; three-free
- `src/components/result/UnpackedPanel.test.tsx` (created) — jsdom RTL test (populated + empty cases)
- `src/components/viewer/Boxes.tsx` — `hoveredId` prop + declarative `emissiveIntensity` (D-11)
- `src/components/viewer/ViewerOverlay.tsx` — `data-viewer-legend` test hook (Rule 1 fix for the e2e legend collision)
- `src/routes/ResultPage.tsx` — mount PlacementList + UnpackedPanel; pass `hoveredId` to Boxes; seam consumed
- `e2e/api-poll.spec.ts` — new hover→emissive test; legend assertions scoped to `[data-viewer-legend]`
- `e2e/result-viewer.spec.ts` — legend assertions scoped to `[data-viewer-legend]`

## Decisions Made

Captured in frontmatter `key-decisions`. Notable: the hover highlight is purely declarative (a prop-driven material patch, no imperative mutation/remount, D-11); support% is always visible (DIAG-02); the unpacked reason renders as plain text (T-06-07); and a `data-viewer-legend` hook was added so the rail's new type-id rows don't break the pre-existing legend e2e assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `data-viewer-legend` to ViewerOverlay + scoped the e2e legend assertions**
- **Found during:** Task 4 (first e2e run)
- **Issue:** Task 3 added the PlacementList `{typeId}` sub-line and the UnpackedPanel recovered `{type}` to the rail, so the type keys `D` / `F` / `T` now render in multiple places. Three pre-existing e2e assertions (`getByText('D', { exact: true })` in `api-poll` happy-path + `result-viewer` populated-canvas) and the new hover test went strict-mode-ambiguous (multiple matches), failing `toBeVisible`.
- **Fix:** Added a `data-viewer-legend` attribute to the ViewerOverlay legend container and changed the three legend assertions to `page.locator('[data-viewer-legend]').getByText('X', { exact: true })`, scoping them to the legend and away from the rail rows. Purely additive (a test hook), no behavior change.
- **Files modified:** src/components/viewer/ViewerOverlay.tsx, e2e/api-poll.spec.ts, e2e/result-viewer.spec.ts
- **Commit:** f1c0fd7

**2. [Rule 1 - Bug] e2e hover test iterates placement cards instead of hovering only `.first()`**
- **Found during:** Task 4 (hover test authoring)
- **Issue:** Hovering only the first card (T000, at the pallet's back-bottom corner) produced NO captured canvas-pixel change — the box is occluded by the stacked boxes in the default ISO frame, so its emissive glow is not visible from the camera even though the hover→emissive path is correctly wired (confirmed by the card's `border-accent` cue firing). The single-card assertion gave a false negative.
- **Fix:** The test iterates the placement cards (each confirmed to fire its `border-accent` cue) until one produces a visible canvas-pixel diff, then asserts the glow clears on mouse-leave. This proves the feature end-to-end without depending on which specific box happens to be camera-facing.
- **Files modified:** e2e/api-poll.spec.ts
- **Commit:** f1c0fd7

## Issues Encountered

None blocking. The two deviations above were both surfaced and resolved during the Task-4 e2e step (one a real test-collision regression from the new rail rows, one an occlusion false-negative in the WebGL assertion). The TDD jsdom tests for PlacementList + UnpackedPanel went RED→GREEN against the golden fixture (P001 items incl. support_ratio 1.0 → 100%; 7 unpacked `no_feasible_placement`) without iteration.

## Known Stubs

None. PlacementList renders the live `selMapped.items`; UnpackedPanel renders the live `view.unpacked` with `idToType` recovery; Boxes' `hoveredId` is fed from the now-consumed `setHoveredId` state. The rail is fully wired — the only remaining Phase-6 work (CoG marker / support heatmap overlays, Plan 06-05) is out of this plan's scope.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. T-06-07 (API `reason` / `item_id` / `orientation.name` / `typeId` rendered into the placement + unpacked rows): mitigated — every API string renders as React text children only; `grep -c dangerouslySetInnerHTML` over both new rail files returns 0. T-06-08 (NaN field render): the body is zod-parsed upstream and fields are read defensively (`.toFixed`, text). T-06-SC: no packages installed.

## Verification

- `npx vitest run` — full unit suite 30 files / 180 tests green (incl. PlacementList 2 + UnpackedPanel 2 new tests)
- `npm run typecheck` — clean
- `npm run build && node scripts/check-code-split.mjs` — code-split gate PASSED (three only in the lazy ResultPage chunk; entry chunk three-free; the two new rail blocks add no three, Boxes' emissive prop adds no new three import)
- `npx playwright test e2e/api-poll.spec.ts e2e/result-viewer.spec.ts` — 11 tests green (incl. the new hover→emissive test + the legend-scoped happy-path/populated-canvas assertions)
- `grep -c dangerouslySetInnerHTML` over PlacementList.tsx + UnpackedPanel.tsx — 0 (T-06-07)
- `grep -E "material.emissive.set|InstancedMesh"` over Boxes.tsx — comment-only (no imperative emissive set, no InstancedMesh code)
- `grep -E "^import .*(three|@react-three|@/components/viewer)"` over both new rail files — none (three-free)

## Self-Check: PASSED

All 4 created files present on disk (PlacementList + UnpackedPanel + their tests) plus the SUMMARY; all 4 task commits (d4e762d, 4fcd035, 966e161, f1c0fd7) found in git log.

## Next Phase Readiness

- The result rail is now complete for the placement/unpacked surface: Summary + Switcher (06-03) + PlacementList + UnpackedPanel (this plan), with the placement→mesh hover link live (D-11).
- Plan 06-05 (CoG marker / support heatmap overlays) can build on: the now-consumed `hoveredId` state, the declarative-emissive pattern in Boxes (a heatmap recolour would follow the same prop-driven material approach), and the current per-pallet bbox (CameraPresets `measureNonce`).
- The `data-viewer-legend` hook is available for any future overlay test that needs to scope legend assertions away from rail content.

---
*Phase: 06-result-page-3d-wiring*
*Completed: 2026-06-05*
