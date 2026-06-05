---
phase: 06-result-page-3d-wiring
plan: 05
subsystem: ui
tags: [react, three, r3f, drei, result-page, cog, support-heatmap, diagnostics, e2e]

# Dependency graph
requires:
  - phase: 06-01
    provides: mapCog(cog,{L,W}) golden cog.z point-map, supportColor(ratio) scale, DECK_TOP_Y export
  - phase: 06-02
    provides: ResultPage live-cache carrier, ONE persistent Canvas, selectedPalletIndex
  - phase: 06-03
    provides: rail SummaryBlock + PalletSwitcher; CameraPresets camera-preservation guard
  - phase: 06-04
    provides: Boxes declarative hoveredId emissive prop (no InstancedMesh, D-12); rail PlacementList (always-shown support%) + UnpackedPanel; data-viewer-legend hook
provides:
  - "CogMarker: an emissive marker sphere + drei <Line> deck drop-line at mapCog(selPallet.cog, {L,W}) — the golden cog.z up-axis point-map (DIAG-01); lazy /result chunk; per-pallet (moves on switch)"
  - "Boxes heatmap?: boolean colour mode — colour = heatmap ? supportColor(item.support_ratio) : by-type palette; individual meshes preserved (no InstancedMesh, D-12); emissive hover (D-11) keeps using the chosen colour"
  - "ViewerOverlay cogOn/heatmapOn role=switch toggles (aria-checked + aria-pressed); the legend swaps from the by-type swatches to a labelled support-scale key when the heatmap is ON"
  - "ResultPage: cogOn state (default ON, the differentiator) + heatmap state (default OFF, by-type is default); CogMarker rendered inside the Canvas; both toggle props wired to ViewerOverlay; heatmap wired to Boxes"
  - "Diagnostics e2e: CoG ON-by-default + toggle-OFF changes the canvas; heatmap ON recolours the canvas + swaps the legend; a placement card shows a support % — all stubbed, never the live API"
