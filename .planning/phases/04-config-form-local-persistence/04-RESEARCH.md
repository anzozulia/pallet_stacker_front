# Phase 4: Config Form & Local Persistence - Research

**Researched:** 2026-06-04
**Domain:** React form architecture (react-hook-form + zod) + pure validation/feasibility logic + localStorage persistence — frontend-only, no API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (carry-forward + this-phase)
- **C-01:** Form stack is **react-hook-form + `useFieldArray`** with **zod + `zodResolver`** (`@hookform/resolvers`). zod's first use in the project lands here.
- **C-02:** The form fills the **exact locked `PackConfig` / `PalletConfig` / `BoxType`** in `src/types/config.ts`. Field convention: camelCase, mm integers / kg. The pure layer owns the contract; the form merely produces it.
- **C-03:** Rotation = the API's **3 modes only** — `free` / `uprightOnly` / `fixed` (default `free`). **No 6-chip UI.** Map labels honestly ("Any orientation" / "Keep this side up" / "Fixed").
- **C-04:** **No CoG-envelope input field** — drop it from the port (API accepts no CoG limit; CoG is output-only).
- **C-05:** The form lives in the **eager `/` (`ConfigurePage`) chunk** — it MUST NOT import `three` / r3f / drei (the `scripts/check-code-split.mjs` build gate keeps three in the lazy `/result` chunk only).
- **C-06:** `BoxType.id` is a **builder-controlled, non-digit-leading slug** (so the `typeKeyOf` parse-fallback in `mapping.ts` stays correct). `nanoid` is available; prefix any generated id with a letter.

- **D-01 (box-fits-pallet — HARD BLOCK):** Block submission if any box type cannot fit the pallet envelope in **any allowed orientation**. **Conservative** check — only reject *genuinely impossible* boxes. Respect rotation mode (free = 6 axis orientations; uprightOnly = base footprint with 90° in-plane turn, height fixed; fixed = exact L/W/H, no rotation), `maxOverhang` (footprint may exceed pallet L×W by up to overhang), and max stack height (chosen up-axis extent ≤ height). Pure, coordinate-free, jsdom-testable, lives in `src/lib/`.
- **D-02 (truly-invalid inputs that block):** Submission blocked when any dimension/weight/quantity is missing, ≤ 0, or non-integer for mm fields (kg may be decimal); catalog has zero box types or zero total units; any pallet field ≤ 0. zod schema is the single source.
- **D-03 (large-unit-count warning — BOX-05):** **Non-blocking** soft warning when total expanded units > 1000. Single named constant. Never blocks Run.
- **D-04 (error timing):** RHF **`mode: 'onSubmit'` + `reValidateMode: 'onChange'`**. Validation blocks **only Run/submit**; **persistence always captures work-in-progress, even when invalid**.
- **D-05 (full shell):** Build full `design/config.html` chrome now: topbar (brand + Configure/Result step nav) + two cards (Pallet config, Box catalog) + sticky footer (live total + Run button).
- **D-06 (Run = build-request-to-console):** Run button present, **disabled while form invalid**; on valid click runs existing **`buildPackRequest(config)`** and **logs / surfaces the resulting `PackRequest` JSON** — no network.

### Claude's Discretion (defaults locked here)
- **D-07 (Persistence — DATA-02):** **Auto-save** live `PackConfig` to a **single** localStorage slot **`palletize:config:v1`**, **debounced (~400ms)**, **restore on load**. Persist `{ version: 1, config: PackConfig }`. On load: version mismatch / unparseable / shape-or-zod-check fail → **discard silently and seed defaults**. "Save draft" button does an **immediate save + "Saved ✓"** confirmation. Suggested split: thin `useLocalStorage`-style hook + a pure (de)serialize/migrate function in `src/lib/` (no IO in the pure part).
- **D-08 (Box model extension — BOX-03):** Extend `BoxType` with `label: string`, `maxLoad: number`, `fragile: boolean`. fragile ON disables+zeroes maxLoad; OFF restores previous. **⚠ `BoxRequest` has NO slot for `maxLoad`/`fragile` — for v1 collect/persist/display but DO NOT send.** Swatch colour from `colorForType(id)`.
- **D-09 (seed defaults):** Seed a EUR-shaped pallet (1200×800, max stack ~1800mm, max weight ~1000kg, max overhang ~40mm, maxPallets ~2) + one starter box type. New types default to `free`, default label, reasonable dims. Empty catalog is a valid editing state but blocks Run.
- **D-10 (`maxPallets` — PACK-03):** Single integer field, placed with the pallet/limits group. Other three options stay baked in the request-builder.

