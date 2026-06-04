# Phase 4: Config Form & Local Persistence - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 22 new/modified
**Analogs found:** 21 / 22 (1 component class — `useFieldArray`/RHF — has no in-repo analog; use RESEARCH patterns)

This phase is overwhelmingly NEW UI territory (RHF + zod + Tailwind), but the three pure
libs and ALL the tests have strong in-repo analogs from Phases 2–3. The codebase has a
single, consistent house style for pure `src/lib/*.ts` modules and their co-located tests —
copy it verbatim. There are NO existing React form/component analogs beyond the trivial
`Hello.tsx` smoke; the form components must follow RESEARCH.md patterns, but their file
header/import/test conventions still copy the established house style documented here.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/box-fit.ts` | utility (pure) | transform | `src/lib/request-builder.ts` | exact (pure lib) |
| `src/lib/box-fit.test.ts` | test | transform | `src/lib/request-builder.test.ts` | exact |
| `src/lib/config-tally.ts` | utility (pure) | transform | `src/lib/request-builder.ts` / `palette.ts` | exact (pure lib) |
| `src/lib/config-tally.test.ts` | test | transform | `src/lib/palette.test.ts` | exact |
| `src/lib/config-persist.ts` | utility (pure) | transform (serialize) | `src/lib/request-builder.ts` | exact (pure lib) |
| `src/lib/config-persist.test.ts` | test | transform | `src/lib/request-builder.test.ts` | exact |
| `src/hooks/useLocalStorageAutosave.ts` | hook | file-I/O (localStorage) | `src/lib/mapping.ts` (header/discipline only) | partial (no hook analog) |
| `src/features/config/schema.ts` | config (zod) | validation | `src/types/config.ts` (type-mirror) | role-match |
| `src/features/config/defaults.ts` | config | — | `src/lib/request-builder.ts` (`BAKED_OPTIONS` const) | role-match |
| `src/features/config/ConfigForm.tsx` | component (form) | request-response | `src/components/Hello.tsx` (shell only) | weak — use RESEARCH |
| `src/features/config/PalletCard.tsx` | component | request-response | `src/components/Hello.tsx` (shell only) | weak — use RESEARCH |
| `src/features/config/BoxCatalogCard.tsx` | component | event-driven (CRUD list) | none | none — use RESEARCH Pattern 2 |
| `src/features/config/BoxRow.tsx` | component | request-response | none | none — use RESEARCH Pattern 3/4 |
| `src/features/config/FooterBar.tsx` | component | event-driven | none | none — use RESEARCH Pattern 5 |
| `src/components/NumberField.tsx` | component (primitive) | request-response | `src/components/Hello.tsx` (shell only) | weak |
| `src/components/Switch.tsx` | component (primitive) | request-response | `src/components/Hello.tsx` (shell only) | weak |
| `src/components/SegmentedControl.tsx` | component (primitive) | request-response | `src/components/Hello.tsx` (shell only) | weak |
| `src/components/Card.tsx` / `SectionLabel.tsx` | component (primitive) | — | `src/components/Hello.tsx` (shell only) | weak |
| `src/features/config/*.test.tsx` | test | request-response | `src/components/Hello.test.tsx` | exact (test wiring) |
| `src/types/config.ts` | model | — | itself (extend in place) | exact (modify) |
| `src/routes/ConfigurePage.tsx` | route | — | itself (replace body) | exact (modify) |
| `src/styles.css` | config (tokens) | — | itself (existing `@theme`) | exact (modify) |

---

## Pattern Assignments

### `src/lib/box-fit.ts`, `config-tally.ts`, `config-persist.ts` (pure utility, transform)

**Analog:** `src/lib/request-builder.ts` (also `palette.ts`, `mapping.ts` — all share one house style)

**House-style header block** — every pure lib opens with a comment stating (a) what it does, (b)
camelCase/units convention if relevant, and (c) the code-split promise "imports NOTHING at runtime
(no `three`, no React, no IO)". Copy this discipline verbatim. From `request-builder.ts` lines 1-12:
```typescript
// Pure, IO-free request builder: app-model PackConfig (camelCase, src/types/config.ts)
// ... This module imports NOTHING at runtime (no `three`, no React, no IO, no random) so it
// stays outside the lazy /result chunk and never threatens the code-split build gate (SC-4).
```

**Imports pattern** — type-only imports from `@/types/config`, `@/` alias throughout
(`request-builder.ts` lines 12-13):
```typescript
import type { PackConfig, RotationMode } from '@/types/config';
import type { BoxRequest, PackOptions, PackRequest } from '@/types/pack-contract';
```

**Named-constant convention** — single tunable thresholds as an exported `const` with a doc
comment citing the decision id. From `request-builder.ts` line 19:
```typescript
export const BAKED_OPTIONS = { time_budget_s: 25, seed: 7, support_ratio: 0.8 } as const;
```
→ `config-tally.ts` does the same for `LARGE_UNIT_THRESHOLD = 1000` (D-03);
`config-persist.ts` for `STORAGE_KEY = 'palletize:config:v1'` + `STORAGE_VERSION = 1` (D-07).

**Total-coverage typing for unions** — use `Record<RotationMode, ...>` so adding a mode is a
compile error; in `box-fit.ts` the `switch (b.rotation)` must end with the `never`-exhaustive
default. From `request-builder.ts` lines 28-37 (the `Record<RotationMode, ApiRotation>` table) and
the RESEARCH `orientationsFor` `default: { const _x: never = b.rotation; return _x; }` idiom.

**Export style** — named function exports, one doc comment per export with the requirement id
(`request-builder.ts` lines 34-56). Define a small `export interface` for compound returns
(`BuildResult` at line 44 → `FitResult`/`FitFailure`, `CatalogTally` here).

**Non-mutation + never-throw discipline** — `request-builder.ts` "Non-mutating: never assigns
onto the input config" (line 55). `config-persist.deserializeConfigOrDefault` MUST "Never throw"
(RESEARCH Pattern 7) — wrap `JSON.parse` in try/catch, return `DEFAULT_CONFIG` on every failure.

---

### `src/lib/box-fit.test.ts`, `config-tally.test.ts`, `config-persist.test.ts` (test)

**Analog:** `src/lib/request-builder.test.ts` (synthetic-input style) + `palette.test.ts` (small-case style)

**Imports / wiring** (`request-builder.test.ts` lines 1-8) — copy verbatim:
```typescript
import { describe, expect, it } from 'vitest';
import { buildPackRequest, rotationToApi } from '@/lib/request-builder';
import type { PackConfig } from '@/types/config';
```
The `@/` alias is load-bearing (proves tsconfigPaths resolves in Vitest). Every test file carries
the comment noting it stays "jsdom-WebGL-free" / "pure transform logic only" (lines 2-3).

**Synthetic-input fixture** — declare a typed `const config: PackConfig = {...}` covering all three
`RotationMode` values, multi-letter non-digit-leading ids (`request-builder.test.ts` lines 14-52).
Reuse this exact shape as the base input for `box-fit.test.ts` (mutate pallet/box dims per case).

**Test organization** — one `describe` per behavior, each tagged with the requirement/SC id in the
string (`request-builder.test.ts` lines 54, 97, 119, 141). Mirror RESEARCH's golden cases:
box-fit → exact-fit, overhang-edge, too-tall-but-rotatable (free passes / fixed fails), 2000mm typo;
config-tally → counts, >1000 threshold, NaN-safety; config-persist → round-trip, null, unparseable,
version-mismatch, shape-fail.

**Golden-literal assertions** — assert literal expected values, not formula-derived, so regressions
fail loudly (`request-builder.test.ts` lines 76-83, 144-150). The deterministic-stability test
(lines 97-104) and "does not mutate input" test (lines 173-177) translate directly to the new libs.

---

### `src/hooks/useLocalStorageAutosave.ts` (hook, file-I/O)

**Analog:** no existing hook in repo. Borrow the *discipline*, not the shape.

- Header block in the `mapping.ts`/`request-builder.ts` style: state that ALL IO (`JSON.parse`,
  `localStorage`) lives HERE and the pure (de)serialize/migrate logic lives in `config-persist.ts`
  (RESEARCH "Rationale for the lib/hook split", line 189).
- Import the pure functions from `@/lib/config-persist` and the schema from `@/features/config/schema`.
- Use RESEARCH Pattern 7: `form.subscribe` (RHF 7.77) + 400ms debounce; clear timer on cleanup;
  save RAW values unconditionally (D-04 — never gate the write on validity).
- This file is NOT unit-tested in isolation (RESEARCH §Validation); the restore-after-reload path is
  covered by the new Playwright spec.

---

### `src/features/config/schema.ts` (zod, validation)

**Analog:** `src/types/config.ts` (the type it must mirror) — there is NO existing zod in the repo
(this is zod's first use, C-01).

- Cross-check the schema against the locked type: `... satisfies z.ZodType<PackConfig>` (RESEARCH
  Code Examples, line 496) so `tsc -b` enforces schema-output ⊇ type shape — same compile-time-guard
  philosophy as `request-builder.ts`'s `Record<RotationMode, ApiRotation>`.
- Two-schema split (RESEARCH Pitfall 4): strict `packConfigSubmitSchema` (resolver) + lenient
  `packConfigShapeSchema` (restore guard). Reject `""` before `z.coerce.number()` (Pattern 1).
- Header comment in house style noting this is the single source of D-02 validation rules.

### `src/features/config/defaults.ts` (config)

**Analog:** `request-builder.ts` `BAKED_OPTIONS` const pattern. Export `DEFAULT_CONFIG: PackConfig`
(EUR-shaped, D-09) and `makeDefaultBoxType()` — the latter generates a **letter-prefixed nanoid id**
(`` `b${nanoid(8)}` ``, C-06 / Pitfall 5). Type the default against `PackConfig` so it stays in sync.

---

### Form components (`ConfigForm`, `PalletCard`, `BoxCatalogCard`, `BoxRow`, `FooterBar`) and shared primitives (`NumberField`, `Switch`, `SegmentedControl`, `Card`, `SectionLabel`)

**Analog:** none in-repo (only `Hello.tsx` exists — a one-line smoke). **Use RESEARCH.md patterns
1–7 and 04-UI-SPEC.md as the primary source.** Carry forward only these house conventions:

- `export default function ComponentName()` (matches `Hello.tsx` line 5, `ConfigurePage.tsx` line 1).
- Tailwind utilities over the ported `@theme` tokens; `clsx` (already installed) for conditional
  classes (`.on`/`.sel`/error borders) per RESEARCH "Don't Hand-Roll".
- `@/` alias for all cross-module imports.
- **Code-split gate (C-05, Pitfall 1):** these files import ONLY from `@/lib/request-builder`,
  `@/lib/palette`, `@/lib/box-fit`, `@/lib/config-tally`, `@/types/config`, `@/features/config/*`,
  `@/components/*`, `@/hooks/*` — NEVER from `src/components/viewer/*` or `ResultPage`. None pull `three`.
- Per-type swatch colour via `colorForType(allIds)` from `@/lib/palette` (returns a `Map`, look up by
  `id`) — see `palette.ts` lines 15-25. Do NOT hard-code mockup seed colours (UI-SPEC Color §).

---

### `src/features/config/*.test.tsx` (component tests)

**Analog:** `src/components/Hello.test.tsx`

**Imports / wiring** (copy verbatim, lines 1-7):
```typescript
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
```
Add `@testing-library/user-event` for interaction tests (add/remove box, fragile toggle, rotation,
Run-blocks-on-invalid). `toBeInTheDocument` matcher comes from jest-dom wired in `src/test/setup.ts`
(Hello.test.tsx lines 11-13). Keep these jsdom tests WebGL-free (lines 4-6).

---

### `src/types/config.ts` (model — MODIFY in place)

**Analog:** itself. Extend `BoxType` (lines 37-51) with `label: string`, `maxLoad: number`,
`fragile: boolean` (D-08, RESEARCH Code Examples lines 460-471). Match the existing doc-comment
style (the `id` field's comment at lines 38-44 is the template). Update the module header line 5
("No zod this phase") since zod arrives now. Verified additive: `buildPackRequest` reads only
`id/length/width/height/weight/quantity/rotation` (request-builder.ts lines 60-73); `colorForType`
reads only `id` — new fields are ignored by the existing pure layer.

### `src/routes/ConfigurePage.tsx` (route — REPLACE body)

**Analog:** itself (current body is the `<h1>Palletize</h1>` placeholder, lines 1-7). Replace with
`<ConfigForm />`. Keep `export default function ConfigurePage()`. Stays the EAGER `/` chunk — no
`three` imports (C-05).

### `src/styles.css` (tokens — MODIFY `@theme`)

**Analog:** itself. The existing `@theme` block (lines 19-32) already shows the convention: dark
`--color-d-*` group ported verbatim from a mockup `:root` with a provenance comment. Add the
**light config-form token group** the same way per the UI-SPEC Token Porting Checklist (lines
191-205): `--color-bg/surface/surface-2/border/border-strong/text/text-2/text-3/accent-weak/
accent-text/danger`, `--radius/-sm/-lg`, `--topbar-height`, `--card-body-padding`, `--shadow`.
`--color-accent` already present (line 22) — keep. Dark group untouched.

---

## Shared Patterns

### Pure-lib house style (header + imports + exports)
**Source:** `src/lib/request-builder.ts` lines 1-19, 34-56 (also `palette.ts`, `mapping.ts`)
**Apply to:** `box-fit.ts`, `config-tally.ts`, `config-persist.ts`, `defaults.ts`
- Multi-line header stating purpose + units + "imports NOTHING at runtime (no three/React/IO)".
- Type-only `import type ... from '@/...'`. Named exports, one doc comment + requirement id each.
- Exported `const` for thresholds; `export interface` for compound returns; non-mutating; never-throw.

### Code-split discipline (C-05 / Pitfall 1)
**Source:** stated in `request-builder.ts` lines 3-5, `mapping.ts` lines 14-15
**Apply to:** every new file in the eager `/` chunk (all of them this phase)
- The form and its libs must transitively avoid `three`/r3f/drei. Import only the modules listed in
  the form-components section above. `scripts/check-code-split.mjs` fails the build otherwise.

### Test wiring
**Source:** `src/lib/request-builder.test.ts` lines 1-8 (unit), `src/components/Hello.test.tsx` lines 1-7 (component)
**Apply to:** all `*.test.ts` (pure) and `*.test.tsx` (component) added this phase
- `import { describe, expect, it } from 'vitest'`; `@/` alias for SUT imports; "jsdom-WebGL-free"
  comment. Component tests add `@testing-library/react` + `user-event`; matchers from `setup.ts`.
- One `describe` per behavior tagged with the requirement/SC id; golden-literal assertions.

### Compile-time contract guards
**Source:** `request-builder.ts` `Record<RotationMode, ApiRotation>` (lines 28-32)
**Apply to:** `schema.ts` (`satisfies z.ZodType<PackConfig>`), `box-fit.ts` (`never`-exhaustive
rotation switch), `defaults.ts` (`DEFAULT_CONFIG: PackConfig`)
- Lean on `tsc -b` (run by `npm run build`) to catch type/schema drift instead of runtime checks.

### Per-type colour
**Source:** `src/lib/palette.ts` `colorForType(typeKeys[]): Map<string,string>` (lines 15-25)
**Apply to:** `BoxRow.tsx` / `BoxCatalogCard.tsx` swatches
- Call once with all box `id`s, look up the swatch by stable `id` (not parsed prefix) — keeps the
  Phase 6 legend consistent.

---

## No Analog Found

| File | Role | Data Flow | Reason / Source to use instead |
|------|------|-----------|--------------------------------|
| `src/features/config/BoxCatalogCard.tsx` | component | event-driven (CRUD list) | No `useFieldArray` usage exists yet → RESEARCH Pattern 2 |
| `src/features/config/BoxRow.tsx` | component | request-response | No `Controller`/segmented/toggle exists → RESEARCH Patterns 3 & 4 |
| `src/features/config/FooterBar.tsx` | component | event-driven | No `useWatch`+tally exists → RESEARCH Pattern 5 |
| `src/hooks/useLocalStorageAutosave.ts` | hook | file-I/O | No hooks dir/hook exists → RESEARCH Pattern 7 (`form.subscribe`) |
| `src/components/NumberField/Switch/SegmentedControl/Card/SectionLabel.tsx` | component primitives | request-response | No hand-built primitives exist → UI-SPEC + RESEARCH; `Hello.tsx` gives only the `export default function` shell |

The form/component layer has no real in-repo precedent (the codebase is pure-logic + 3D-viewer so
far). RESEARCH.md Patterns 1–7 + 04-UI-SPEC.md are authoritative for these files; this PATTERNS.md
contributes the file-header/import/export/test conventions they must still follow.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/types/`, `src/routes/`, `src/hooks/` (absent), `src/styles.css`
**Files scanned:** request-builder.ts (+test), palette.ts (+test), mapping.ts, config.ts, ConfigurePage.tsx, Hello.tsx (+test), styles.css
**Pattern extraction date:** 2026-06-04
