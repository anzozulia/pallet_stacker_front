---
phase: 04-config-form-local-persistence
verified: 2026-06-04T22:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the Configure page at /. Fill in all pallet fields and add a few box types with labels, maxLoad, and fragile toggled. Click Run. Verify inline errors for invalid/empty fields block submission with clear messages."
    expected: "Error messages appear next to the relevant fields. Run button is disabled after the first failed submit attempt. Blank required fields show 'Required'. Zero dimension shows 'Must be > 0'. Empty catalog shows 'Add at least one box type'."
    why_human: "Form error display and timing (onSubmit/onChange modes) requires visual inspection in a real browser; jsdom tests cover logic but not CSS-rendered error visibility."
  - test: "Add a box larger than the pallet in all dimensions (e.g. 9000mm L). Click Run. Verify an inline error appears on that row's Dimensions field."
    expected: "The row shows a message such as 'cannot fit the pallet in any allowed orientation' inline on the Dimensions field. Run stays blocked."
    why_human: "The inline fit error placement and visual rendering requires a real browser."
  - test: "Add box types, edit the Running total footer, and verify the live N types / M units / est K kg string updates as you change quantity and weight values."
    expected: "Footer total string updates in real time without a submit attempt."
    why_human: "Live reactive update behavior requires a real browser interaction; unit tests cover pure tally math but not DOM update latency."
  - test: "Add enough box types to push the total unit count above 1000. Verify the large-job advisory appears in a non-blocking, non-danger style. Verify Run is NOT disabled by the advisory."
    expected: "Advisory text such as 'Large job — N units may take longer to solve and render.' appears in a neutral (non-red) style. Run button stays enabled."
    why_human: "Advisory visual style (non-danger color) requires visual inspection."
  - test: "Edit pallet and box values, click Save draft, close the tab, reopen the page at /. Verify the draft is restored intact."
    expected: "All edited pallet fields and box labels/values are restored to their saved state. No fields are blank or defaulted."
    why_human: "End-to-end localStorage persistence across a real browser close/reopen cycle has a different quality assurance bar than the Playwright reload test (which covers the core data path)."
  - test: "Toggle the Fragile switch on a box row. Verify the Max load on top field is disabled and zeroed. Toggle it off. Verify Max load is re-enabled and restores a non-zero value."
    expected: "Fragile ON disables and zeroes maxLoad. Fragile OFF re-enables maxLoad and restores a reasonable prior value."
    why_human: "Interactive fragile/maxLoad toggle behavior requires a real browser; the stash-and-restore session ref cannot be asserted in jsdom without complex setup."
---

# Phase 4: Config Form & Local Persistence — Verification Report

**Phase Goal:** A user can fully describe a pallet and a box catalog in a validated form, see a live running total, set how many pallets the solver may use, and have their work survive a page refresh via localStorage — with no API involved yet.
**Verified:** 2026-06-04T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can set pallet length, width, max stack height (mm), max weight (kg), max overhang (mm), and max pallets — no CoG-envelope field | VERIFIED | `PalletCard.tsx` renders NumberField for `pallet.length`, `pallet.width`, `pallet.height`, `pallet.maxWeight`, `pallet.maxOverhang`, and `maxPallets`; no CoG field exists anywhere in ConfigForm or PalletCard; comment on line 7 of PalletCard explicitly states `C-04 NO CoG-envelope field` |
| 2 | User can add, edit, and remove box types, each with L/W/H (mm), unit weight (kg), quantity, max-load-on-top, fragile flag, and 3-mode rotation (no 6-chip UI) | VERIFIED | `BoxCatalogCard.tsx` uses `useFieldArray` with append/remove; `BoxRow.tsx` registers all fields (`length`, `width`, `height`, `weight`, `quantity`, `maxLoad`, `fragile` via Switch, `rotation` via SegmentedControl with exactly 3 options: `free`/`uprightOnly`/`fixed`); label input present |
| 3 | Form shows live running total of box types and units and warns when unit count is large (>1000) | VERIFIED | `config-tally.ts` exports `tallyCatalog` with `LARGE_UNIT_THRESHOLD = 1000` (strictly `> 1000`); `FooterBar.tsx` calls `tallyCatalog(useWatch('boxTypes'))` and renders `{types} box types · {units} units · est. {estKg} kg` plus the advisory when `overThreshold`; `BoxCatalogCard.tsx` renders its own `{types} types · {units} units` badge |
| 4 | Invalid pallet/box inputs are flagged with clear messages and block submission (Run); unfittable boxes also block | VERIFIED | `packConfigSubmitSchema` rejects blank fields (`'Required'`), zero mm (`'Must be > 0'`), non-integer mm (`'Whole mm only'`), empty catalog (`'Add at least one box type'`); `ConfigForm.tsx` wires `checkAllBoxesFit` in `onValid` handler and calls `setError` per failing box; 112 unit tests pass including direct assertions on fit blocking (ConfigForm.test.tsx line 54-88) |
| 5 | Config and catalog survive a page refresh via localStorage (DATA-02) | VERIFIED | `config-persist.ts` + `useLocalStorageAutosave.ts` implement versioned serialize/deserialize with lenient shape guard; E2E spec `config-persist.spec.ts` PASSES (1/1 test): edits pallet.length + box label, Save draft, reload, asserts both values restored |

