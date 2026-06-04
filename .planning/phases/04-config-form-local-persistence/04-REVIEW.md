---
phase: 04-config-form-local-persistence
reviewed: 2026-06-04T22:05:00Z
depth: deep
files_reviewed: 32
files_reviewed_list:
  - src/types/config.ts
  - src/styles.css
  - src/features/config/schema.ts
  - src/features/config/schema.test.ts
  - src/features/config/defaults.ts
  - src/lib/box-fit.ts
  - src/lib/box-fit.test.ts
  - src/lib/config-tally.ts
  - src/lib/config-tally.test.ts
  - src/lib/config-persist.ts
  - src/lib/config-persist.test.ts
  - src/lib/request-builder.test.ts
  - src/components/NumberField.tsx
  - src/components/Switch.tsx
  - src/components/Switch.test.tsx
  - src/components/SegmentedControl.tsx
  - src/components/SegmentedControl.test.tsx
  - src/components/Card.tsx
  - src/components/SectionLabel.tsx
  - src/features/config/BoxRow.tsx
  - src/features/config/BoxRow.test.tsx
  - src/features/config/BoxCatalogCard.tsx
  - src/features/config/BoxCatalogCard.test.tsx
  - src/features/config/PalletCard.tsx
  - src/features/config/PalletCard.test.tsx
  - src/features/config/FooterBar.tsx
  - src/features/config/FooterBar.test.tsx
  - src/features/config/ConfigForm.tsx
  - src/features/config/ConfigForm.test.tsx
  - src/hooks/useLocalStorageAutosave.ts
  - src/routes/ConfigurePage.tsx
  - e2e/config-persist.spec.ts
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-04T22:05:00Z
**Depth:** deep
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 4 implements the Configure screen: a single `useForm<PackConfig>` instance, versioned localStorage persistence with a never-throw restore guard, hand-built accessible primitives (Switch, SegmentedControl, NumberField), the strict/lenient zod schema split, the conservative box-fit feasibility check, the NaN-safe tally, and the Run gate.

The architecture is sound and the test suite is genuinely strong (112 tests pass; the persistence guard, schema boundary, box-fit math, and the D-08 unsent-fields contract are all directly asserted). The code-split discipline (no `three`/React/IO in the pure libs) holds.

No blockers were found — there are no security vulnerabilities, no crash paths (the restore guard is correctly fail-closed), and the D-08 contract that `maxLoad`/`fragile` never reach the API request is enforced by the request-builder shape and pinned by a test. However, there are several correctness/robustness defects, the most important being a **silent data-drift bug where a blank required numeric field decays to a literal `0` across two reload cycles** (WR-01), and a **fragile/maxLoad restore gap that can submit a non-zero `maxLoad` on a box the user marked fragile** (WR-02). Neither corrupts the API request in v1 (those fields are unsent), so they are warnings, not blockers — but WR-01 in particular undermines the headline refresh-safety feature.

## Warnings

### WR-01: Blank required numeric field silently decays to `0` across reload cycles

**File:** `src/features/config/schema.ts:44` (`looseNumber`), `src/hooks/useLocalStorageAutosave.ts:94-97` (autosave write)
**Issue:**
The restore path can silently convert a blank/required field into a valid-looking `0`, defeating the "Required" gate and the refresh-safety guarantee. The chain:

1. A blank numeric `<input>` is `""` on the form (RHF leaves it a string).
2. `looseNumber` (`Number("")`) coerces `""` → `NaN`, so the *restored* `defaultValues` seed a field as the JS number `NaN`.
3. On the next autosave, the subscribe callback persists the whole `values` object (`useLocalStorageAutosave.ts:96` `writeConfig(values)`), including the untouched `NaN` number.
4. `serializeConfig` → `JSON.stringify(NaN)` emits `null` (verified: `JSON.stringify({a:NaN})` === `'{"a":null}'`).
5. On the *next* reload, `looseNumber` runs `Number(null)` → `0` (verified). The field is now a hard `0`.

