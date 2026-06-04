---
phase: 04-config-form-local-persistence
plan: 07
subsystem: ui
tags: [react, react-hook-form, zod, localStorage, tanstack-forms, vitest, playwright, tailwind]

# Dependency graph
requires:
  - phase: 03-pure-transform-core
    provides: buildPackRequest (qty expansion + rotation mapping), PackConfig/BoxType types
  - phase: 04-config-form-local-persistence (prior plans)
    provides: zod schemas (strict submit + lenient restore), box-fit feasibility, config-tally, localStorage (de)serialize/guard, NumberField/Switch/SegmentedControl/Card primitives, BoxRow/BoxCatalogCard, PalletCard
provides:
  - ConfigForm host (useForm<PackConfig> + zodResolver + onSubmit/onChange timing + FormProvider)
  - Run gate (disabled-while-invalid → checkAllBoxesFit → buildPackRequest → console.log)
  - sticky FooterBar (live NaN-safe total + non-blocking >1000 large-job advisory + Save draft + Run)
  - useLocalStorageAutosave hook (restore-on-mount + debounced unconditional auto-save + flushSave; sole IO)
  - ConfigurePage rendering the real form (eager / chunk, three-free)
  - restore-after-reload Playwright E2E
affects: [Phase 5 (API Client & Async Polling), Phase 6 (Result Page & 3D Wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useForm restore-seeded defaultValues from a single IO hook; the hook owns ALL localStorage IO, pure guard lives in @/lib/config-persist"
    - "Run gate: handleSubmit(onValid) → checkAllBoxesFit → setError on row fit failures → buildPackRequest → console.log (no network this phase, D-06)"
    - "Debounced (~400ms) unconditional auto-save via form subscription — drafts persist even when invalid (D-04)"
    - "FooterBar useWatch('boxTypes') → tallyCatalog for live, NaN-safe total; >1000 advisory is strict and non-blocking"

key-files:
  created:
    - src/features/config/ConfigForm.tsx
    - src/features/config/ConfigForm.test.tsx
    - src/features/config/FooterBar.tsx
    - src/features/config/FooterBar.test.tsx
    - src/hooks/useLocalStorageAutosave.ts
    - e2e/config-persist.spec.ts
  modified:
    - src/routes/ConfigurePage.tsx

key-decisions:
  - "Restore guard coerces string|number→number (structure-only) because RHF stores numeric inputs as strings; the lenient packConfigShapeSchema z.number() was discarding valid drafts on reload"
  - "Empty-catalog boxTypes.min(1) error and per-row fit-check error wired to visible inline render targets (role=alert / BoxRow Dimensions field)"
  - "Run logs the PackRequest JSON to the console this phase (D-06); no network until Phase 5"

patterns-established:
  - "Single-IO hook: useLocalStorageAutosave is the only module touching localStorage; pure (de)serialize/guard stays in @/lib/config-persist"
  - "Run gate timing: mode:'onSubmit' + reValidateMode:'onChange' so WIP persists while invalid yet Run blocks with clear messages then live-updates"

requirements-completed: [BOX-05, BOX-06, PACK-03, DATA-02]

# Metrics
duration: ~22min
completed: 2026-06-04
---

# Phase 4 Plan 07: Configure Screen Integration & Local Persistence Summary

**The capstone vertical slice — the full Configure screen (topbar shell + Pallet card + Box catalog card + sticky footer) assembled on `/` with a zod-resolver Run gate (fit-check → buildPackRequest → console.log), a live NaN-safe footer total + non-blocking >1000 advisory, and debounced localStorage auto-save/restore that survives a refresh.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-04T20:27:57Z (Task 1 commit)
- **Completed:** 2026-06-04 (human visual checkpoint approved)
- **Tasks:** 4 (3 automated + 1 human-verify checkpoint)
- **Files modified:** 7 (6 created, 1 rewritten)

## Accomplishments
- `ConfigForm` host wires `useForm<PackConfig>` with `zodResolver(packConfigSubmitSchema)` (mode `onSubmit` / reValidate `onChange`), seeds defaultValues from the restore hook, and composes the topbar shell, `PalletCard`, `BoxCatalogCard`, and `FooterBar` under a `FormProvider`.
- The Run gate is disabled while invalid, runs `checkAllBoxesFit`, maps fit failures to inline row errors, and on a valid config logs the built `PackRequest` JSON to the console (no maxLoad/fragile box keys — D-08).
- The sticky `FooterBar` renders the live `{N} box types · {M} units · est. {K} kg` NaN-safe total, the non-blocking `Large job — …` advisory at strictly >1000 units, and the `Save draft → Saved ✓` flush affordance.
- `useLocalStorageAutosave` (the sole IO module) restores on mount and debounced-auto-saves drafts unconditionally (~400ms), with `flushSave` for Save draft and clean unmount.
- `ConfigurePage` now renders the real `<ConfigForm />` (placeholder gone), staying the eager three-free `/` chunk; restore-after-reload proven by a Playwright E2E against the production preview build.

## Task Commits

Each task was committed atomically:

1. **Task 1: Autosave/restore hook + sticky FooterBar** - `87c9b47` (feat) — TDD: hook + FooterBar + FooterBar.test.tsx
2. **Task 2: Assemble ConfigForm (resolver + Run gate + fit-check) + wire ConfigurePage** - `fe6bf20` (feat) — TDD: ConfigForm + ConfigForm.test.tsx + ConfigurePage
3. **Task 3: Playwright restore-after-reload E2E + lenient-guard fix** - `4d0e528` (test) — config-persist.spec.ts + restore-guard coercion fix
4. **Task 4: Human visual + auto-save feel verification** - verification-only (no files); human approved ("approved")

**Plan metadata:** docs commit (this SUMMARY + STATE.md + ROADMAP.md)

_Note: Tasks 1–2 are TDD (RED/GREEN folded into the single feat commit per task)._

## Files Created/Modified
- `src/features/config/ConfigForm.tsx` - useForm host + resolver + Run gate (fit-check → build → console.log) + page shell composition
- `src/features/config/ConfigForm.test.tsx` - Run-gate behaviors: invalid-required blocks/no-log, empty-catalog blocks, unfittable box inline error, valid Run logs PackRequest with no maxLoad/fragile keys
- `src/features/config/FooterBar.tsx` - sticky footer: live NaN-safe total, non-blocking >1000 advisory, Save draft, Run
- `src/features/config/FooterBar.test.tsx` - live total string, strict >1000 advisory threshold (present at 1001, absent at 1000), Saved ✓ confirmation
- `src/hooks/useLocalStorageAutosave.ts` - sole IO: restore-on-mount + debounced unconditional auto-save + flushSave + clean unmount
- `src/routes/ConfigurePage.tsx` - replaced placeholder body with `<ConfigForm />` (eager three-free `/` chunk)
- `e2e/config-persist.spec.ts` - partial-draft → reload → restored intact (DATA-02/SC-5) against the preview production build

## Decisions Made
- The lenient restore guard coerces string|number→number (structure-only) because RHF stores numeric inputs as strings — the original `z.number()` was rejecting otherwise-valid drafts on reload.
- Run logs the PackRequest JSON to the console this phase (D-06); no API client until Phase 5.
- Auto-save is unconditional (saves even invalid WIP, D-04) so a refresh never loses in-progress work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restore guard rejected string-valued numeric drafts**
- **Found during:** Task 3 (Playwright restore-after-reload E2E)
- **Issue:** RHF stores numeric inputs as strings, so the lenient `packConfigShapeSchema` `z.number()` failed shape validation on reload and discarded otherwise-valid drafts — the restore-after-reload assertion failed.
- **Fix:** Coerced string|number→number in the restore guard only (structure-only; does not loosen the strict submit schema).
- **Files modified:** src/lib/config-persist.ts (lenient guard)
- **Verification:** `npm run test:e2e -- config-persist` passes; full Vitest green.
- **Committed in:** `4d0e528` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Empty-catalog error had no render target**
- **Found during:** Task 2 (Assemble ConfigForm)
- **Issue:** The `boxTypes.min(1)` "Add at least one box type" validation produced an error with no on-screen render target, so the empty-catalog block was invisible to the user (D-02 message contract).
- **Fix:** Added an inline `role="alert"` message near the catalog card so the empty-catalog block surfaces clearly.
- **Files modified:** src/features/config/ConfigForm.tsx
- **Verification:** ConfigForm.test.tsx asserts the message appears and Run is blocked.
- **Committed in:** `fe6bf20` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Fit-check error not visible**
- **Found during:** Task 2 (Assemble ConfigForm)
- **Issue:** The fit-check `setError` on `boxTypes.${i}.length` had no visible target, so a box too big for the pallet blocked Run silently (D-01/BOX-06 message contract).
- **Fix:** Wired the fit error into the offending BoxRow's Dimensions NumberField so the inline fit message renders on the right row.
- **Files modified:** src/features/config/ConfigForm.tsx, src/features/config/BoxRow.tsx (error wiring)
- **Verification:** ConfigForm.test.tsx asserts the inline fit message appears and Run is blocked.
- **Committed in:** `fe6bf20` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing-critical)
**Impact on plan:** All three were correctness/visibility requirements (a draft-loss bug and two invisible-error gaps that would have silently broken the D-01/D-02 message contracts). No scope creep — no new features beyond the plan.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Automated Gate Results (all green at checkpoint)
- Full Vitest: **112 tests passed across 17 files** (re-confirmed at finalization).
- `npm run test:e2e -- config-persist`: **1 passed** (restore-after-reload against the preview production build).
- `npm run build && node scripts/check-code-split.mjs`: **PASSED** — the eager `/` chunk is three-free (C-05 phase gate).
- `npm run typecheck`: **clean** (the hook's form-subscription usage type-checks against installed RHF 7.77 types).

## Human Checkpoint (Task 4)
The `blocking` visual + auto-save-feel checkpoint was **approved by the human ("approved")**: the screen matches `design/config.html`/the UI-SPEC contract (light tokens, mono numerics, 3-mode rotation, no CoG-envelope field), and the auto-save/restore/Save-draft/Run/large-job-advisory behaviors all work as described.

## User Setup Required
None - no external service configuration required (no API this phase).

## Next Phase Readiness
- The Configure user story is closed end-to-end: a valid config builds a `PackRequest` (currently logged to console). Phase 5 wires this same gate to the real `POST /api/v1/pack` submit-then-poll client.
- The `onValid` console.log seam is the integration point for the Phase 5 API client (swap console.log → useMutation).
- No blockers introduced.

## Self-Check: PASSED
- Files verified present: ConfigForm.tsx, ConfigForm.test.tsx, FooterBar.tsx, FooterBar.test.tsx, useLocalStorageAutosave.ts, ConfigurePage.tsx, e2e/config-persist.spec.ts — all FOUND.
- Commits verified in history: `87c9b47`, `fe6bf20`, `4d0e528` — all FOUND.
- Full Vitest re-run at finalization: 112/112 passed.

---
*Phase: 04-config-form-local-persistence*
*Completed: 2026-06-04*
