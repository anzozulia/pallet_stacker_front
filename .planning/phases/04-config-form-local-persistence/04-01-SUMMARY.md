---
phase: 04-config-form-local-persistence
plan: 01
subsystem: config
tags: [react-hook-form, zod, hookform-resolvers, nanoid, tailwind, validation, schema, defaults]

# Dependency graph
requires:
  - phase: 02-api-contract-request-builder
    provides: PackConfig / BoxType / PalletConfig in-memory model, buildPackRequest (reads id/dims/weight/quantity/rotation only)
  - phase: 03-pure-transform-core
    provides: palette colorForType (reads id only), pure-lib house style
provides:
  - "react-hook-form@7.77.0, zod@4.4.3, @hookform/resolvers@5.4.0 installed at exact locked versions (npm ci clean, 0 vulns)"
  - "BoxType extended with label/maxLoad/fragile (D-08) — additive, existing pure layer unchanged"
  - "packConfigSubmitSchema (strict, D-02 resolver) + packConfigShapeSchema (lenient restore guard, Pitfall 4) in src/features/config/schema.ts"
  - "DEFAULT_CONFIG (EUR-shaped, D-09) + makeDefaultBoxType (letter-prefixed nanoid id, C-06) in src/features/config/defaults.ts"
  - "Light config-form @theme token group (colours/radii/component-constants/shadows) in src/styles.css"
affects: [config-form-primitives, config-cards, config-integration, localstorage-persistence]

# Tech tracking
tech-stack:
  added: [react-hook-form@7.77.0, zod@4.4.3, "@hookform/resolvers@5.4.0"]
  patterns:
    - "Two-schema split: strict submit resolver + lenient structure-only restore guard (Pitfall 4)"
    - "Empty-string rejection before coercion: union([string,number]).refine(!=='').transform(Number).pipe(z.number()...) (Pattern 1 / Pitfall 2)"
    - "satisfies z.ZodType<PackConfig> compile-time schema/type alignment guard"
    - "Letter-prefixed nanoid ids (`b${nanoid(8)}`) to keep typeKeyOf parse-fallback correct (C-06)"

key-files:
  created:
    - src/features/config/schema.ts
    - src/features/config/defaults.ts
    - src/features/config/schema.test.ts
  modified:
    - src/types/config.ts
    - src/styles.css
    - src/lib/request-builder.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Supply-chain gate (T-4-SC): rhf/zod/@hookform/resolvers human-approved at Task 1 before any import; pinned exact, npm ci clean."
  - "Used .transform(Number).pipe(z.number()...) instead of .pipe(z.coerce.number()...) — zod v4 refines widen the piped input to unknown, breaking the satisfies guard; transform keeps the target typed."

patterns-established:
  - "Pattern 1: numeric fields reject ''/null/undefined before coercion so a blank required field never passes as 0"
  - "Two-schema split: strict submit (business rules) vs lenient shape (structure/types only) for the restore path"
  - "Config @theme token group ported verbatim from the mockup :root with a provenance comment"

requirements-completed: [PALLET-01, PALLET-02, BOX-02, BOX-03, BOX-04, PACK-03, DATA-02]

# Metrics
duration: ~12min
completed: 2026-06-04
---

# Phase 4 Plan 01: Contract-and-Foundation Seam Summary

**Installed rhf/zod/@hookform/resolvers (human-approved supply-chain gate), extended BoxType with label/maxLoad/fragile, authored the strict-submit + lenient-shape zod schemas and EUR-shaped seed defaults, and ported the light config-form design tokens into the Tailwind @theme block.**

## Performance

- **Duration:** ~12 min (continuation; Task 1 completed in a prior session)
- **Completed:** 2026-06-04
- **Tasks:** 3 (Task 1 verified pre-existing; Tasks 2-3 executed this session)
- **Files modified:** 8

## Accomplishments
- Three form/validation packages installed at exact locked versions (`npm ci` clean, no peer conflicts) — supply-chain checkpoint human-approved (T-4-SC).
- `BoxType` carries `label`/`maxLoad`/`fragile` (D-08); the existing pure layer (request-builder, palette) compiles unchanged — verified additive.
- `packConfigSubmitSchema` (strict, D-02) + `packConfigShapeSchema` (lenient restore guard) authored, with `mmInt`/`kg` field builders that reject empty strings before coercion.
- `DEFAULT_CONFIG` (EUR 1200×800 pallet) + `makeDefaultBoxType()` (letter-prefixed unique id) authored and type-annotated against `PackConfig`.
- Light config-form token group (11 colours, 3 radii, 2 component constants, 2 shadows) ported into `@theme`; dark `--color-d-*` group untouched; build + code-split gate green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install rhf/zod/@hookform/resolvers (supply-chain gate)** - `dd238d6` (chore) — completed prior session, human-approved
2. **Task 2: Extend BoxType + author schemas + defaults** - `5b9cb3a` (test, RED) → `f707dc4` (feat, GREEN) — TDD
3. **Task 3: Port light config-form @theme tokens** - `dc948f8` (feat)

