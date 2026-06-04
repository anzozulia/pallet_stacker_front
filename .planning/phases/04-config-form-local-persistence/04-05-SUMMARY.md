---
phase: 04-config-form-local-persistence
plan: 05
subsystem: ui
tags: [react-hook-form, useFieldArray, zod, forms, catalog, react]

# Dependency graph
requires:
  - phase: 04-01
    provides: extended BoxType model (label/maxLoad/fragile/rotation), DEFAULT_CONFIG, makeDefaultBoxType, packConfig schemas
  - phase: 04-02
    provides: tallyCatalog pure tally lib (BOX-05 badge counts)
  - phase: 04-04
    provides: Card / NumberField / Switch / SegmentedControl primitives
  - phase: 02-01
    provides: colorForType deterministic palette (stable per-id swatch)
provides:
  - BoxRow.tsx — one editable box-type row (dims, weight, qty, maxLoad, fragile↔maxLoad, 3-mode rotation, colour swatch, accessible remove)
  - BoxCatalogCard.tsx — useFieldArray CRUD list, Add-box-type (append + scroll + focus), live types/units badge, empty-catalog state
affects: [04-07, 04-06, config-form-assembly, run-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RHF useFormContext + useFieldArray composition: BoxCatalogCard owns the array, BoxRow reads context by index"
    - "fragile↔maxLoad in-session ref stash (Pattern 4 / D-08): ON zeroes+disables+stashes, OFF restores, default fallback after reload"
    - "Rows keyed on RHF field.id (Pitfall 3), never the array index"
    - "Live badge via useWatch(boxTypes) → pure NaN-safe tallyCatalog (Pattern 5)"
    - "scrollIntoView guarded with optional-call (?.) for jsdom/embedded-browser safety"

key-files:
  created:
    - src/features/config/BoxRow.tsx
    - src/features/config/BoxRow.test.tsx
    - src/features/config/BoxCatalogCard.tsx
    - src/features/config/BoxCatalogCard.test.tsx
  modified: []

key-decisions:
  - "BoxRow consumes RHF via useFormContext (not prop-drilled control/register) — keeps the row self-contained and the catalog wiring minimal"
  - "Numeric fields registered as-is (strings); the zod schema coerces (Pattern 1) — no per-field setValueAs"
  - "scrollIntoView call guarded (?.) so jsdom (no scrollIntoView) never throws in the rAF focus callback — keeps the component test green and embedded browsers safe"
  - "box id rendered read-only in an id-tag + a hidden input keeps it on the form but non-editable (T-4-05)"

patterns-established:
  - "Pattern: feature card composes Plan-04 primitives + RHF context, three-free (C-05)"
  - "Pattern: empty-collection state lives in the list area, is a valid editing state, and the Run gate (Plan 07) blocks on it"

requirements-completed: [BOX-01, BOX-02, BOX-03, BOX-04, BOX-05]

# Metrics
duration: ~9min
completed: 2026-06-04
---

# Phase 4 Plan 05: Box Catalog Vertical Slice Summary

**BoxRow + BoxCatalogCard: a react-hook-form `useFieldArray` box catalog with per-type dims/weight/qty/max-load, the fragile↔maxLoad interaction, a 3-mode rotation control, stable per-id colour swatches, a live types/units badge, and an empty-catalog state — fully three-free.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-04T20:14:00Z
- **Completed:** 2026-06-04T20:17:00Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments
- `BoxRow`: edits all per-type fields (L/W/H mm, weight kg, quantity pcs, max-load kg), the Fragile `Switch`, and the `Allowed rotation` 3-segment control; renders a stable `colorForType`-derived swatch keyed by the row's id and an accessible `Remove {label}` trash button.
- fragile↔maxLoad (D-08 / BOX-03): toggling ON disables + zeroes max-load and stashes the prior value in a per-session ref; OFF restores it (falling back to the default after a reload).
- `BoxCatalogCard`: `useFieldArray` add/remove (keyed on `field.id`), `Add box type` appends `makeDefaultBoxType()` then scrolls + focuses + selects the new row, a live `{N} types · {M} units` badge, and the "No box types yet" empty state.
- Component tests cover the fragile toggle, the rotation control, the remove aria-label, add/remove CRUD, the empty state, and live badge counts — all jsdom/WebGL-free.

## Task Commits

Each task was committed atomically:

1. **Task 1: BoxRow with fragile↔maxLoad, rotation, swatch** - `a7a37be` (feat)
2. **Task 2: BoxCatalogCard (useFieldArray CRUD + badge + empty state)** - `94c67fa` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/features/config/BoxRow.tsx` - One editable box-type catalog row (all per-type fields, fragile↔maxLoad, rotation, swatch, remove).
- `src/features/config/BoxRow.test.tsx` - Fragile↔maxLoad + rotation + remove-aria-label tests.
- `src/features/config/BoxCatalogCard.tsx` - useFieldArray list, Add box type, live badge, empty-catalog state.
- `src/features/config/BoxCatalogCard.test.tsx` - Add/remove/empty-state/badge tests.

## Decisions Made
- BoxRow reads RHF via `useFormContext` rather than prop-drilled `control`/`register`, keeping the card→row wiring minimal and the row self-contained.
- Numeric fields are registered as strings and coerced by the zod schema (Pattern 1) — no per-field `setValueAs`.
- The box `id` is shown read-only (id-tag) and stored in a hidden input — never user-editable (T-4-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guarded `scrollIntoView` for jsdom / embedded-browser safety**
- **Found during:** Task 2 (BoxCatalogCard)
- **Issue:** The `Add box type` rAF callback called `lastRow.scrollIntoView(...)`. jsdom does not implement `scrollIntoView`, so the callback threw an uncaught `TypeError` during the component test (tests still passed, but the unhandled error is a latent crash and would also break on browsers lacking the API).
- **Fix:** Changed to optional-call `lastRow?.scrollIntoView?.({...})` so the focus/select still runs and the callback never throws.
- **Files modified:** src/features/config/BoxCatalogCard.tsx
- **Verification:** `npx vitest run src/features/config/BoxCatalogCard.test.tsx` — no uncaught exception, 4/4 pass.
- **Committed in:** `94c67fa` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Defensive guard only; no scope creep. All planned behavior intact.

## Issues Encountered
- None beyond the deviation above. Pre-commit hooks (eslint --fix + prettier) reformatted the new files cosmetically; behavior unchanged.

## User Setup Required
None - no external service configuration required.

## Threat Surface
No new threat surface beyond the plan's `<threat_model>`. The box `label` renders only as React text/attribute (auto-escaped, T-4-XSS-2); the `id` is read-only (T-4-05). No `dangerouslySetInnerHTML`, no network/file/auth surface.

## Verification
- `npx vitest run src/features/config/BoxRow.test.tsx src/features/config/BoxCatalogCard.test.tsx` — 9 pass.
- `npm run test` — 96 pass (14 files).
- `npm run typecheck` — clean.
- `npm run build && node scripts/check-code-split.mjs` — PASSED; three lives only in the lazy `ResultPage` chunk, catalog slice is in the three-free entry chunk.
- `grep -c "from 'three'|/viewer/"` on both components — 0.

## Next Phase Readiness
- Catalog slice ready for the form-assembly + Run-gate plan (04-07): mount `BoxCatalogCard` inside the page-level `FormProvider` seeded from `DEFAULT_CONFIG`.
- Runs parallel-clean with the Pallet card (04-06) — no shared files.

## Self-Check: PASSED

---
*Phase: 04-config-form-local-persistence*
*Completed: 2026-06-04*