affects: [result-page, diagnostics, phase-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Toggle-driven scene diagnostic: a parent boolean (cogOn/heatmap) flows as a prop into the lazy r3f subtree; the marker is conditionally mounted (cogOn) and the box colour is selected by mode (heatmap) — declarative, no imperative scene mutation"
    - "Legend swap by mode: when the heatmap is ON the ViewerOverlay legend renders a static labelled support-scale key (mirroring src/lib/support-scale.ts buckets) instead of the by-type swatches, so colour is always paired with a label (a11y)"
    - "role=switch overlay toggle: aria-checked + aria-pressed both reflect on/off, accessible name from the visible label; reuses the preset-button active-fill styling (rgba(99,90,245,0.32))"
    - "jsdom viewer-subtree mock discipline: any new r3f/drei component added to the Canvas tree (here CogMarker, whose drei <Line> calls useThree()) must be mocked in ResultPage.test.tsx alongside Canvas/Boxes/Pallet/CameraPresets — the real scene is proven only in Playwright"

key-files:
  created:
    - src/components/viewer/CogMarker.tsx
  modified:
    - src/components/viewer/Boxes.tsx
    - src/components/viewer/ViewerOverlay.tsx
    - src/routes/ResultPage.tsx
    - src/routes/ResultPage.test.tsx
    - e2e/api-poll.spec.ts
    - e2e/smoke.spec.ts

key-decisions:
  - "CoG marker default ON (the stability-diagnostic differentiator, RESEARCH Open Q2); support heatmap default OFF (by-type colouring stays the default, D-10) — the per-card support% (Plan 04) is always shown regardless of the toggle"
  - "drei <Line> v10 API matched the PATTERNS skeleton (points/color/lineWidth/dashed) — no fallback to plain <line>+BufferGeometry needed; the drop-line runs from [x, DECK_TOP_Y, z] up to the mapped CoG [x,y,z]"
  - "CogMarker imports DECK_TOP_Y from @/lib/mapping and mapCog from @/lib/cog-map (the pure golden modules) — no half-dimension term, the CoG is already a centre point"
  - "Both ViewerOverlay toggles use role=switch with aria-checked AND aria-pressed; the legend swaps to a 5-stop labelled support-scale key (well supported → low support) when the heatmap is ON"
  - "Boxes keeps individual meshes (no InstancedMesh, D-12) so the heatmap recolour and the emissive hover both stay trivial declarative prop changes"

patterns-established:
  - "Pattern 1: toggle-driven scene diagnostic (conditional mount + colour-by-mode, declarative, no imperative scene mutation)"
  - "Pattern 2: legend swap by mode (labelled support-scale key paired with colour when the heatmap is ON)"

requirements-completed: [DIAG-01, DIAG-02]

# Metrics
duration: 13min
completed: 2026-06-05
---

# Phase 6 Plan 05: Stability Diagnostics Vertical Slice Summary

**The differentiating stability-diagnostics slice: each selected pallet's centre-of-gravity renders in the 3D scene as an emissive marker sphere + a drei `<Line>` drop-line to the deck (via the golden `mapCog` cog.z point-map, DIAG-01), toggle-able via a default-ON `Centre of gravity` overlay switch that moves on pallet switch; plus an opt-in `Support heatmap` switch (default OFF) that recolours the box meshes by the pure `supportColor` scale and swaps the legend to a labelled support key (DIAG-02) — individual meshes preserved (no InstancedMesh, D-12), proven in the real scene by a stubbed diagnostics e2e, with the full phase gate (180 unit + 14 e2e + typecheck + build + code-split) green.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-05T10:17:00Z
- **Completed:** 2026-06-05T10:30:00Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- **CogMarker (DIAG-01, D-10):** a new lazy-chunk r3f component taking `cog` + `palletL`/`palletW`; computes `[x,y,z] = mapCog(cog, {L,W})` (the golden cog.z up-axis point-map, no half-dimension term), renders an emissive white marker sphere at the CoG and a drei `<Line>` dashed drop-line from `[x, DECK_TOP_Y, z]` (the deck) up to the CoG. Per-selected-pallet — ResultPage feeds `selPallet.cog` + footprint so it moves on a pallet switch. All three/drei imports stay in the lazy /result subtree (code-split gate green).
- **Boxes support-heatmap colour mode (DIAG-02, D-10):** `BoxesProps` gained `heatmap?: boolean`; the mapped `useMemo` selects `color = heatmap ? supportColor(item.support_ratio) : (palette.get(typeKey) ?? '#888888')`. The emissive hover prop (D-11) continues to use the chosen `color`. Individual meshes preserved (no InstancedMesh, D-12) — both the recolour and the hover glow stay trivial declarative prop changes.
- **ViewerOverlay toggles + legend swap (D-10):** added `cogOn`/`onToggleCog` + `heatmapOn`/`onToggleHeatmap`; a top-center pair of `role=switch` toggles (`Centre of gravity`, `Support heatmap`) with `aria-checked` + `aria-pressed` reflecting on/off, reusing the preset-button active-fill styling. When the heatmap is ON the legend renders a 5-stop labelled support-scale key (well supported → low support) in place of the by-type swatches, so colour is always paired with a label.
- **ResultPage wiring:** `cogOn` state (default `true`) + `heatmap` state (default `false`); `<CogMarker>` conditionally rendered inside the persistent `<Canvas>` fed the selected pallet's `cog` + dimensions; `heatmap` passed to `<Boxes>`; all four toggle props passed to `<ViewerOverlay>`. The per-card support% (Plan 04) is unaffected by the toggle.
- **Diagnostics e2e (DIAG-01/02):** a new `api-poll.spec.ts` test drives the stubbed Configure→Run→Result flow to a populated `/result`, then asserts (a) `Centre of gravity` is present + ON by default (`aria-checked=true`) and toggling it OFF changes the canvas pixels (marker gone); (b) `Support heatmap` is OFF by default and toggling it ON changes the canvas pixels (recolour) + swaps the legend (`well supported` appears, the by-type `D` key disappears); (c) a placement card shows a `%` support value. All routes stubbed; never the live API.

## Task Commits

Each task was committed atomically:

1. **Task 1: CoG marker + diagnostics overlay toggles + scene wiring (DIAG-01, D-10)** — `adaa261` (feat)
2. **Task 2: Boxes support-heatmap colour mode (DIAG-02, D-10)** — `d02b0d8` (feat)
3. **Task 3: Diagnostics e2e + phase-gate fixes (DIAG-01/02)** — `7239764` (test)

## Files Created/Modified

- `src/components/viewer/CogMarker.tsx` (created) — emissive marker sphere + drei `<Line>` deck drop-line at `mapCog`; lazy chunk
- `src/components/viewer/Boxes.tsx` — `heatmap?: boolean` colour mode (`supportColor` when ON); individual meshes preserved
- `src/components/viewer/ViewerOverlay.tsx` — `cogOn`/`heatmapOn` `role=switch` toggles + support-scale legend swap
- `src/routes/ResultPage.tsx` — `cogOn` (default ON) + `heatmap` (default OFF) state; CogMarker inside the Canvas; toggle + heatmap props wired
- `src/routes/ResultPage.test.tsx` — mock CogMarker (Rule 1 fix: drei `<Line>` `useThree()` throws in jsdom)
- `e2e/api-poll.spec.ts` — new DIAGNOSTICS test (CoG + heatmap toggles)
- `e2e/smoke.spec.ts` — aligned the stale `/result` deep-link to the 06-02 carrier redirect contract (Rule 1 fix)

## Decisions Made

Captured in frontmatter `key-decisions`. Notable: CoG default ON (differentiator) / heatmap default OFF (by-type default, D-10); the drei `<Line>` v10 API matched the skeleton (no `<line>`+BufferGeometry fallback needed); both toggles are `role=switch` with `aria-checked`+`aria-pressed`; the legend swaps to a labelled support-scale key when the heatmap is ON; individual meshes (no InstancedMesh, D-12) keep both recolour and hover trivial.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mocked CogMarker in ResultPage.test.tsx (jsdom drei `<Line>` crash)**
- **Found during:** Task 3 (phase-gate vitest run)
- **Issue:** Task 1 added `<CogMarker>` to the Canvas subtree. The jsdom `ResultPage.test.tsx` mocks the WebGL viewer subtree (Canvas/Boxes/Pallet/CameraPresets) but not the new CogMarker — its drei `<Line>` calls `useThree()`, which throws "Hooks can only be used within the Canvas component!" because the mocked Canvas is a plain `<div>`, not a real r3f provider. Two ResultPage carrier tests failed.
- **Fix:** Added a `vi.mock('@/components/viewer/CogMarker', ...)` lightweight DOM stand-in, mirroring the existing viewer-subtree mocks. The real CoG marker is proven in the Playwright diagnostics e2e. Purely a test-mock addition; no behavior change.
- **Files modified:** src/routes/ResultPage.test.tsx
- **Verification:** `npx vitest run` — 180/180 green
- **Committed in:** 7239764 (Task 3 commit)

**2. [Rule 1 - Bug] Aligned the stale `e2e/smoke.spec.ts` `/result` deep-link to the 06-02 carrier contract**
- **Found during:** Task 3 (phase-gate playwright run)
- **Issue:** `smoke.spec.ts` (last touched in Plan 01-03) does a bare `page.goto('/result')` and asserts a `<canvas>` mounts. Since the Plan 06-02 carrier change, a bare `/result` deep-link with no cache/nav-state hits the no-result guard and redirects to `/` (C-02 — the result is ephemeral). The stale assertion failed in the phase-gate playwright run. This is a pre-existing regression from 06-02 (confirmed: `smoke.spec.ts` predates the carrier change) that the phase gate surfaced.
- **Fix:** Rewrote the smoke test to assert the carrier redirect contract (deep-link → `/`) with no webgl/three console errors, mirroring the canonical assertion already in `result-viewer.spec.ts`. The populated-mount path stays covered by `result-viewer.spec.ts` + `api-poll.spec.ts` via the full stubbed flow.
- **Files modified:** e2e/smoke.spec.ts
- **Verification:** `npx playwright test` — 14/14 green
- **Committed in:** 7239764 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — one a jsdom test-mock gap from the new CogMarker, one a stale pre-existing e2e the phase gate required green).
**Impact on plan:** Both fixes were necessary to make the mandated phase gate pass; neither changed production behavior (one a test mock, one a stale-test correction to the established carrier contract). No scope creep.