Net effect: a field the user left blank (which should re-surface as "Required" on Run) silently becomes `0` after two reload cycles. For `mmInt` fields the strict schema then reports "Must be > 0" instead of "Required", and the user's intent (an empty, not-yet-filled field) is destroyed. This is a regression of DATA-02 / SC-5 for the blank-field case the lenient guard was explicitly built to preserve.

**Fix:** Make `looseNumber` preserve empty/blank as a non-numeric sentinel rather than collapsing it. One option — keep blank strings as-is and only coerce genuinely numeric strings:
```ts
const looseNumber = z.union([z.number(), z.string()]).transform((v) => {
  if (v === '' || v == null) return ''; // preserve "blank" so it round-trips as blank, not 0
  const n = Number(v);
  return Number.isNaN(n) ? v : n;       // keep non-numeric text rather than NaN→null→0
});
```
(then widen the field types to `number | string` to match what RHF already tolerates), OR serialize/restore the raw string form values verbatim instead of coercing in the guard. Add a test: blank a field, Save draft, reload, Save draft, reload again, and assert the field is still blank (not `0`).

### WR-02: Fragile restore gap — a fragile box can carry a non-zero `maxLoad` after reload

**File:** `src/features/config/BoxRow.tsx:65-79`
**Issue:**
The fragile↔maxLoad invariant (D-08: "`maxLoad` is `0` when fragile") is enforced only *interactively* via `onFragileChange`. It is **not** enforced on restore. If a persisted draft has `{ fragile: true, maxLoad: 90 }` (reachable by hand-editing the blob, by a future migration, or by any code path that sets `fragile` without going through `onFragileChange`), the row mounts with `fragile=true` (input disabled) but `maxLoad=90` still on the form. The strict submit schema does not re-couple them (`maxLoad` only checks `min(0)` and `fragile` is an independent boolean), so a fragile box with `maxLoad: 90` passes Run. It does not corrupt the v1 API request (both fields are unsent), but it violates the stated data invariant and would leak the moment maxLoad/fragile become sent fields.

**Fix:** Enforce the invariant at the data boundary, not just the toggle handler. Either (a) in the strict schema, add a cross-field refinement (`fragile === true ⇒ maxLoad === 0`), or (b) normalize on restore in `deserializeConfigOrDefault` / when seeding (force `maxLoad = 0` for any `fragile` box). Prefer (a) so the rule lives in the single source of truth:
```ts
const boxTypeSubmit = z.object({ /* ... */ })
  .refine((b) => !b.fragile || b.maxLoad === 0, {
    path: ['maxLoad'], message: 'Fragile boxes carry no load',
  });
```

### WR-03: `maxLoad` empty string silently coerces to `0` and passes strict validation

**File:** `src/features/config/schema.ts:56-59`
**Issue:**
`maxLoad` is `z.union([z.string(), z.number()]).transform((v) => Number(v)).pipe(z.number().min(0))` — note it does NOT have the `.refine(v !== '' …)` empty-string guard that `mmInt`/`kg` carry. So a blank `maxLoad` input (`""`) coerces to `0` and passes. Unlike `weight`/`length`, a user who clears Max-load gets a silent `0` (i.e. "fragile" semantics) rather than a "Required" error. This is the exact `""→0` footgun the schema comment (lines 8-10) says must never happen for required fields. It is arguably intentional for `maxLoad` (0 is valid), but the silent blank→0 is inconsistent with sibling fields and surprising for a non-fragile box where the user simply cleared the field.

**Fix:** Decide explicitly. If blank max-load should mean "no top-load limit specified", reject it like the others; if blank should mean `0`, document it. To reject:
```ts
maxLoad: z
  .union([z.string(), z.number()])
  .refine((v) => v !== '' && v !== null && v !== undefined, { message: 'Required' })
  .transform((v) => Number(v))
  .pipe(z.number().min(0)),
```

### WR-04: Manual fit errors are cleared by `reValidateMode: 'onChange'`, so the Run gate can be bypassed on the next keystroke

