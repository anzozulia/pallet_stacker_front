---
phase: 06-result-page-3d-wiring
plan: 03
subsystem: ui
tags: [react, result-page, rail, summary, pallet-switcher, camera, three, e2e, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: summarise(view, maxPallets) whole-job aggregation (RESULT-03)
  - phase: 06-02
    provides: ResultPage carrier seam (live cache read, mapDoneResponse, selectedPalletIndex `sel`/`setSel`, empty rail placeholder, CameraPresets bbox effect)
  - phase: 03-pure-transform-core
    provides: mapDoneResponse → ResultView/MappedPallet (items/utilisation/totalWeight), pack-contract types
provides:
  - "SummaryBlock: whole-job 2×2 stat block (Pallets used / Utilisation+fill-bar / Unpacked / Total weight) over the pure summarise()"
  - "PalletSwitcher: single-select group (index chip + pallet_id label + {boxes}·{kg} meta + neutral fill%) — onSelect(i) drives selectedPalletIndex"
  - "ViewerOverlay subline prop: computed per-selected-pallet `{N} boxes placed · {fill}% fill · {kg} kg` under the dims tag (D-03)"
  - "CameraPresets measureNonce prop + bboxRef decoupling: a pallet swap re-measures the bbox WITHOUT re-framing the camera (D-02 / Pitfall-3 fix)"
  - "ResultPage rail wired: SummaryBlock + PalletSwitcher mounted; mapped `view` assigned; subline + measureNonce passed; setSel consumed"
affects: [06-04, 06-05, result-page, placement-list, unpacked-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rail block chrome: Card surface/border/radius tokens (rounded-[var(--radius-lg)] border-border bg-surface shadow) headed by the mono uppercase accent-dot SectionLabel — reused across all src/components/result/* blocks"
    - "Single-select group: each row a real <button> with aria-pressed + Enter/Space; non-colour-only selected cue (accent border + inset ring + FILLED index chip) per UI-SPEC a11y"
    - "Effect-deps decoupling for r3f: hold the latest measured Box3 in a ref so the preset-animation effect targets a correct frame WITHOUT depending on the bbox state — a data-driven re-measure (pallet swap) never re-fires the framing animation (D-02)"
    - "Rail components three-free even inside the lazy /result subtree (code-split gate green): no 3D renderer / viewer import in SummaryBlock or PalletSwitcher"

key-files:
  created:
    - src/components/result/SummaryBlock.tsx
    - src/components/result/SummaryBlock.test.tsx
    - src/components/result/PalletSwitcher.tsx
    - src/components/result/PalletSwitcher.test.tsx
  modified:
    - src/components/viewer/ViewerOverlay.tsx
    - src/components/viewer/CameraPresets.tsx
    - src/routes/ResultPage.tsx
    - e2e/api-poll.spec.ts

key-decisions:
  - "SummaryBlock renders its own Card-token surface (not the Card primitive) so the SectionLabel `Summary` heads it without the Card title duplicating the label"
  - "Formatting lives in the component (summarise stays raw, 06-01): util/weight to 1 decimal, counts as integers, all values mono tabular-nums; maxPallets denominator shown only when supplied"
  - "PalletSwitcher fill% is NEUTRAL regardless of value (D-04) — no --color-warn/amber, no client-side fill threshold; proven by a test asserting no warn/amber class in the markup"
  - "Pallet label is pallet_id with `Pallet N` (1-based) fallback — never A/B/C (D-05)"
  - "Pitfall-3 fix: CameraPresets preset-animation effect deps drop `bbox` (read via bboxRef.current); a new measureNonce prop (=selIndex) drives ONLY the re-measure effect, never the framing — so a swap keeps the camera put while distance limits stay reactive"
  - "ResultPage reads dims from the raw PalletResult (selPallet.dimensions) but the subline from the MappedPallet (selMapped.items/utilisation/totalWeight) — MappedPallet drops dimensions (A2/A3)"

patterns-established:
  - "Pattern 1: rail blocks compose Card-token surface + SectionLabel head; three-free; mono tabular-nums values"
  - "Pattern 2: r3f data-driven re-measure decoupled from camera animation via a ref + a dedicated nonce dep (no snap on swap)"

requirements-completed: [RESULT-03, RESULT-04]

# Metrics
duration: 6min
completed: 2026-06-05
---

# Phase 6 Plan 03: Summary + Switcher Vertical Slice Summary

**The result rail comes alive: a whole-job Summary block (pallets used / utilisation+fill-bar / unpacked / Σ weight over the pure `summarise`), a single-select Pallet switcher (index chip + `pallet_id` label + `{boxes}·{kg}` meta + NEUTRAL fill%, D-04/D-05) whose selection swaps the rendered pallet on the one persistent Canvas, and a computed per-selected-pallet overlay sub-line (D-03) — with a Pitfall-3 fix decoupling the bbox re-measure from the camera so a pallet swap preserves the user's orbit/zoom (D-02), proven by an e2e that asserts the camera position is unchanged while the canvas pixels differ.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-05T09:59:26Z
- **Completed:** 2026-06-05T10:05:24Z
- **Tasks:** 4
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **SummaryBlock (RESULT-03, TDD):** whole-job 2×2 stat grid over the pure `summarise(view, maxPallets)` — Pallets used `2` (`/ {maxPallets}` only when supplied), Utilisation `72.8 %` with the named-constant accent fill bar (4px / max-120px on a neutral `#edeef1` track, clamped 0–100%), Unpacked `7 / 38`, Total weight `211.0 kg`. Counts integer, util/weight 1-decimal, mono tabular-nums. Three-free (code-split gate).
- **PalletSwitcher (RESULT-04, TDD):** one `<button>` row per generated pallet — a 26×26 radius-7 index chip (FILLED accent when selected, neutral `#eceef1` otherwise), the `pallet_id` label (`Pallet N` fallback, never A/B/C, D-05), mono `{items.length} boxes · {totalWeight} kg`, and a right-side neutral `{fill}%` over a 46×3px neutral mini bar (D-04 — never amber). Single-select a11y: `aria-pressed`, Enter/Space, non-colour-only selected cue (accent border + inset ring + filled chip). `onSelect(i)` drives `setSel`.
- **Overlay sub-line (D-03):** `ViewerOverlay` gained an optional `subline` prop rendered under the dims tag (mono `text-xs --color-d-text-2`); `ResultPage` computes `{N} boxes placed · {fill}% fill · {kg} kg` from the selected `MappedPallet` (1-decimal fill + kg).
- **Camera-preserved-on-switch (D-02 / Pitfall 3):** `CameraPresets` preset-animation effect no longer lists `bbox` in its deps — it reads the latest measured bbox via `bboxRef.current` and animates ONLY on an explicit preset press (`preset`/`presetNonce`). A new `measureNonce` prop (passed `=selIndex`) drives the re-measure effect on a pallet swap, so the bbox/distance-limits stay correct WITHOUT the swap snapping the camera toward the active preset.
- **Rail wired:** `ResultPage` now assigns the mapped `view` (previously discarded), mounts `SummaryBlock` (whole-job) + `PalletSwitcher` (`view.pallets`, `selIndex`, `setSel`) in the rail aside, and passes the computed `subline` + `measureNonce` into the viewer chrome.
- **e2e (D-02):** a new `api-poll.spec.ts` test drives the stubbed Configure→Run→Result flow to a 2-pallet (`P001`/`P002`) `/result`, clicks the `P002` switcher row, asserts the row's `aria-pressed` flips true, the camera position is unchanged across the switch (<1mm epsilon — no snap), and the canvas pixels differ (the boxes swapped). All routes stubbed; never the live API.

## Task Commits

1. **Task 1: Whole-job Summary block (RESULT-03)** — `590cbbd` (feat, TDD RED→GREEN)
2. **Task 2: Single-select Pallet switcher (RESULT-04, neutral fill)** — `a261e1d` (feat, TDD RED→GREEN)
3. **Task 3: Overlay sub-line + camera-preserved-on-switch + wire rail (D-03/D-02)** — `72eb78c` (feat)
4. **Task 4: e2e — pallet switch preserves camera, swaps boxes (D-02)** — `081a9a3` (test)

## Files Created/Modified

- `src/components/result/SummaryBlock.tsx` (created) — whole-job 2×2 stat block over `summarise`; accent util fill bar; three-free
- `src/components/result/SummaryBlock.test.tsx` (created) — jsdom golden test (2 / 72.8 / 7-of-38 / 211.0, maxPallets affix, fill-bar present)
- `src/components/result/PalletSwitcher.tsx` (created) — single-select `<button>` rows; index chip + label + meta + neutral fill bar; a11y; three-free
- `src/components/result/PalletSwitcher.test.tsx` (created) — jsdom test (P001/P002, 19/12 boxes, 119/92 kg, single aria-pressed, click→onSelect(1), no warn/amber)
- `src/components/viewer/ViewerOverlay.tsx` — optional `subline` prop rendered under the dims tag (D-03); header restructured to a column
- `src/components/viewer/CameraPresets.tsx` — `measureNonce` prop + `bboxRef` decoupling; preset-animation effect drops `bbox` from deps (Pitfall-3 fix, D-02)
- `src/routes/ResultPage.tsx` — `view` assigned; rail mounts SummaryBlock + PalletSwitcher; `subline` + `measureNonce` passed; `setSel` consumed
- `e2e/api-poll.spec.ts` — new pallet-switch camera-preserved / scene-changed test

## Decisions Made

Captured in frontmatter `key-decisions`. Notable: SummaryBlock renders its own Card-token surface (not the Card primitive) to avoid a double `Summary` heading; formatting lives in the component while `summarise` stays raw; fill% is strictly neutral (D-04); the Pitfall-3 fix uses a ref + a dedicated `measureNonce` so the re-measure is decoupled from the framing animation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a `measureNonce` prop to CameraPresets rather than the plan's implied single bbox-from-ref**
- **Found during:** Task 3
- **Issue:** The plan's Pitfall-3 fix said to "remove `bbox` from [the animation effect's] dep array, capturing the latest bbox via a ref." But the original bbox-measure effect only ran on mount (`[boxesRef, onBbox]`), so after a pallet swap the bbox/distance-limits would go stale (Plan 06-02 measured once for a static fixture; this slice makes the pallet dynamic). Without a re-measure trigger the orbit distance clamps would be wrong for a differently-framed pallet, and a later explicit preset press would frame the OLD pallet's bbox.
- **Fix:** Added a `measureNonce` prop (passed `=selIndex` from ResultPage) to the re-measure effect deps so the bbox is re-measured on each swap and stored in both `bboxRef.current` (read by the animation effect) and the `bbox` state (drives reactive distance limits). The framing animation effect still depends ONLY on `preset`/`presetNonce`, so the swap re-measures WITHOUT re-framing — exactly the D-02 guarantee. Proven by the Task-4 e2e (camera unchanged, scene changed).
- **Files modified:** src/components/viewer/CameraPresets.tsx, src/routes/ResultPage.tsx
- **Commit:** 72eb78c

## Issues Encountered

None blocking. The `summarise`/`MappedPallet` golden values (P001: 19 boxes/119 kg/89%, P002: 12 boxes/92 kg/56%; whole-job 72.81%/211 kg/7-of-38) matched the fixture exactly, so the TDD tests went RED→GREEN without iteration.

## Known Stubs

None. SummaryBlock and PalletSwitcher are both wired to the live mapped `view` (no empty/placeholder data); the rail now renders real per-job and per-pallet stats. `hoveredId`/`setHoveredId` remain the declared-but-unread seam for the PlacementList hover link (Plan 04) — that is Plan 06-02's intentional carry-forward, unchanged and out of this plan's scope.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. T-06-05 (API `pallet_id` rendered into the switcher row + overlay): mitigated — every API string (`pallet_id`, dims, computed sub-line) renders as React text children only; `grep dangerouslySetInnerHTML` over all created/modified files returns 0. T-06-06 (NaN util/weight): the body is zod-parsed upstream and `.toFixed(1)` on a number is safe.

## Verification

- `npx vitest run` — full unit suite 28 files / 176 tests green (incl. SummaryBlock 3 + PalletSwitcher 4 new tests)
- `npm run typecheck` — clean
- `npm run build && node scripts/check-code-split.mjs` — code-split gate PASSED (three only in the lazy ResultPage chunk; entry chunk three-free; the new rail blocks add no three to the eager OR lazy-three boundary)
- `npx playwright test e2e/api-poll.spec.ts e2e/result-viewer.spec.ts` — 10 tests green (incl. the new pallet-switch camera-preserved-on-switch test + the existing preset-reframe regression guard)
- `grep -c dangerouslySetInnerHTML` over all created/modified files — 0 (T-06-05)

## Self-Check: PASSED

(populated below after file/commit verification)

## Next Phase Readiness

- The rail now renders the whole-job Summary + the per-pallet Switcher; selecting a pallet drives the canvas, the overlay title/dims/sub-line, and the switcher highlight in sync, with the camera preserved (D-02).
- The mount point and seam for Plans 04–05 are live: the `<aside data-result-rail>` flex column is ready for `PlacementList` (per-selected-pallet, consumes `selMapped.items` + the `hoveredId`/`setHoveredId` hover link) and `UnpackedPanel` (whole-job, `view.unpacked`).
- `CameraPresets` now correctly re-measures per-pallet bbox via `measureNonce` — Plans 04–05 (CoG marker / heatmap) can rely on a current bbox without re-introducing the snap.

---
*Phase: 06-result-page-3d-wiring*
*Completed: 2026-06-05*