**Score: 5/5 truths verified**

---

### D-08 Contract Verification

**Truth: `maxLoad` and `fragile` are collected/persisted/displayed but NOT sent in the built PackRequest**

| Layer | Evidence | Status |
|-------|----------|--------|
| Collected | `BoxRow.tsx:167` `register('boxTypes.N.maxLoad')`, `BoxRow.tsx:78` `setValue('boxTypes.N.fragile', ...)` | VERIFIED |
| Persisted | `packConfigShapeSchema` includes `maxLoad: looseNumber` and `fragile: z.boolean()` (schema.ts:104-105); `serializeConfig` serializes the full PackConfig | VERIFIED |
| Displayed | `BoxRow.tsx:143-177` renders the maxLoad input with label "Max load on top" and a "Fragile" Switch toggle | VERIFIED |
| NOT sent | `BoxRequest` interface in `pack-contract.ts` has only `{id, length, width, height, weight, rotations}`; `request-builder.ts` builds boxes without referencing `maxLoad` or `fragile` (grep: 0 matches); `request-builder.test.ts:86-87` directly asserts `request.boxes[0]` does NOT have property `maxLoad` or `fragile`; fixture shape test (`request-builder.test.ts:178`) asserts box keys exactly match fixture `['id','length','width','height','weight','rotations']` | VERIFIED |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/config.ts` | Extended BoxType with label/maxLoad/fragile (D-08) | VERIFIED | All three fields present with doc-comments; `label: string`, `maxLoad: number`, `fragile: boolean` |
| `src/features/config/schema.ts` | `packConfigSubmitSchema` (strict) + `packConfigShapeSchema` (lenient) | VERIFIED | Both exported; strict schema uses `satisfies z.ZodType<PackConfig>`; lenient uses `looseNumber` for numeric fields |
| `src/features/config/defaults.ts` | `DEFAULT_CONFIG` + `makeDefaultBoxType()` | VERIFIED | EUR-shaped pallet 1200×800×1800, maxWeight 1000, maxOverhang 40, maxPallets 2; `makeDefaultBoxType()` returns `b${nanoid(8)}` id |
| `src/styles.css` | Light config-form `@theme` token group | VERIFIED | `--color-bg`, `--color-surface`, `--color-border`, `--topbar-height`, `--card-body-padding`, `--shadow` all present |
| `src/lib/box-fit.ts` | Conservative feasibility check for D-01/BOX-06 | VERIFIED | `orientationsFor` + `footprintFits` + `checkAllBoxesFit` all present and substantive |
| `src/lib/config-tally.ts` | Live tally with NaN-safety and LARGE_UNIT_THRESHOLD | VERIFIED | `tallyCatalog` with `LARGE_UNIT_THRESHOLD = 1000` |
| `src/lib/config-persist.ts` | Pure serialize/deserialize with lenient restore guard | VERIFIED | `serializeConfig` + `deserializeConfigOrDefault` with version envelope |
| `src/lib/request-builder.ts` | buildPackRequest with D-08 fields excluded | VERIFIED | No `maxLoad`/`fragile` in BoxRequest build path |
| `src/features/config/ConfigForm.tsx` | useForm host with resolver, Run gate, fit-check | VERIFIED | `useForm<PackConfig>`, `zodResolver(packConfigSubmitSchema)`, `checkAllBoxesFit`, `buildPackRequest`, composes PalletCard + BoxCatalogCard + FooterBar |
| `src/features/config/PalletCard.tsx` | Pallet fields + maxPallets, no CoG field | VERIFIED | 6 NumberField bindings; explicitly no CoG |
| `src/features/config/BoxCatalogCard.tsx` | useFieldArray list + live badge + add/remove | VERIFIED | Full field-array with append/remove, tally badge |
| `src/features/config/BoxRow.tsx` | All box fields + fragile/maxLoad interaction + 3-mode rotation | VERIFIED | All fields registered; fragile toggle stashes/restores maxLoad; SegmentedControl with 3 options |
| `src/features/config/FooterBar.tsx` | Live total + >1000 advisory + Save draft + Run | VERIFIED | All four features present; advisory is non-blocking, non-danger |
| `src/hooks/useLocalStorageAutosave.ts` | Restore-on-mount + debounced autosave (sole IO) | VERIFIED | `readPersistedConfig()` + `useLocalStorageAutosave()` with 400ms debounce |
| `src/routes/ConfigurePage.tsx` | Renders ConfigForm (not placeholder) | VERIFIED | Single line: `return <ConfigForm />` — placeholder replaced |
| `e2e/config-persist.spec.ts` | Reload-restore E2E spec | VERIFIED | 1 test; PASSES (E2E run confirmed) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ConfigForm.tsx` | `schema.ts` | `zodResolver(packConfigSubmitSchema)` | VERIFIED | Line 24 import + line 56 usage |
| `ConfigForm.tsx` | `box-fit.ts` | `checkAllBoxesFit(config)` in `onValid` | VERIFIED | Line 26 import + line 78 call |
| `ConfigForm.tsx` | `request-builder.ts` | `buildPackRequest(config)` on valid Run | VERIFIED | Line 27 import + line 86 call |
| `ConfigForm.tsx` | `useLocalStorageAutosave.ts` | `useLocalStorageAutosave(form)` | VERIFIED | Line 25 import + line 74 call |
| `useLocalStorageAutosave.ts` | `config-persist.ts` | `serializeConfig` / `deserializeConfigOrDefault` | VERIFIED | Line 24 import; both functions used |
| `BoxCatalogCard.tsx` | `config-tally.ts` | `tallyCatalog(watched)` for live badge | VERIFIED | Line 16 import + line 28 call |
| `FooterBar.tsx` | `config-tally.ts` | `tallyCatalog(boxTypes)` for footer total | VERIFIED | Line 19 import + line 37 call |
| `ConfigurePage.tsx` | `ConfigForm.tsx` | `<ConfigForm />` rendered | VERIFIED | Line 4 import + line 7 render |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FooterBar.tsx` | `boxTypes` | `useWatch({control, name: 'boxTypes'})` → `tallyCatalog` | Yes — live RHF watch subscription | FLOWING |
| `BoxCatalogCard.tsx` | `watched` | `useWatch({control, name: 'boxTypes'})` → `tallyCatalog` | Yes — live RHF watch subscription | FLOWING |
| `ConfigForm.tsx` | `defaultValues` | `useMemo(() => readPersistedConfig(), [])` → localStorage | Yes — real localStorage read on mount | FLOWING |
| `useLocalStorageAutosave.ts` | `values` | `form.subscribe({formState:{values:true}})` callback | Yes — live RHF subscription; writes unconditionally | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles without error | `npm run typecheck` | Exit 0, no output | PASS |
| All 112 unit tests pass | `npm run test` | 17 test files, 112 tests, all passed | PASS |
| Production build succeeds | `npm run build` | Exit 0, 4 chunks generated | PASS |
| three stays out of eager chunk | `node scripts/check-code-split.mjs` | "code-split check PASSED; three lives in lazy chunk ResultPage-*.js" | PASS |
| E2E config-persist spec | `npm run test:e2e -- config-persist` | 1/1 passed (278ms) — pallet length + box label restored after reload | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| PALLET-01 | 04-01, 04-04, 04-06 | User can set pallet length, width, max stack height (mm) | SATISFIED | PalletCard.tsx: `pallet.length`, `pallet.width`, `pallet.height` NumberFields |
| PALLET-02 | 04-01, 04-06 | User can set pallet max weight (kg) and max overhang (mm) | SATISFIED | PalletCard.tsx: `pallet.maxWeight`, `pallet.maxOverhang` NumberFields |
| BOX-01 | 04-05 | User can add, edit, and remove box types in a catalog | SATISFIED | BoxCatalogCard.tsx: `useFieldArray` append/remove; BoxRow.tsx: editable fields |
| BOX-02 | 04-01, 04-05 | User can set each box type's dimensions (L/W/H, mm), unit weight (kg), and quantity | SATISFIED | BoxRow.tsx: `length`, `width`, `height`, `weight`, `quantity` all registered |
| BOX-03 | 04-01, 04-05 | User can set max-load-on-top and mark fragile | SATISFIED | BoxRow.tsx: `maxLoad` input + `Switch` component for `fragile` with stash/restore |
| BOX-04 | 04-04, 04-05 | User can choose 3-mode rotation per box type | SATISFIED | BoxRow.tsx: SegmentedControl with `free`/`uprightOnly`/`fixed` options |
| BOX-05 | 04-02, 04-05, 04-07 | App shows live running total and warns when units > 1000 | SATISFIED | FooterBar.tsx + BoxCatalogCard.tsx: `tallyCatalog` with `LARGE_UNIT_THRESHOLD=1000` |
| BOX-06 | 04-02, 04-07 | App validates inputs and blocks submission with clear messages | SATISFIED | `packConfigSubmitSchema` strict validation + `checkAllBoxesFit` in `onValid`; ConfigForm.test.tsx assertions at lines 25-88 |
| PACK-03 | 04-01, 04-06, 04-07 | User can set max pallets | SATISFIED | PalletCard.tsx: `maxPallets` NumberField; schema.ts: `maxPallets: mmInt`; request-builder passes `max_pallets` in options |
| DATA-02 | 04-01, 04-03, 04-07 | User can save config locally and reload after page refresh | SATISFIED | `config-persist.ts` + `useLocalStorageAutosave.ts` + E2E test PASSES |

All 10 requirement IDs from the phase (PALLET-01, PALLET-02, BOX-01, BOX-02, BOX-03, BOX-04, BOX-05, BOX-06, PACK-03, DATA-02) are accounted for and satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/config/schema.ts` | 44 | `looseNumber` coerces `''` to `NaN` then `JSON.stringify(NaN)` → `null` → `Number(null)` → `0` across two reload cycles | Warning (WR-01 from review) | Blank required fields silently become `0` after two reloads; "Required" message becomes "Must be > 0"; user intent (blank = unfilled) is destroyed. Does NOT block the phase goal (persistence works for valid values, E2E passes) but weakens the refresh-safety guarantee for partially-filled drafts |
| `src/features/config/BoxRow.tsx` | 65-79 | Fragile↔maxLoad invariant enforced only interactively, not on restore | Warning (WR-02 from review) | A persisted `{fragile: true, maxLoad: 90}` box passes strict schema (`maxLoad` only requires `min(0)`). Currently harmless (D-08: both fields are unsent in v1) but would leak if maxLoad/fragile become sent fields |
| `src/features/config/schema.ts` | 56-59 | `maxLoad` empty string silently coerces to `0` — no empty-string guard | Warning (WR-03 from review) | Inconsistent with `mmInt`/`kg` behavior; blank maxLoad silently becomes `0` (fragile semantics) rather than "Required" |
| `src/features/config/ConfigForm.tsx` | 56-58, 77-88 | Manual `fit` errors cleared by `reValidateMode:'onChange'` on next keystroke | Warning (WR-04 from review) | Re-enables Run button mid-edit after a fit failure, even if box still doesn't fit. Authoritative gate still runs in `onValid` on next Run click |
| `src/hooks/useLocalStorageAutosave.ts` | 101-105 | Cleanup clears pending timer without flushing | Warning (WR-07 from review) | Last <400ms of edits lost on unmount (route change without explicit Save draft click) |