**File:** `src/features/config/ConfigForm.tsx:56-58, 77-88`
**Issue:**
On a valid parse but a failed `checkAllBoxesFit`, `onValid` calls `setError('boxTypes.N.length', { type: 'fit', … })` and returns without building. But `reValidateMode: 'onChange'` re-runs the zod resolver on the next field change, and the resolver has no knowledge of the fit failure — so it clears the manual `fit` error and `isValid` returns to `true`. `runDisabled = isSubmitted && !isValid` then becomes `false`, re-enabling Run. A user can edit any unrelated field and the inline "cannot fit" message disappears even though the box still does not fit. The gate is re-checked on the next Run attempt (fit runs again in `onValid`), so it is not a true bypass of submission — but the disabled state and the inline error are misleading mid-edit. The deeper issue: feasibility is enforced *only* inside `onValid`, never reflected in `isValid`, so `runDisabled` does not represent "can actually run".

**Fix:** Track fit-feasibility as derived state (e.g. a `useWatch` + `checkAllBoxesFit` memo) and fold it into the disabled computation, OR re-run the fit check and re-`setError` on relevant changes. At minimum, document that the inline fit error is transient and the authoritative gate is the re-check inside `onValid`.

### WR-05: Box-fit overhang is applied independently to both axes, over-permitting diagonal overhang

**File:** `src/lib/box-fit.ts:48-52`
**Issue:**
`footprintFits` allows `a <= pL + overhang && b <= pW + overhang` — i.e. it grants the full `maxOverhang` on *both* footprint axes simultaneously. A box of `(pL+overhang) × (pW+overhang)` is accepted, which physically overhangs on all four edges at once (total overhang on each axis is `overhang`, but the test fixture at `box-fit.test.ts:62-68` treats `maxOverhang` as a per-side allowance of `+40/+20`, implying the intended semantics is "+overhang split across the pair of opposite edges", i.e. `+overhang` total per axis, not `+overhang` per side). The module is documented as deliberately conservative ("when in doubt, ALLOW"), and the solver stays authoritative, so this is a tolerated over-permit rather than a correctness break — but the in-test comment math ("each side +40/+20") does not match the code's actual semantics (which is `+overhang` per axis, i.e. `+50` total, not per-side). Worth reconciling so the conservative bound is intentional and not an accident.

**Fix:** Confirm the intended overhang semantics with the API contract. If `maxOverhang` is "max overhang per side", the bound should be `a <= pL + 2*overhang`; if it is "max overhang per axis (total)", the current code is right but the test comment is wrong. Align code + test comment either way.

### WR-06: `aria-describedby`/`id` collisions across box rows in `NumberField`

**File:** `src/components/NumberField.tsx:34-36`, used from `src/features/config/BoxRow.tsx:126,129-139`
**Issue:**
`NumberField` derives `inputId = id ?? inputProps.name`. In `BoxRow`, the registered name is e.g. `boxTypes.0.length`, so the input `id`, label `htmlFor`, `${id}-hint`, and `${id}-error` are all keyed on the field path. These are unique *per row* (the index differs), so there is no cross-row collision today. However, the "Width"/"Height"/"Weight"/"Quantity" fields in BoxRow are rendered via `NumberField` with names like `boxTypes.0.width` — unique. The real concern: `id`s containing dots (`boxTypes.0.length-error`) are valid HTML id attributes but are fragile selectors. More importantly, the bare `<input>` for max-load in BoxRow (lines 166-173) sets `id={`boxTypes.${index}.maxLoad`}` and a `<label htmlFor>` matching it — but provides NO `aria-describedby`/error wiring and is hand-rolled instead of reusing `NumberField`, so it diverges from the accessible pattern every other field follows (no `aria-invalid`, no error region).

**Fix:** Route the max-load field through `NumberField` (or a disabled-capable variant) so it inherits the label/error/`aria-describedby` wiring, eliminating the hand-rolled divergence. Confirm dotted ids are acceptable for your selector strategy (the e2e uses `name=` selectors, so ids are not relied on — acceptable, but worth a note).

### WR-07: Autosave never persists on unmount-without-flush; last <400ms of edits can be lost

**File:** `src/hooks/useLocalStorageAutosave.ts:101-105`
**Issue:**
The cleanup function calls `clearPending()` then `unsubscribe()` — it does **not** flush a pending write. If the user edits a field and navigates away (route change to `/result`, or tab close) within the 400ms debounce window, the pending timer is cleared and the most recent change is lost. The Save-draft button mitigates this only when explicitly clicked. For an autosave feature whose selling point is "nothing to lose on reload", silently dropping the final keystrokes on unmount is a robustness gap.