### Deferred Ideas (OUT OF SCOPE)
- Standard pallet presets picker (CFG-V2-01); duplicate-a-box-type / CSV import-export (CFG-V2-02/03); share-via-URL (SHR-V2-01); mm/in toggle (permanently OoS); sending `maxLoad`/`fragile` to API (pending Phase 5 OpenAPI); wiring Run to real submit/poll (Phase 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PALLET-01 | Set pallet length, width, max stack height (mm) | RHF registered number fields + zod `int().positive()` per-field; Standard Stack + Pattern 1 |
| PALLET-02 | Set pallet max weight (kg) + max overhang (mm) | Same field pattern; kg allows decimal, mm integer-only — see Pitfall 2 (number coercion) |
| BOX-01 | Add / edit / remove box types | `useFieldArray` (`append`/`remove`/`update`); Pattern 2 |
| BOX-02 | Per-type L/W/H (mm), unit weight (kg), quantity | `useFieldArray` row fields + zod element schema |
| BOX-03 | Max-load-on-top + fragile flag (fragile = nothing on top) | D-08 fragile↔maxLoad interaction via `Controller` + `setValue`; Pattern 4 |
| BOX-04 | 3-mode rotation per type | `RotationMode` union already mapped in request-builder; segmented control bound via `Controller`; Pattern 3 |
| BOX-05 | Live running total + large-count warning | `useWatch` on boxTypes → pure tally fn; D-03 threshold constant; Pattern 5 |
| BOX-06 | Validate + block invalid submit with clear messages | zodResolver schema (D-02) + box-fit check (D-01) surfaced as form errors; Pattern 6 |
| PACK-03 | Set `max_pallets` | Single `maxPallets` int field (D-10) |
| DATA-02 | Save config locally, restore after refresh | Debounced auto-save + restore-with-guard; Pattern 7; pure (de)serialize in `src/lib/` |
</phase_requirements>

## Summary

This is a frontend-only React form phase. The pure transform core (`buildPackRequest`, `mapping`, `palette`) and the contract types were built and tested in Phases 2–3 and are **consumed unchanged** here — the one type edit is extending `BoxType` with three new fields (D-08). The whole phase is "well-trodden React forms territory" with three genuinely novel pieces that demand pure, jsdom-tested functions: (1) the **conservative box-fits-pallet feasibility check** (D-01), (2) the **versioned localStorage (de)serialize/migrate guard** (D-07), and (3) the **live unit/weight tally** (BOX-05). Everything else is RHF + zod + Tailwind mechanics.

The stack is already fully specified and version-locked in CLAUDE.md and verified against the npm registry. **Three packages must be installed this phase** (`react-hook-form@7.77.0`, `zod@4.4.3`, `@hookform/resolvers@5.4.0`); `nanoid@5.1.11` and `clsx@2.1.1` are already in `package.json`. The single highest-value technical insight is the **number-input coercion trap**: HTML number inputs emit strings, empty inputs become `NaN`/`""`, and `z.coerce.number()` silently turns `""` into `0` — which would let an empty required field pass as a valid `0`. The schema must explicitly reject empty/non-numeric before coercion. The second is that RHF 7.77 ships a dedicated `form.subscribe` API that is the correct, re-render-free way to drive debounced autosave.

**Primary recommendation:** Build the form as `useForm<PackConfig>` with `zodResolver`, `mode:'onSubmit'` + `reValidateMode:'onChange'`, seeded by a pure `restoreOrSeedDefaults()` that reads localStorage through a shape-guarded pure deserializer. Put all decision logic (fit check, tally, serialize/migrate) in pure `src/lib/*.ts` files with co-located `.test.ts`; keep React components thin. Wire autosave via `form.subscribe` + a 400ms debounce. Bind the three "controlled-ish" inputs (rotation segmented control, fragile toggle, number fields needing custom coercion) through `Controller`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pallet + box catalog form state | Browser / Client (RHF) | — | Stateless client; no backend. RHF owns form state in-memory. |
| Input validation (shape, ranges) | Browser / Client (zod schema) | — | All validation client-side; zodResolver runs in the browser. |
| Box-fits-pallet feasibility check | Pure logic (`src/lib/`) | Client (surfaces errors) | Coordinate-free pure function; React only displays the verdict. |
| Live running total / large-count warning | Pure logic (`src/lib/`) | Client (`useWatch`) | Tally is a pure reduce; React subscribes and renders. |
| Config persistence (auto-save/restore) | Browser / Client (localStorage) | Pure logic (serialize/migrate guard) | localStorage is the only persistence (project mandate); IO in hook, logic pure. |
| Request building (Run) | Pure logic (`request-builder.ts`, existing) | Client (Run handler) | Already built in Phase 3; consumed, not modified. |
| Per-type swatch colour | Pure logic (`palette.ts`, existing) | Client | Deterministic colour by stable `id`; consumed unchanged. |

**Note:** There is NO API / Backend / Database tier in this phase. The Run button stops at the network edge (`buildPackRequest` → `console.log`). Phase 5 adds the API tier.

## Standard Stack

### Core (must install this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | `7.77.0` | Form state + `useFieldArray` for the dynamic catalog | CLAUDE.md mandate; uncontrolled-first → cheap re-renders even with many box-type rows. `useFieldArray` is purpose-built for dynamic typed-row arrays. [VERIFIED: npm registry] [CITED: CLAUDE.md] |
| zod | `4.4.3` | Schema validation + single source of D-02 rules | CLAUDE.md mandate; `z.infer` keeps form types in sync with the schema. zod v4 line. [VERIFIED: npm registry] [CITED: CLAUDE.md] |
| @hookform/resolvers | `5.4.0` | Bridges zod → RHF (`zodResolver`) | CLAUDE.md mandate; v5 supports zod v4. Peer requires only `react-hook-form ^7.55.0` (satisfied by 7.77). Import: `@hookform/resolvers/zod`. [VERIFIED: npm registry] [CITED: github.com/react-hook-form/resolvers] |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | `5.1.11` | Generate `BoxType.id` slugs | New box-type id. **Must prefix with a letter** (C-06) — e.g. `` `b${nanoid(8)}` `` — so the leading char is non-digit. Already in `package.json`. [VERIFIED: npm registry] |
| clsx | `2.1.1` | Conditional Tailwind class strings | Toggling `.on`/`.sel`/error states (rotation segmented control, fragile-disabled inputs, invalid-field borders). Already in `package.json`. [VERIFIED: npm registry] |

### Already-built, consumed unchanged
| Module | Purpose | Note |
|--------|---------|------|
| `src/lib/request-builder.ts` → `buildPackRequest` | Run button feeds it (D-06) | Returns `{ request, idToType }`. Do not modify. |
| `src/lib/palette.ts` → `colorForType(typeKeys[])` | Per-type swatch colour | Takes an **array** of keys, returns a `Map`. Call once with all `id`s; look up by `id`. |
| `src/lib/mapping.ts` → `typeKeyOf` | Explains the non-digit-leading slug rule | Not called by the form; informs C-06. |
| `src/types/config.ts` | The shape `useForm<PackConfig>` binds to | **EXTEND `BoxType`** with `label`/`maxLoad`/`fragile` this phase. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form | TanStack Form / Formik | CLAUDE.md locks RHF; do not re-litigate. Formik is heavier/slower for dynamic arrays. |
| zod | valibot / arktype | CLAUDE.md locks zod v4; resolver + docs ecosystem favour it. |
| `Controller` for number fields | bare `register` + `valueAsNumber` | `valueAsNumber` returns `NaN` on empty → noisy. Prefer `register` with a `setValueAs` shim OR a schema-level preprocess (see Pitfall 2). `Controller` only where truly needed (rotation, fragile). |
| Custom debounce | a tiny inline `setTimeout`+clear in the autosave effect | No new dependency needed; ~6 lines. Avoid pulling lodash for one debounce. |

**Installation:**
```bash
npm install react-hook-form@7.77.0 zod@4.4.3 @hookform/resolvers@5.4.0
# nanoid@5.1.11 and clsx@2.1.1 already present
```

**Version verification (2026-06-04):** `react-hook-form@7.77.0` (pub 2026-05-31), `zod@4.4.3` (pub 2026-05-04), `@hookform/resolvers@5.4.0` (peer: `react-hook-form ^7.55.0`, dep `@standard-schema/utils ^0.3.0`) — all confirmed via `npm view`. [VERIFIED: npm registry]

## Package Legitimacy Audit

> slopcheck and ctx7 were **unavailable** at research time (`pip install slopcheck` failed in sandbox; `ctx7` not on PATH). Per protocol, packages would normally be tagged `[ASSUMED]` and gated behind `checkpoint:human-verify`. **However**, all five packages are already in the project's locked stack (CLAUDE.md, verified against the npm registry on 2026-06-03 by the architecture step) and two are already installed. The planner should treat install of the three new packages as low-risk but MAY add a single `checkpoint:human-verify` before `npm install` if following protocol strictly.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-hook-form | npm | ~6 yrs | ~10M/wk | github.com/react-hook-form/react-hook-form | unavailable | Approved (CLAUDE.md locked) |
| zod | npm | ~5 yrs | ~30M/wk | github.com/colinhacks/zod | unavailable | Approved (CLAUDE.md locked) |
| @hookform/resolvers | npm | ~5 yrs | ~7M/wk | github.com/react-hook-form/resolvers | unavailable | Approved (CLAUDE.md locked) |
| nanoid | npm | ~7 yrs | ~40M/wk | github.com/ai/nanoid | unavailable | Already installed |
| clsx | npm | ~6 yrs | ~30M/wk | github.com/lukeed/clsx | unavailable | Already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Postinstall check:* none of these packages run network/filesystem postinstall scripts (they are pure JS libraries). No `[SUS]` flag warranted.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌──────────────────────── ConfigurePage (eager / chunk, NO three) ───────────────────────┐
                        │                                                                                          │
  page load ───► restoreOrSeedDefaults() ──reads──► localStorage "palletize:config:v1"                            │
                        │        │                          │                                                      │
                        │        │ (pure deserialize+guard) │ mismatch/invalid → seed DEFAULT_CONFIG (D-09)       │
                        │        ▼                          ▼                                                      │
                        │   useForm<PackConfig>({ defaultValues, resolver: zodResolver(packConfigSchema),          │
                        │                          mode:'onSubmit', reValidateMode:'onChange' })                   │
                        │        │                                                                                  │
   user types ──► register / Controller fields ──► RHF internal state                                             │
                        │        │                          │                                                      │
                        │        │ form.subscribe(cb) ──debounce 400ms──► serialize ──writes──► localStorage      │
                        │        │ (autosave, no re-render)                                                        │
                        │        │                                                                                  │
                        │   useWatch(boxTypes) ──► tallyUnits() (pure) ──► footer "N types · M units · est K kg"   │
                        │        │                                  └─► units>1000 → soft warning (non-blocking)    │
                        │        ▼                                                                                  │
   click Run ──► handleSubmit(onValid) ──► zod passes? ──no──► field errors shown, Run stays disabled              │
                        │                          │ yes                                                            │
                        │                          ▼                                                                │
                        │              checkAllBoxesFit(config) (pure, D-01) ──fail──► form-level error, block      │
                        │                          │ pass                                                           │
                        │                          ▼                                                                │
                        │              buildPackRequest(config) ──► console.log(JSON)  ◄── Phase 5 replaces this    │
                        └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── features/
│   └── config/                      # first real tenant of src/features/ (was .gitkeep)
│       ├── ConfigForm.tsx           # the <form>, useForm, handleSubmit, Run handler
│       ├── PalletCard.tsx           # pallet dims + limits + maxPallets fields
│       ├── BoxCatalogCard.tsx       # useFieldArray list + Add box type
│       ├── BoxRow.tsx               # one box-type row (dims, weight, qty, maxLoad, fragile, rotation)
│       ├── FooterBar.tsx            # sticky footer: live total, Save draft, Run
│       ├── schema.ts                # zod packConfigSchema + z.infer cross-check vs PackConfig
│       └── defaults.ts             # DEFAULT_CONFIG (D-09) + makeDefaultBoxType()
├── components/                      # shared, reusable primitives (generic)
│   ├── NumberField.tsx              # label + input-affix (unit suffix) + error text
│   ├── Switch.tsx                   # the toggle (fragile, etc.)
│   ├── SegmentedControl.tsx         # 3-mode rotation control (C-03)
│   └── Card.tsx / SectionLabel.tsx  # chrome primitives
├── hooks/
│   └── useLocalStorageAutosave.ts   # thin IO hook: subscribe + debounce + write; restore on mount
├── lib/                             # PURE, co-located *.test.ts, no React/IO/three
│   ├── box-fit.ts (+ .test.ts)      # checkAllBoxesFit / boxFitsPallet (D-01)
│   ├── config-tally.ts (+ .test.ts) # tallyCatalog → { types, units, estKg, overLargeThreshold }
│   └── config-persist.ts (+ .test.ts) # serialize / deserialize+guard / migrate (pure, no IO)
├── routes/
│   └── ConfigurePage.tsx            # renders <ConfigForm /> (replaces placeholder)
└── styles.css                       # add light config @theme token group
```
**Rationale for the lib/hook split:** D-07 explicitly asks for "a thin `useLocalStorage`-style hook + a pure (de)serialize/migrate function in `src/lib/` (no IO in the pure part)." Keep `JSON.parse`/`localStorage` access in the hook; keep shape-guard + version-migrate + defaults-merge in `config-persist.ts` so they are jsdom-unit-testable without mocking `window`.

### Pattern 1: Number field via `register` + schema-level empty-string rejection
**What:** Bind mm/kg/qty inputs and reject empty/non-numeric *before* coercion so a blank required field never passes as `0`.
**When to use:** Every numeric field (all pallet fields, box dims/weight/qty/maxLoad, maxPallets).
**Example:**
```typescript
// Source: github.com/colinhacks/zod discussions #2814 + react-hook-form discussions #6980 (verified pattern)
// schema.ts — reject "" explicitly, then coerce. Do NOT use bare z.coerce.number() for required fields.
import { z } from 'zod';

// mm/qty: positive integer, required
const mmInt = z
  .union([z.string(), z.number()])
  .refine((v) => v !== '' && v !== null && v !== undefined, { message: 'Required' })
  .pipe(z.coerce.number().int('Whole mm only').positive('Must be > 0'));

// kg: positive number, decimals allowed
const kg = z
  .union([z.string(), z.number()])
  .refine((v) => v !== '', { message: 'Required' })
  .pipe(z.coerce.number().positive('Must be > 0'));
```
```tsx
// In the component: register normally; let the schema do coercion.
<input type="number" inputMode="numeric" {...register(`boxTypes.${i}.length`)} />
```
**Alternative (RHF-side coercion):** `register('length', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })` paired with `z.number().int().positive()`. Either approach is acceptable; pick ONE and apply it uniformly (mixing causes confusion). The schema-side approach keeps zod as the single source (D-02) and is recommended.

### Pattern 2: Dynamic catalog with `useFieldArray`
**What:** Add / edit / remove box types.
**When to use:** BOX-01.
**Example:**
```tsx
// Source: react-hook-form.com/docs/usefieldarray (verified API)
const { control, register } = useForm<PackConfig>({ /* ... */ });
const { fields, append, remove } = useFieldArray({ control, name: 'boxTypes' });