## Issues Encountered

None blocking. Both deviations above surfaced during the Task-3 phase-gate run and were resolved in-place. The drei `<Line>` v10 API matched the PATTERNS skeleton, so no `<line>`+BufferGeometry fallback (RESEARCH A4) was needed.

## Known Stubs

None. CogMarker renders the live `selPallet.cog`; the heatmap reads live `item.support_ratio` via the golden `supportColor` scale; both toggles drive real state into the persistent scene. No placeholder data, empty returns, or TODO markers.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. T-06-09 (NaN scene transform from a malformed `cog`/`support_ratio`): accepted — the body is zod-parsed upstream and `mapCog`/`supportColor` are pure/golden-tested; a NaN would render an off-screen/invisible marker, not crash. T-06-10 (info disclosure): only static literal legend keys/toggle labels added to the DOM; the scene is WebGL, not an HTML-injection sink. T-06-SC: no packages installed (`npm ci` against the pinned lockfile only).

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run` — full unit suite 30 files / 180 tests green (incl. the 5 ResultPage carrier tests with the new CogMarker mock)
- `npm run typecheck` — clean
- `npm run build && node scripts/check-code-split.mjs` — code-split gate PASSED (three only in the lazy ResultPage chunk; entry chunk three-free; CogMarker's drei `<Line>` + supportColor stay in the lazy chunk; the pure src/lib modules stay three-free)
- `npx playwright test` — 14 tests green (incl. the new DIAGNOSTICS CoG+heatmap test, the placement-hover, the pallet-switch camera-preservation, and the corrected smoke deep-link redirect)
- **PHASE GATE:** `npx vitest run && npm run typecheck && npm run build && node scripts/check-code-split.mjs && npx playwright test` — all green
- `grep -E "InstancedMesh"` over Boxes.tsx — comment-only (no InstancedMesh code; D-12 preserved)

## Self-Check: PASSED

CogMarker.tsx present on disk + the SUMMARY; all 3 task commits (adaa261, d02b0d8, 7239764) found in git log.

## Next Phase Readiness

- **Phase 6 is complete.** The full result vertical is shipped: the live-cache carrier (06-02), the persistent Canvas + pallet switcher (06-02/03), the camera-preservation guard (06-03), the rail reading surface (Summary + Switcher + PlacementList + UnpackedPanel, 06-03/04), the declarative hover→emissive link (06-04), and now the CoG marker + support-heatmap diagnostics (this plan) — a user can see each pallet's CoG and per-box support diagnostics in the explorable scene (SC-5).
- The full phase gate (unit + e2e + typecheck + build + code-split) is green and is the regression guard for any later work.
- Carry-forward (unchanged): the InstancedMesh ~100–200 box threshold remains an estimate; individual meshes are well within it for single-pallet counts.

---
*Phase: 06-result-page-3d-wiring*
*Completed: 2026-06-05*