**Fix:** On cleanup, flush instead of discard when a timer is pending:
```ts
return () => {
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current);
    writeConfig(form.getValues()); // flush the pending edit
    timerRef.current = null;
  }
  unsubscribe();
};
```
(Be careful with the dependency array / closure over `form`.) Note this is an enhancement for an inherently best-effort feature; classify down if the team accepts "Save draft is the durable path."

## Info

### IN-01: `STORAGE_KEY` already embeds `v1` while `STORAGE_VERSION` is a separate field — dual versioning

**File:** `src/lib/config-persist.ts:26,33`
**Issue:** The key is `'palletize:config:v1'` AND the envelope carries `version: 1`. Two independent version markers can drift (e.g. bump `STORAGE_VERSION` to 2 but leave the key `:v1`). Pick one scheme or document that the key suffix is frozen and only the envelope `version` moves.
**Fix:** Drop `:v1` from the key (use `palletize:config`) and rely solely on the envelope `version`, or comment that the key suffix is intentionally immutable.

### IN-02: `Resolver<PackConfig>` cast hides the input/output type mismatch

**File:** `src/features/config/ConfigForm.tsx:56`
**Issue:** `zodResolver(packConfigSubmitSchema) as Resolver<PackConfig>` is a documented narrowing, but the cast suppresses any future drift between the schema's transform output and `PackConfig`. The `satisfies z.ZodType<PackConfig>` in schema.ts covers the output side, so the risk is low; flagging the cast for visibility.
**Fix:** None required; the comment is adequate. Consider a typed helper that asserts `z.output<typeof schema>` extends `PackConfig` at the cast site.

### IN-03: Two identical "Run packing" buttons share one handler with no distinguishing accessible context

**File:** `src/features/config/ConfigForm.tsx:129-137` (topbar) and `src/features/config/FooterBar.tsx:75-91` (footer)
**Issue:** Two buttons with the identical accessible name "Run packing" exist on the page. Screen-reader users hear "Run packing button" twice with no positional cue. The tests work around this by taking the last match. Not a defect, but a minor a11y/clarity smell.
**Fix:** Optionally differentiate (e.g. the topbar one could be `aria-label="Run packing (top)"`), or accept the duplication as intentional (sticky header + footer CTA).

### IN-04: `RunIcon` SVG duplicated verbatim in ConfigForm and FooterBar

**File:** `src/features/config/ConfigForm.tsx:30-42` and `src/features/config/FooterBar.tsx:82-90`
**Issue:** The same arrow SVG markup is duplicated. Minor maintainability smell.
**Fix:** Extract a shared `<RunIcon />` (or icon module) and import it in both.

### IN-05: `swatchColor` recomputes `colorForType(allIds)` on every BoxRow render

**File:** `src/features/config/BoxRow.tsx:61`
**Issue:** Each row calls `colorForType(allIds)` (which sorts + dedupes + builds a Map) just to read one entry, on every render. Out of v1 perf scope, but a `useMemo` keyed on `allIds` (computed once in the parent and passed down as the resolved colour) would be cleaner and avoids N map-builds for N rows.
**Fix:** Compute the colour Map once in `BoxCatalogCard` and pass each row its resolved colour string.

### IN-06: `prevMaxLoad` ref defaults via `makeDefaultBoxType()` which allocates a nanoid on every fragile toggle/mount

**File:** `src/features/config/BoxRow.tsx:65,70`
**Issue:** `useRef<number>(makeDefaultBoxType().maxLoad)` and the fallback at line 70 both call `makeDefaultBoxType()` solely to read `.maxLoad` (90), needlessly generating a nanoid id each time. Minor waste and an odd coupling (the fragile-restore fallback depends on the box-factory default).
**Fix:** Use a named constant, e.g. `const DEFAULT_MAX_LOAD = 90;` (or export it from defaults.ts) and reference it directly.

---

_Reviewed: 2026-06-04T22:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