// IMPORTANT: key on field.id (RHF's stable internal key), NOT on array index.
{fields.map((field, i) => (
  <BoxRow key={field.id} index={i} control={control} register={register} onRemove={() => remove(i)} />
))}

// Add (mirror the mockup: focus + scroll the new row)
append(makeDefaultBoxType());   // makeDefaultBoxType() generates a letter-prefixed nanoid id (C-06)
```
**Note:** `field.id` is RHF's own key (NOT your `BoxType.id`). You still store your own `id` as a field value (`boxTypes.${i}.id`) — keep it in a hidden/derived field, do not let the user edit it.

### Pattern 3: 3-mode rotation segmented control via `Controller`
**What:** Replace the mockup's 6 chips with a 3-mode control (C-03).
**When to use:** BOX-04.
**Example:**
```tsx
// Source: react-hook-form.com/docs/usecontroller/controller (verified API)
const ROTATION_OPTIONS: { value: RotationMode; label: string }[] = [
  { value: 'free',        label: 'Any orientation' },
  { value: 'uprightOnly', label: 'Keep this side up' },
  { value: 'fixed',       label: 'Fixed' },
];

<Controller
  control={control}
  name={`boxTypes.${i}.rotation`}
  render={({ field }) => (
    <SegmentedControl value={field.value} options={ROTATION_OPTIONS} onChange={field.onChange} />
  )}