None of the above are `TBD`/`FIXME`/`XXX` debt markers. All 5 are advisory warnings documented in the committed 04-REVIEW.md with fixes proposed. They do not constitute blockers under the phase goal — the E2E test passes, all 5 success criteria are met, and the review explicitly found "0 critical" findings.

---

### Human Verification Required

#### 1. Pallet and Box Field Error Display

**Test:** Open `/`, clear the pallet Length field, add a box type, clear its length, click Run.
**Expected:** Inline error messages appear next to the empty fields. After the first failed submit, Run becomes disabled. Error messages say "Required" (blank) or "Must be > 0" (zero).
**Why human:** Form error layout and color rendering requires a real browser; CSS and error-region placement cannot be verified programmatically.

#### 2. Unfittable Box Inline Error

**Test:** Set pallet length to 500mm. Add a box with length 9000mm (fragile: off, rotation: fixed). Click Run.
**Expected:** An inline error on the Dimensions field of that box row: text containing "cannot fit the pallet in any allowed orientation". Run stays blocked.
**Why human:** Inline fit error visual placement in the DOM requires a real browser.

#### 3. Live Running Total Reactivity

**Test:** On the Configure page, add two box types, change quantity values, and observe the footer total.
**Expected:** The footer string ("N box types · M units · est K kg") updates in real time with each keystroke. The badge in the card header also updates.
**Why human:** Visual real-time reactivity requires user interaction and browser observation.