_Note: Task 2 is TDD — failing test committed first (RED), then implementation (GREEN); no refactor commit needed._

## Files Created/Modified
- `src/features/config/schema.ts` - The two zod schemas (strict submit + lenient shape) and shared `mmInt`/`kg`/`rotation` builders; zod's first use in-repo (C-01).
- `src/features/config/defaults.ts` - `DEFAULT_CONFIG` (EUR-shaped) + `makeDefaultBoxType()`.
- `src/features/config/schema.test.ts` - Behaviour contract for both schemas + defaults (13 tests).
- `src/types/config.ts` - `BoxType` extended with `label`/`maxLoad`/`fragile`; module header updated (zod now arrives in schema.ts).
- `src/styles.css` - Light config-form `@theme` token group.
- `src/lib/request-builder.test.ts` - Existing fixtures extended with the three new additive fields (Rule 3, blocking typecheck).
- `package.json` / `package-lock.json` - Three pinned deps (Task 1).

## Decisions Made
- **Supply-chain gate (T-4-SC):** the three deps were human-approved before any downstream import, pinned exact, `npm ci` clean.
- **zod v4 coercion idiom:** used `.union([string,number]).refine(!=='').transform(Number).pipe(z.number()...)` rather than `.pipe(z.coerce.number()...)`. In zod v4 the `.refine()` widens the piped input type to `unknown`, which broke `satisfies z.ZodType<PackConfig>`. The explicit `.transform(Number)` keeps the pipe target typed (`number`) while preserving the runtime empty-string-rejection behaviour (verified: `''`/`0`/`1.5` all reject for mm; `'7'`/`5` accept).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended request-builder.test.ts fixtures for the additive BoxType fields**
- **Found during:** Task 2 (extending BoxType)
- **Issue:** Adding `label`/`maxLoad`/`fragile` to `BoxType` made the three inline box fixtures in `src/lib/request-builder.test.ts` fail `tsc -b` (missing properties), blocking the Task 2 typecheck gate.
- **Fix:** Added `label`/`maxLoad`/`fragile` to each of the three fixtures (the `Fc` fixture set `fragile: true`/`maxLoad: 0` to mirror a fragile box). No behaviour change — `buildPackRequest` ignores the new fields.
- **Files modified:** src/lib/request-builder.test.ts
- **Verification:** `npm run typecheck` passes; full suite 49/49 green.
- **Committed in:** f707dc4 (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Reworked schema numeric builders to satisfy zod v4 pipe typing**
- **Found during:** Task 2 (authoring schema.ts)
- **Issue:** The RESEARCH example's `.refine(...).pipe(z.coerce.number()...)` type-checked at runtime but failed `tsc -b` under zod v4 (the refined input is `unknown`; `.pipe` expects `string|number`), breaking the `satisfies z.ZodType<PackConfig>` guard the task requires.
- **Fix:** Inserted `.transform((v) => Number(v))` before `.pipe(z.number()...)` for `mmInt`/`kg`/`maxLoad`, keeping the documented empty-string-rejection semantics while restoring clean typing.
- **Files modified:** src/features/config/schema.ts
- **Verification:** `npm run typecheck` passes (proves the `satisfies` guard holds); behaviour tests confirm `''`/`0`/`1.5` reject and decimals pass for kg.
- **Committed in:** f707dc4 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both were necessary to pass the planned typecheck gate; no scope creep. The schema's runtime behaviour matches the RESEARCH/plan `<behavior>` contract exactly — only the typing idiom was adjusted for zod v4.

## Issues Encountered
- Husky pre-commit lint rejected an unused destructure variable (`_pallet`) in the test's "missing pallet" case; rewrote the case to build the object from the kept keys. Resolved before the RED commit landed.

## Known Stubs
None — this plan delivers only types, schemas, tokens, and deps; no UI/data wiring yet (no user-visible capability ships until Wave 3+).

## Threat Flags
None — this plan adds only deps, compile-time types, schemas, and CSS tokens. No runtime input crosses a trust boundary yet (consistent with the plan's threat model: T-4-SC mitigated via the human gate, T-4-01 accepted as compile-time only).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The contract seam is in place: downstream Phase-4 plans can import the extended `BoxType`, both schemas, `DEFAULT_CONFIG`/`makeDefaultBoxType`, and the light tokens.
- `zodResolver(packConfigSubmitSchema)` is ready to wire into RHF; `packConfigShapeSchema` is ready for the localStorage restore path.
- No blockers.

---
*Phase: 04-config-form-local-persistence*
*Completed: 2026-06-04*

## Self-Check: PASSED

- Files: schema.ts, defaults.ts, schema.test.ts, 04-01-SUMMARY.md all present.
- Commits: dd238d6, 5b9cb3a, f707dc4, dc948f8 all in history.