/>
```
`RotationMode` is already the locked union and is already mapped to the API string by `rotationToApi` — the form only needs to set one of the three values.

### Pattern 4: fragile ↔ maxLoad interaction (D-08)
**What:** fragile ON → disable + zero maxLoad; OFF → restore previous value.
**When to use:** BOX-03.
**Example:**
```tsx
// Watch fragile for this row; on toggle, stash/restore maxLoad.
const fragile = useWatch({ control, name: `boxTypes.${i}.fragile` });
const prevMaxLoad = useRef<number>(0);

const onFragileChange = (checked: boolean) => {
  if (checked) {
    prevMaxLoad.current = getValues(`boxTypes.${i}.maxLoad`) ?? 0;
    setValue(`boxTypes.${i}.maxLoad`, 0, { shouldValidate: true, shouldDirty: true });
  } else {
    setValue(`boxTypes.${i}.maxLoad`, prevMaxLoad.current, { shouldValidate: true, shouldDirty: true });
  }
  setValue(`boxTypes.${i}.fragile`, checked, { shouldDirty: true });
};
// maxLoad input: disabled={fragile}
```
**Edge case for restore-after-reload:** if a fragile row is restored from localStorage with `maxLoad:0`, the "previous value" is genuinely unknown — restoring to `0` (or `makeDefaultBoxType().maxLoad`) is acceptable; the prev-value memory is per-session only. Document this; don't try to persist the pre-fragile value.

### Pattern 5: Live running total via `useWatch` + pure tally
**What:** Footer `N types · M units · est. K kg` + large-count warning (BOX-05 / D-03).
**When to use:** the sticky footer + the catalog card badge.
**Example:**
```tsx
// config-tally.ts (PURE, tested)
export const LARGE_UNIT_THRESHOLD = 1000; // D-03 single named constant
export interface CatalogTally { types: number; units: number; estKg: number; overThreshold: boolean; }
export function tallyCatalog(boxTypes: Pick<BoxType,'quantity'|'weight'>[]): CatalogTally {
  let units = 0, estKg = 0;
  for (const b of boxTypes) {
    const q = Number.isFinite(b.quantity) ? b.quantity : 0;
    const w = Number.isFinite(b.weight) ? b.weight : 0;
    units += q; estKg += q * w;
  }
  return { types: boxTypes.length, units, estKg: Math.round(estKg), overThreshold: units > LARGE_UNIT_THRESHOLD };
}
```
```tsx
// In FooterBar: subscribe to just the array, recompute cheaply.
const boxTypes = useWatch({ control, name: 'boxTypes' });
const { types, units, estKg, overThreshold } = tallyCatalog(boxTypes ?? []);
```
Guard against in-progress `NaN`/`undefined` (a half-typed qty) — the tally must never render `NaN`. The pure fn coerces non-finite to 0 (above), which is the correct soft behaviour during editing.

### Pattern 6: Run gate — zod errors + box-fit check
**What:** Run disabled when invalid; on valid click, run the pure fit check then build+log.
**When to use:** BOX-06 / D-01 / D-06.
**Example:**
```tsx
const { handleSubmit, formState: { isValid }, setError } = useForm<PackConfig>({ /* mode/reValidate */ });

const onValid = (config: PackConfig) => {
  const fit = checkAllBoxesFit(config);            // pure, D-01
  if (!fit.ok) {
    fit.failures.forEach(f =>
      setError(`boxTypes.${f.index}.length`, { type: 'fit', message: f.message }));
    return; // blocked
  }
  const { request } = buildPackRequest(config);    // existing Phase-3 fn
  console.log('[Phase 4 Run] PackRequest:', JSON.stringify(request, null, 2));
};

<button disabled={!isValid} onClick={handleSubmit(onValid)}>Run packing</button>
```
**Note on `isValid`:** with `mode:'onSubmit'`, `formState.isValid` is only meaningful after the first submit or with `reValidateMode`. The Run button "disabled while invalid" can be driven by `isValid` after first submit; consider also surfacing the box-fit failures inline. The box-fit check is NOT part of the zod schema (it is cross-field, pallet+box) — run it in `onValid` and map results to `setError`.

### Pattern 7: Versioned localStorage persist with shape guard (D-07)
**What:** Debounced auto-save + restore-or-seed-defaults.
**Example:**
```typescript
// config-persist.ts — PURE (no window, no localStorage). Tested in jsdom.
import { packConfigSchema } from '@/features/config/schema';
import { DEFAULT_CONFIG } from '@/features/config/defaults';
import type { PackConfig } from '@/types/config';

export const STORAGE_KEY = 'palletize:config:v1';
const STORAGE_VERSION = 1;

