---
phase: quick-260607-1fa
plan: 01
subsystem: [config-form, result-rail, 3d-viewer]
tags: [ui-fix, declutter, 3d-pallet, code-split]
requires: [Phase 6 result wiring, request-builder, mapping.ts DECK_TOP_Y]
provides:
  - Full-width Configure footer; autosave-only persistence (no Save draft)
  - Allow-overhang switch (default OFF → 0); no Max pallets field
  - max_pallets = boxes.length (uncapped solver)
  - Result rail: human box-type labels; no Unpacked stat / orientation / position / caption
  - Opaque ISO/TOP/FRONT + diagnostic buttons
  - Two-direction block pallet with centered 3x3 support grid (deck top y=100 preserved)
affects:
  - src/features/config/*, src/types/config.ts, src/lib/request-builder.ts
  - src/components/result/{SummaryBlock,PlacementList}.tsx
  - src/routes/{LoadingPage,ResultPage}.tsx
  - src/components/viewer/{ViewerOverlay,Pallet}.tsx
tech-stack:
  added: []
  patterns:
    - "Switch-gated numeric field (Allow overhang mirrors BoxRow fragile↔maxLoad)"
    - "typeToLabel Map threaded request-builder → ConfigForm → LoadingPage → ResultPage → PlacementList"
    - "mmIntNonNeg zod variant (.min(0)) for overhang only; mmInt (.positive()) elsewhere"
key-files:
  created: []
  modified:
    - src/features/config/FooterBar.tsx
    - src/features/config/ConfigForm.tsx
    - src/features/config/PalletCard.tsx
    - src/features/config/schema.ts
    - src/features/config/defaults.ts
    - src/types/config.ts
    - src/lib/request-builder.ts
    - src/components/result/SummaryBlock.tsx
    - src/components/result/PlacementList.tsx
    - src/routes/LoadingPage.tsx
    - src/routes/ResultPage.tsx
    - src/components/viewer/ViewerOverlay.tsx
    - src/components/viewer/Pallet.tsx
    - (+ co-located tests and e2e/config-persist.spec.ts)
decisions:
  - "Remove only the Unpacked STAT from SummaryBlock; keep the Unpacked PANEL (locked user decision)"
  - "Allow-overhang default OFF → overhang field 0 + disabled; ON restores per-session value (fallback 40)"
  - "max_pallets sent as boxes.length so the solver is never artificially capped"
metrics:
  duration: ~50m
  completed: 2026-06-07
  tasks: 3
  files: 13 source + tests
---

# Phase quick-260607-1fa: Configure/Result/Viewer UI fixes Summary

Eleven UI/model fixes grouped into 3 atomic tasks: a full-width Configure footer with autosave-only
persistence, a switch-gated overhang field and removed Max-pallets control, a decluttered result rail
showing human box-type labels, and a realistic two-direction 3D pallet with opaque camera buttons.

## Tasks

- **Task A (#1-#4)** — `feat(260607-1fa)` `b474b0c`: full-width sticky footer mirroring the header;
  removed Save draft button/state/prop (debounced autosave retained); Allow-overhang switch
  (default OFF → 0, disabled); removed Max pallets field; `max_pallets = boxes.length`.
- **Task B (#5-#8, #11)** — `feat(260607-1fa)` `a47cea5`: removed Unpacked stat (panel kept);
  threaded `typeToLabel` end-to-end so placement cards show human labels; removed item_id chip,
  typeId sub-line, orientation badge, Position field, and min-corner caption (field grid now
  Size + Support).
- **Task C (#9, #10)** — `feat(260607-1fa)` `287a470`: opaque ISO/TOP/FRONT + diagnostic buttons;
  block pallet with top deck boards + perpendicular under-layer + centered 3x3 support-block grid.

## Deck-top invariant (#10)

The `Pallet` rework preserves `DECK_TOP_Y = 100`. The top deck boards are centred at
`y = BLOCK_H + DECK_H/2`, so their TOP FACE lands at exactly `BLOCK_H + DECK_H = 78 + 22 = 100` —
the value `mapping.ts` assumes when placing boxes (`center.y = DECK_TOP_Y + z + H/2`). The new
perpendicular stringer layer sits BELOW the top deck (top at `y = BLOCK_H`), and the 3x3 support
blocks sit below everything (`y = BLOCK_H/2`), so box placement is unchanged. The `BLOCK_H + DECK_H`
arithmetic and an inline invariant comment are present in `Pallet.tsx` (grep-verified).

## Placement labels (#6)

`typeToLabel` (`boxType.id → boxType.label`) is built in `request-builder.buildPackRequest`, returned
on `BuildResult`, and threaded through all five layers: ConfigForm nav state → LoadingPage
(`LoadingNavState` + `isLoadingNavState` Map guard + forwarded on the done navigation, added to the
effect dep array) → ResultPage (`ResultNavState` + `isResultNavState` optional-Map guard + read) →
PlacementList prop. Cards render `typeToLabel.get(item.typeId) ?? item.typeId`. Confirmed: placement
cards now show the human box-type label, with a raw-typeId fallback when none is threaded
(both covered by PlacementList unit tests).

## Deviations from Plan

None — plan executed as written. The only adjustments were mechanically-required test/type updates
the plan called out: `ConfigForm.test.tsx` (footer moved out of `<main>` so the tally assertion is
page-scoped), `BoxCatalogCard.test.tsx`/`BoxRow.test.tsx`/`box-fit.test.ts`/`palette-integration.test.ts`
(PalletConfig now carries `allowOverhang`, PackConfig no longer carries `maxPallets`), and the
LoadingPage test fixtures (added `typeToLabel`). The `SummaryBlock`/`result-summary` `maxPallets?`
display denominator was preserved (unrelated to the removed PackConfig field).

## Full Gate (final acceptance)

| Gate | Before | After |
|------|--------|-------|
| `npm test` | 194 passed (32 files) | 201 passed (32 files) |
| `npm run typecheck` | clean | clean |
| `npm run lint` | 0 errors, 1 warning (pre-existing router.tsx) | 0 errors, 1 warning (same) |
| `npm run build` | OK | OK (entry three-free, three in lazy ResultPage chunk) |
| `node scripts/check-code-split.mjs` | PASS | PASS |
| `npm run test:e2e` | 14 passed | 14 passed |

Regression watch (all intact): StrictMode loading-post re-fire (regression test green),
#5/#8 tally fix, camera-preservation-on-switch (e2e green), code-split discipline (entry three-free).

## Self-Check: PASSED