#### 4. Large Job Advisory Appearance and Non-Blocking Behavior

**Test:** Set a single box type's quantity to 1001. Observe the footer.
**Expected:** A neutral-styled advisory appears (e.g. "Large job — 1001 units may take longer to solve and render."). The Run button is NOT disabled by the advisory. The advisory text is NOT red (uses text-2 tone, not danger).
**Why human:** Specific visual style (non-danger color) cannot be verified by grep.

#### 5. localStorage Persistence Across Real Browser Tab Close

**Test:** Edit the form, click Save draft, close the browser tab fully, open a new tab at `/`.
**Expected:** All edited values (pallet fields, box labels, quantities) are restored. No fields blank or reset to defaults.
**Why human:** The E2E Playwright test covers reload but not tab close. Real browser persistence fidelity deserves human verification for the headline DATA-02 feature.

#### 6. Fragile Toggle Interactive Behavior

**Test:** On a box row, toggle the Fragile switch ON, then OFF.
**Expected:** When ON: Max load on top input is disabled and shows 0. When OFF: Max load on top is re-enabled and shows a prior non-zero value (e.g. the default 90 kg on a fresh row).
**Why human:** The per-session ref stash/restore behavior requires interactive testing in a real browser; the prevMaxLoad ref state is not observable in jsdom.

---

### Gaps Summary

No BLOCKER gaps. All 5 success criteria are verified in the codebase. The 5 advisory warnings (WR-01 through WR-05 in 04-REVIEW.md) are robustness improvements documented with fixes — they do not block the stated phase goal.

The human verification items above are UI/UX fidelity checks that cannot be fully asserted programmatically and are required before the status can move from `human_needed` to `passed`.

---

_Verified: 2026-06-04T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