export function serializeConfig(config: PackConfig): string {
  return JSON.stringify({ version: STORAGE_VERSION, config });
}

/** Pure: takes the raw string (or null) read by the hook → a valid PackConfig.
 *  Never throws. Returns DEFAULT_CONFIG on null/unparseable/version-mismatch/shape-fail. */
export function deserializeConfigOrDefault(raw: string | null): PackConfig {
  if (raw == null) return DEFAULT_CONFIG;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return DEFAULT_CONFIG; }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CONFIG;
  const { version, config } = parsed as { version?: unknown; config?: unknown };
  if (version !== STORAGE_VERSION) return DEFAULT_CONFIG;        // future: branch to migrate()
  const result = packConfigSchema.safeParse(config);
  return result.success ? result.data : DEFAULT_CONFIG;
}
```
```typescript
// useLocalStorageAutosave.ts — thin IO hook (NOT in lib/, not unit-tested in isolation)
// Restore on mount: read localStorage once, hand to deserializeConfigOrDefault → useForm defaultValues.
// Autosave: form.subscribe (RHF 7.77) → debounce 400ms → localStorage.setItem(STORAGE_KEY, serializeConfig(values)).
// CRITICAL: persistence captures work-in-progress EVEN WHEN INVALID (D-04) — subscribe to raw values,
//   do NOT gate the write on validity. But serialize captures whatever RHF holds, which may include
//   in-progress strings; either persist the raw form values OR coerce. Persist RAW form values
//   (so a half-typed draft survives) and let deserialize's safeParse reject only truly-broken blobs.
```
**Subscribe API (RHF 7.77):**
```typescript
// Source: react-hook-form.com/docs/useform/subscribe (verified) — re-render-free subscription.
useEffect(() => {
  const sub = form.subscribe({
    formState: { values: true },
    callback: ({ values }) => debouncedSave(values),
  });
  return () => sub();         // unsubscribe on unmount
}, [form]);
```
**Tension to resolve in planning:** D-04 says "persistence always captures work-in-progress, even when invalid," but `deserializeConfigOrDefault` runs `safeParse` on restore. The resolution: persist the **raw form values** (which may contain partial/invalid strings), and on restore, `safeParse` will discard a *structurally* broken blob (missing keys, wrong types after migration) → defaults, while a merely *incomplete-but-shaped* draft (e.g. a `0` or empty number) should still restore. The schema used for the **restore guard** should be more lenient than the **submit-gate schema** — i.e. guard on shape/types, not on business rules like `positive()`. **Recommendation:** define two schemas — a strict `packConfigSubmitSchema` (D-02 business rules, used by the resolver) and a lenient `packConfigShapeSchema` (structure/types only, used by the restore guard). The planner should make this two-schema split explicit.

### Anti-Patterns to Avoid
- **Importing `three`/r3f/drei from the form** — breaks the code-split gate (C-05). The form is the eager chunk. (None of the form deps pull three.)
- **Using array index as React key in `useFieldArray`** — causes input state to leak across rows on remove. Use `field.id`.
- **`z.coerce.number()` on required fields without empty-string rejection** — `""` → `0` silently passes (Pitfall 2).
- **Putting `maxLoad`/`fragile` into `BoxRequest` or the request-builder** — verified contract has no slot (D-08). Persist/display only.
- **Gating the autosave write on form validity** — would violate D-04 (lose work-in-progress). Save raw values always.
- **Re-rendering the whole form on every keystroke to recompute the total** — use `useWatch` scoped to `boxTypes`, not top-level `watch()`.
- **Generating a digit-leading id** (`nanoid()` may start with a digit/`-`) — breaks `typeKeyOf` (C-06). Always letter-prefix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic array of typed rows | Custom add/remove + index bookkeeping | RHF `useFieldArray` | Stable keys, dirty tracking, validation wiring for free. |
| Form validation + error mapping | Manual per-field if/else | zod schema + `zodResolver` | Single source (D-02); `z.infer` keeps types synced. |
| String→number coercion + empty handling | Ad-hoc `parseInt` scattered in handlers | Schema `.pipe(z.coerce.number())` after `""` refine (Pattern 1) | One place; avoids the `NaN`/`0` traps. |
| Re-render-free value subscription | Manual event listeners on inputs | RHF `form.subscribe` / `useWatch` | Built for this; correct cleanup. |
| Conditional class strings | Template-string concat | `clsx` (already installed) | Readability; no trailing-space bugs. |
| Unique stable id | Date.now()/counter | `nanoid` (already installed, letter-prefixed) | Collision-free, tiny. |

**Key insight:** RHF + zod cover ~80% of this phase out of the box. The *only* genuinely custom logic is the three pure functions (box-fit, tally, persist-guard) — those are where test effort and review attention belong.

## Runtime State Inventory

> This phase ADDS a localStorage slot and EXTENDS a type. It is not a rename/refactor, but it does introduce persisted runtime state worth inventorying for forward-compat.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **New:** localStorage key `palletize:config:v1` storing `{version:1, config:PackConfig}`. This is the FIRST persisted client state in the project. | New code (D-07). Version field + guard handles future schema growth. |
| Live service config | None — no external services touched this phase. | None — verified (frontend-only, no API). |
| OS-registered state | None. | None — verified (browser-only). |
| Secrets/env vars | `VITE_API_URL` exists but is **not consumed** this phase (Phase 5). No new env vars. | None. |
| Build artifacts | `package.json` + lockfile gain three deps (rhf/zod/resolvers). `src/features/.gitkeep` is replaced by real files. | `npm install` after dependency add. |

**Type-extension impact (`BoxType` gains label/maxLoad/fragile):** verified that adding fields does NOT break consumers — `buildPackRequest` reads only `id/length/width/height/weight/quantity/rotation` (confirmed in `request-builder.ts` lines 60–73); `colorForType` reads only `id`. The new fields are additive and ignored by the existing pure layer. Any existing localStorage from a prior run cannot exist (this is the first persistence), so no migration of real user data is needed; the version guard is purely forward-looking.

## Common Pitfalls

### Pitfall 1: Code-split gate breakage
**What goes wrong:** The form (eager `/`) accidentally imports something that transitively pulls `three`; `scripts/check-code-split.mjs` fails the build.
**Why it happens:** Importing a barrel/util that re-exports viewer code, or importing `result-mapper`/viewer components.
**How to avoid:** The form imports only `request-builder`, `palette`, `config` types, and the new pure libs — all `three`-free (verified). Never import from `src/components/viewer/*` or `ResultPage`.
**Warning signs:** `npm run build` then the code-split check fails citing `index-*.js`.

### Pitfall 2: Number-input coercion (`""` → `0`, empty → `NaN`)
**What goes wrong:** A blank required mm field validates as `0` (with `z.coerce.number()`), or shows "Expected number, received nan" (with `valueAsNumber`).
**Why it happens:** HTML `<input type=number>` emits strings; empty = `""`. `z.coerce.number("")` → `0`. `valueAsNumber` of `""` → `NaN`.
**How to avoid:** Reject `""` *before* coercion (Pattern 1), OR `setValueAs: v => v===''? undefined : Number(v)` with `z.number()`. Apply uniformly. mm/qty use `.int()`; kg omits `.int()`.
**Warning signs:** Tests where an empty field passes; `0`s appearing where the user typed nothing.
[VERIFIED: github.com/colinhacks/zod issues #2461, discussions #2814] [CITED: github.com/orgs/react-hook-form/discussions/6980]

### Pitfall 3: `useFieldArray` index keys
**What goes wrong:** Removing a middle row makes inputs show the wrong row's values.
**Why it happens:** Using `key={index}` instead of `key={field.id}`.
**How to avoid:** Always `key={field.id}` (RHF's internal id, distinct from `BoxType.id`).

### Pitfall 4: Autosave persists invalid drafts AND the restore guard rejects them
**What goes wrong:** A half-typed draft is saved, but on reload the strict schema `safeParse` rejects it and seeds defaults — the user loses their draft (violates D-04 / SC-5).
**Why it happens:** Reusing the strict submit schema as the restore guard.
**How to avoid:** Two-schema split (Pattern 7): strict submit schema for the resolver; lenient shape/type schema for the restore guard. Save raw values unconditionally.
**Warning signs:** E2E "type partial → reload → draft gone."

### Pitfall 5: nanoid id starting with a digit/symbol
**What goes wrong:** `typeKeyOf("3abc-0")` returns the wrong type prefix; Phase 6 legend mis-colours.
**Why it happens:** `nanoid()` alphabet includes digits and `-`/`_`; a generated id may lead with one.
**How to avoid:** Always letter-prefix: `` `b${nanoid(8)}` `` (or any constant letter). C-06.

### Pitfall 6: Controlled/uncontrolled input warning
**What goes wrong:** React warns "changing an uncontrolled input to controlled" when a number field's value flips between `undefined` and a value.
**Why it happens:** `defaultValues` missing a field, or `setValueAs` returning `undefined`.
**How to avoid:** Seed every field in `DEFAULT_CONFIG` and `makeDefaultBoxType()`; keep inputs registered (uncontrolled) and let RHF own the value.

### Pitfall 7: Stale debounce / leaked timer on unmount
**What goes wrong:** Autosave fires after the component unmounts, or the final keystroke isn't saved.
**Why it happens:** Not clearing the timeout / not unsubscribing.
**How to avoid:** Clear the timer in the effect cleanup; call the `form.subscribe` unsubscribe on unmount. "Save draft" should flush immediately (cancel pending debounce, write now, show "Saved ✓").

## Code Examples

### Extending BoxType (D-08) — `src/types/config.ts`
```typescript
export interface BoxType {
  id: string;          // existing: builder slug, non-digit-leading (C-06)
  label: string;       // NEW: user-facing name, distinct from id (D-08)
  length: number;
  width: number;
  height: number;
  weight: number;
  quantity: number;
  maxLoad: number;     // NEW: max load on top (kg). 0 when fragile. NOT sent to API in v1.
  fragile: boolean;    // NEW: fragile flag. NOT sent to API in v1.
  rotation: RotationMode;
}
```

### zod schema cross-checked against PackConfig — `schema.ts`
```typescript
// Source: zod.dev/api (numbers), verified pattern. z.infer<typeof schema> MUST equal PackConfig.
import { z } from 'zod';
import type { PackConfig } from '@/types/config';

const rotation = z.enum(['free', 'uprightOnly', 'fixed']);

const boxTypeSubmit = z.object({
  id: z.string().regex(/^[^\d]/, 'id must not start with a digit'),
  label: z.string().min(1, 'Name required'),
  length: mmInt, width: mmInt, height: mmInt,
  weight: kg, quantity: mmInt,
  maxLoad: z.union([z.string(), z.number()]).pipe(z.coerce.number().min(0)), // 0 allowed (fragile)
  fragile: z.boolean(),
  rotation,
});

export const packConfigSubmitSchema = z.object({
  pallet: z.object({ length: mmInt, width: mmInt, height: mmInt, maxWeight: kg, maxOverhang: mmInt }),
  boxTypes: z.array(boxTypeSubmit).min(1, 'Add at least one box type'),
  maxPallets: mmInt,
}) satisfies z.ZodType<PackConfig>;   // compile-time guard: schema output ⊇ PackConfig shape

// Lenient guard for the restore path (structure/types only — no business rules)
export const packConfigShapeSchema = z.object({
  pallet: z.object({ length: z.number(), width: z.number(), height: z.number(),
                     maxWeight: z.number(), maxOverhang: z.number() }),
  boxTypes: z.array(z.object({
    id: z.string(), label: z.string(), length: z.number(), width: z.number(), height: z.number(),
    weight: z.number(), quantity: z.number(), maxLoad: z.number(), fragile: z.boolean(),
    rotation, })),
  maxPallets: z.number(),
});
```

### Box-fit feasibility check (D-01) — `box-fit.ts` (pure)
```typescript
// Conservative: only reject genuinely-impossible boxes. Coordinate-free. jsdom-testable.
// "Fits" = at least one allowed orientation has its footprint within pallet L×W + overhang
// (either L or W axis may align with either pallet axis) AND its up-axis extent ≤ pallet height.
import type { BoxType, PalletConfig, RotationMode } from '@/types/config';

interface Orientation { footA: number; footB: number; up: number; } // footprint two dims + up-axis

/** Enumerate allowed [footA, footB, up] orientations for a box given its rotation mode. */
export function orientationsFor(b: Pick<BoxType,'length'|'width'|'height'|'rotation'>): Orientation[] {
  const { length: L, width: W, height: H } = b;
  switch (b.rotation) {
    case 'fixed':        // exact L/W/H, no rotation. Footprint L×W, up = H.
      return [{ footA: L, footB: W, up: H }];
    case 'uprightOnly':  // height fixed (H up); base may turn 90° in-plane → L×W or W×L (same set).
      return [{ footA: L, footB: W, up: H }];
    case 'free':         // any of the 3 axes may point up; footprint = the other two.
      return [
        { footA: L, footB: W, up: H },
        { footA: L, footB: H, up: W },
        { footA: W, footB: H, up: L },
      ];
    default: { const _x: never = b.rotation; return _x; }
  }
}

/** A footprint fits the pallet (with overhang) if it fits in either rotation on the deck. */
function footprintFits(a: number, bb: number, pL: number, pW: number, overhang: number): boolean {
  const maxL = pL + overhang, maxW = pW + overhang;
  return (a <= maxL && bb <= maxW) || (a <= maxW && bb <= maxL);
}

export interface FitFailure { index: number; id: string; message: string; }
export interface FitResult { ok: boolean; failures: FitFailure[]; }

export function checkAllBoxesFit(config: { pallet: PalletConfig; boxTypes: BoxType[] }): FitResult {
  const { pallet } = config;
  const failures: FitFailure[] = [];
  config.boxTypes.forEach((b, index) => {
    const fits = orientationsFor(b).some(
      (o) => o.up <= pallet.height && footprintFits(o.footA, o.footB, pallet.length, pallet.width, pallet.maxOverhang),
    );
    if (!fits) failures.push({ index, id: b.id,
      message: `"${b.label}" cannot fit the pallet in any allowed orientation` });
  });
  return { ok: failures.length === 0, failures };
}
```
**Design note:** `uprightOnly` returns one orientation because `footprintFits` already tries both axis alignments — an explicit `W×L` entry would be redundant. `free` enumerates all three up-axis choices. The check is conservative: it allows anything the solver *might* place, only rejecting the impossible (e.g. a 2000mm box on an 800mm pallet with 40mm overhang and 1800mm height). The planner should add golden tests for: exact-fit, overhang-edge, too-tall-but-rotatable (free passes, fixed fails), and the 2000mm typo case.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `watch((v)=>...)` subscription for side-effects | `form.subscribe({ formState, callback })` | RHF ~7.55+ | Dedicated, clearer re-render-free subscription for autosave. [CITED: react-hook-form.com/docs/useform/subscribe] |
| `zodResolver` import nuance for zod v3 vs v4 | `import { zodResolver } from '@hookform/resolvers/zod'` works for zod v4 | resolvers v5 | One import path; zod v4 supported directly. [CITED: github.com/react-hook-form/resolvers] |
| `z.coerce.number()` everywhere | coerce **after** rejecting `""` (required), or `setValueAs` | ongoing zod-v4 guidance | Avoids `""`→`0` false-pass. [VERIFIED: zod issue #2461] |

**Deprecated/outdated:** Nothing in the chosen stack is deprecated. zod v4 is current; RHF 7.x is current; resolvers v5 is current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `form.subscribe({ formState: { values: true }, callback })` is the exact 7.77 signature | Pattern 7 | LOW — if the signature differs slightly, `watch((v)=>...)` subscription is the documented fallback; both achieve debounced autosave. Verify against installed types. |
| A2 | `z.ZodType<PackConfig>` `satisfies` will compile-check schema-vs-type | Code Examples | LOW — if the variance fights, drop `satisfies` and rely on `z.infer` + a manual type-equality test. |
| A3 | `uprightOnly` semantics = height axis fixed up, base may turn 90° | D-01 / box-fit | MEDIUM — this matches the request-builder mapping (`this_side_up`) and C-03's "Keep this side up," but the exact solver semantics of `this_side_up` are the API's; the conservative check only needs to not over-reject. Confirmed conservative by design. |
| A4 | nanoid default alphabet can start with a digit/`-` | Pitfall 5 / C-06 | LOW — well-documented; letter-prefixing is safe regardless. |
| A5 | slopcheck/ctx7 unavailability → packages safe because CLAUDE.md already verified them on npm 2026-06-03 | Package Legitimacy Audit | LOW — all are top-tier, multi-year, tens-of-millions-weekly-downloads libraries already in the locked stack. |

**Note:** No `[ASSUMED]` claims affect compliance/security/retention. The assumptions above are mechanical API-shape details verifiable at implementation time against installed types.

## Open Questions

1. **Exact `form.subscribe` signature in 7.77**
   - What we know: the subscribe API exists in 7.55+ and is re-render-free; returns an unsubscribe.
   - What's unclear: the precise option object shape in 7.77 (`{ formState: { values: true } }` vs `{ name, formState }`).
   - Recommendation: confirm against `node_modules/react-hook-form` types after install; the `watch`-subscription fallback is equivalent if needed.

2. **`Allow overhang` boolean from the mockup**
   - What we know: D-09/specifics say keep `maxOverhang` as the numeric field; a separate boolean is optional (planner's call).
   - What's unclear: whether to render the toggle at all.
   - Recommendation: omit the separate boolean (numeric `maxOverhang` covers it; 0 = no overhang). Keeps the model = `PalletConfig` exactly.

3. **Whether to pull EUR preset picker into v1 (CFG-V2-01)**
   - What we know: REQUIREMENTS flags it "low cost; consider during planning"; CONTEXT defers it.
   - Recommendation: stay deferred — D-09 seeds a EUR-shaped default already; a picker is scope expansion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | install rhf/zod/resolvers | ✓ (project builds) | per CI (node 22/24) | — |
| react-hook-form | the form | ✗ (must install) | 7.77.0 | none — required |
| zod | validation | ✗ (must install) | 4.4.3 | none — required |
| @hookform/resolvers | zodResolver | ✗ (must install) | 5.4.0 | none — required |
| nanoid | box ids | ✓ (installed) | 5.1.11 | a counter (but nanoid present) |
| clsx | class strings | ✓ (installed) | 2.1.1 | template strings |
| Vitest + @testing-library + jsdom | tests | ✓ (installed) | 4.1.8 / 16.3.2 / ~26 | — |
| @playwright/test | E2E restore-after-reload | ✓ (installed) | 1.60.0 | — |
| localStorage | persistence | ✓ (browser + jsdom provides it) | — | sessionStorage (not needed) |

**Missing dependencies with no fallback:** rhf / zod / @hookform/resolvers — all must be `npm install`ed (they are in the locked stack; this is expected, not a blocker).
**Missing dependencies with fallback:** none material.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.8` (jsdom) + @testing-library/react `16.3.2` + @testing-library/user-event `14.6.1`; Playwright `1.60.0` for E2E |
| Config file | `vitest.config.ts` (jsdom, globals, `setupFiles: ./src/test/setup.ts`, `tsconfigPaths()`); `playwright` for E2E |
| Quick run command | `npx vitest run src/lib/box-fit.test.ts` (or any single file) |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOX-06 / D-01 | box-fits-pallet conservative check (all rotation modes, overhang, height) | unit (pure) | `npx vitest run src/lib/box-fit.test.ts` | ❌ Wave 0 |
| BOX-05 / D-03 | tally types/units/estKg + >1000 warning + NaN-safe | unit (pure) | `npx vitest run src/lib/config-tally.test.ts` | ❌ Wave 0 |
| DATA-02 / D-07 | serialize/deserialize guard: valid restores; bad/version-mismatch → defaults | unit (pure) | `npx vitest run src/lib/config-persist.test.ts` | ❌ Wave 0 |
| BOX-01 | add/remove box type updates the list | component | `npx vitest run src/features/config/BoxCatalogCard.test.tsx` | ❌ Wave 0 |
| BOX-03 / D-08 | fragile ON disables+zeroes maxLoad; OFF restores | component | `npx vitest run src/features/config/BoxRow.test.tsx` | ❌ Wave 0 |
| BOX-04 | rotation control sets one of 3 modes | component | (same BoxRow test) | ❌ Wave 0 |
| BOX-06 / D-02/04 | invalid input shows error on Run, blocks; valid logs request | component | `npx vitest run src/features/config/ConfigForm.test.tsx` | ❌ Wave 0 |
| PALLET-01/02, PACK-03 | pallet + maxPallets fields bind and validate | component | (same ConfigForm test) | ❌ Wave 0 |
| DATA-02 (SC-5) | type partial → reload → draft restored intact | E2E | `npm run test:e2e` (new spec) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single pure-lib test for the unit just changed (`npx vitest run src/lib/<file>.test.ts`).
- **Per wave merge:** `npm run test` (full Vitest) + `npm run typecheck`.
- **Phase gate:** full Vitest + `npm run build` (proves the code-split gate stays green with the new form) + the new Playwright restore-after-reload spec, all green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/box-fit.test.ts` — covers BOX-06/D-01 (exact-fit, overhang-edge, too-tall-rotatable, 2000mm typo)
- [ ] `src/lib/config-tally.test.ts` — covers BOX-05/D-03 (counts, threshold, NaN-safety)
- [ ] `src/lib/config-persist.test.ts` — covers DATA-02/D-07 (round-trip, null, unparseable, version mismatch, shape fail)
- [ ] `src/features/config/*.test.tsx` — component tests (add/remove, fragile toggle, rotation, validation-blocks-Run)
- [ ] `e2e/config-persist.spec.ts` — Playwright partial-draft → reload → restored
- [ ] `src/test/setup.ts` already wires jest-dom; **no new framework install** — Vitest/TL/Playwright present.
- [ ] Confirm jsdom provides `localStorage` (it does); persist tests should pass a raw string to the pure deserializer (no `window` mocking needed by design).

## Security Domain

> `security_enforcement: true`, ASVS level 1. This is a frontend-only, no-auth, no-network, localStorage-only phase. Most ASVS categories do not apply.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in the product (stateless, no login — by design). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No protected resources; single-user local tool. |
| V5 Input Validation | yes | zod schema validates all inputs at the form boundary (D-02). Numeric bounds + integer constraints enforced. |
| V6 Cryptography | no | No secrets stored; localStorage holds only user-entered pallet/box config (non-sensitive). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/oversized localStorage blob (manually edited or corrupted) | Tampering / DoS | Pure `deserializeConfigOrDefault` never throws; `safeParse` + version guard → silent default reset (D-07). |
| XSS via box `label` rendered into DOM | Tampering (stored) | React escapes text by default; render `label` as text content only — **never** `dangerouslySetInnerHTML`. No HTML injection surface. |
| `JSON.parse` on untrusted localStorage | Tampering | Wrapped in try/catch in the pure deserializer (Pattern 7). |
| Prototype pollution via parsed object | Tampering | `safeParse` against an explicit schema discards unknown keys; do not spread parsed object into a shared object before validation. |

**Note:** localStorage data here is non-sensitive (pallet dimensions, box catalog). No PII, no credentials, no retention/compliance requirement. The version-guard reset is the only security-relevant control.

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` — locked stack + versions (rhf 7.77 / zod 4.4.3 / resolvers 5.4 / nanoid 5.1.11 / clsx 2.1.1), code-split discipline, test-as-pure-functions rule.
- npm registry (live, 2026-06-04) — `npm view` confirmed versions + peer deps: rhf 7.77.0, zod 4.4.3, @hookform/resolvers 5.4.0 (peer `react-hook-form ^7.55.0`, dep `@standard-schema/utils ^0.3.0`), nanoid 5.1.11, clsx 2.1.1.
- Codebase: `src/types/config.ts`, `src/types/pack-contract.ts`, `src/lib/request-builder.ts`, `src/lib/palette.ts`, `src/lib/mapping.ts`, `src/routes/ConfigurePage.tsx`, `src/styles.css`, `vitest.config.ts`, `vite.config.ts`, `scripts/check-code-split.mjs`, `package.json`, `design/config.html` — all read directly.
- `.planning/phases/04-config-form-local-persistence/04-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`.
- github.com/react-hook-form/resolvers — `zodResolver` import path for zod v4 (`@hookform/resolvers/zod`).

### Secondary (MEDIUM confidence)
- react-hook-form.com/docs — `useFieldArray`, `subscribe`, `useWatch`, `useController` APIs (WebSearch summaries of official docs; exact signatures to confirm against installed types).
- github.com/colinhacks/zod issues #2461 & discussions #2814 — `z.coerce.number("")`→`0` behaviour and the empty-string-rejection fix.
- github.com/orgs/react-hook-form/discussions #6980 — `valueAsNumber`/`setValueAs` for optional/empty numbers.

### Tertiary (LOW confidence)
- General autosave-with-RHF blog posts (Synthace, Stackademic) — corroborate the debounce-on-watch pattern; superseded here by the `form.subscribe` API.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions npm-verified and CLAUDE.md-locked; nothing speculative.
- Architecture / patterns: HIGH — RHF + zod are well-documented; the lib/hook split is dictated by D-07 and the existing pure-lib convention.
- Box-fit logic: MEDIUM-HIGH — the conservative algorithm is sound and matches the rotation mapping; exact `uprightOnly` solver semantics are the API's but the check is conservative by design (A3).
- Persistence: HIGH — versioned-slot + shape-guard is a standard pattern; two-schema split resolves the D-04 tension.
- Pitfalls: HIGH — the number-coercion trap is well-documented and the highest-impact gotcha.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable stack; ~30 days)
