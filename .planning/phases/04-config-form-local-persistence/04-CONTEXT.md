# Phase 4: Config Form & Local Persistence - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

A fully editable, **validated pallet + box-catalog form** that produces the locked
in-memory `PackConfig` shape (`src/types/config.ts`), shows a **live running total**,
lets the user set **`maxPallets`**, and **survives a page refresh via localStorage** —
with **no API involved yet**.

Delivers **PALLET-01, PALLET-02, BOX-01, BOX-02, BOX-03, BOX-04, BOX-05, BOX-06,
PACK-03, DATA-02** (10 requirements).

**Success criteria (from ROADMAP.md):**
1. Set pallet length / width / max stack height (mm), max weight (kg), max overhang (mm), and `max_pallets`.
2. Add / edit / remove box types — each with L/W/H (mm), unit weight (kg), quantity, max-load-on-top, fragile flag, and a **3-mode** rotation choice (no 6-chip UI, no CoG-envelope input).
3. Live running total of box types + units; warns when the unit count is large.
4. Invalid pallet/box inputs flagged with clear messages and **block submission**.
5. Save the config locally and restore the catalog + pallet settings intact after a refresh.

**Scope guardrail — explicitly NOT this phase:**
- The live **API client / submit / async polling / loading screen / cancel / terminal states** (PACK-01/04/05/06) → **Phase 5**. Phase 4 builds the request body and stops at the network edge (logs it to console).
- The **result page / 3D viewer wiring / summary rail / placement list / diagnostics** (RESULT-03/04/05/06, DIAG-01/02) → **Phase 6**.
- **JSON / printable export, Docker self-hosting, GitHub docs** (DATA-01, HOST-01/02/03) → **Phase 7**.
- The **coordinate mapping**, **request-builder**, and **result-mapper** are already built and tested (Phases 2–3) — Phase 4 *consumes* them, does not touch them.

</domain>

<decisions>
## Implementation Decisions

### Locked carry-forward (from prior phases / PROJECT.md — do NOT re-litigate)
- **C-01:** Form stack is **react-hook-form + `useFieldArray`** (dynamic box catalog) with **zod + `zodResolver`** for validation (CLAUDE.md mandate; `@hookform/resolvers`). zod arrives here as planned — Phase 3 deferred runtime validation, this is its first use.
- **C-02:** The form fills the **exact locked `PackConfig` / `PalletConfig` / `BoxType`** in `src/types/config.ts` (Phase 3 D-01). The pure layer owns the contract; the form merely produces it. Field convention: camelCase, mm integers / kg.
- **C-03:** Rotation = the API's **3 modes only** — `free` / `uprightOnly` / `fixed` (default `free`, D-05/06). **No 6-chip UI** even though `design/config.html` shows six chips. Map labels honestly (e.g. "Any orientation" / "Keep this side up" / "Fixed").
- **C-04:** **No CoG-envelope input field** — `design/config.html` shows one (lines ~218–221); it is **Out of Scope** (the API accepts no CoG limit; CoG is an output diagnostic). Drop it from the port.
- **C-05:** The form lives in the **eager `/` (`ConfigurePage`) chunk** — it MUST NOT import `three` / r3f / drei (the `scripts/check-code-split.mjs` build gate keeps three in the lazy `/result` chunk only).
- **C-06:** `BoxType.id` is a **builder-controlled, non-digit-leading slug** (so the `typeKeyOf` parse-fallback in `src/lib/mapping.ts` stays correct — Pitfall 3). `nanoid` is available; prefix any generated id with a letter.

### Validation & warnings (discussed)
- **D-01 (box-fits-pallet — HARD BLOCK):** The form **blocks submission** if any box type cannot fit the pallet envelope in **any allowed orientation**. Implement as a **conservative** check that only rejects *genuinely impossible* boxes — it MUST respect:
  - the box's **rotation mode**: `free` = any of the 6 axis orientations may be tried; `uprightOnly` = base footprint with a 90° in-plane turn (L×W or W×L), height fixed; `fixed` = exact L/W/H, no rotation.
  - the pallet's **`maxOverhang`** allowance (footprint may exceed pallet L×W by up to the overhang).
  - the pallet's **max stack height** (the chosen up-axis extent must be ≤ height).
  The intent is to catch typos (a 2000mm box on an 800mm pallet), NOT to duplicate the solver. When in doubt, allow — the solver is authoritative and Phase 6's unpacked panel explains real non-fits. ⚠ Planner: this is the trickiest validation rule; keep it conservative and unit-test it as a pure function (it is coordinate-free, fits `src/lib/`).
- **D-02 (truly-invalid inputs that block):** Beyond fit, submission is blocked when: any dimension/weight/quantity is missing, ≤ 0, or non-integer for mm fields (kg may be decimal); the catalog has **zero box types** or zero total units; any pallet field ≤ 0. zod schema is the single source of these rules.
- **D-03 (large-unit-count warning — BOX-05):** A **non-blocking** soft warning appears when total **expanded units > 1000**. Cosmetic/advisory only (solver 25s budget + Phase-6 render cost grow) — it never blocks Run. Threshold is a single named constant (easy to tune).
- **D-04 (error timing):** RHF **`mode: 'onSubmit'` + `reValidateMode: 'onChange'`** — errors first surface on the Run attempt, then update live once a field has errored (least noisy while typing). Validation blocks **only the Run/submit action**; **persistence always captures work-in-progress, even when invalid** (you never lose a draft because it's incomplete).

### Page shell & Run seam (discussed)
- **D-05 (full shell):** Build the full `design/config.html` chrome now: **topbar** (brand + Configure/Result **step nav**) + the two **cards** (Pallet configuration, Box catalog) + a **sticky footer** showing the live running total (`N types · M units · est. K kg`) and the Run button. Phases 5/6 slot into this existing shell without rework.
- **D-06 (Run = build-request-to-console):** The **Run packing** button is **present**, **disabled while the form is invalid**, and on a valid click it runs the existing **`buildPackRequest(config)`** (`src/lib/request-builder.ts`) and **logs / surfaces the resulting `PackRequest` JSON** — no network. This proves the **form → request-builder seam** end-to-end as a demonstrable Phase 4 deliverable. Phase 5 replaces the console output with the real submit→poll, keeping the same disabled-when-invalid gate.

### Claude's Discretion (user skipped these areas; defaults locked here for downstream agents)
- **D-07 (Persistence model — DATA-02):** **Auto-save** the live `PackConfig` to a **single** localStorage slot, **debounced (~400ms)** on every change, and **restore on load** → refresh-safe with zero user action (the strongest reading of SC-5). The footer **"Save draft"** button (mockup parity) triggers an **immediate save + a "Saved ✓" confirmation** so it stays meaningful alongside auto-save (it is not redundant — it is explicit feedback + a flush).
  - **Storage schema & versioning:** persist `{ version: 1, config: PackConfig }` under a stable key **`palletize:config:v1`**. On load, if the version mismatches, JSON is unparseable, or a shape/zod check fails → **discard silently and seed defaults** (never crash-load). This forward-compat matters because the model gains `label`/`maxLoad`/`fragile` this phase and may grow again.
  - **Hydration:** if a saved config exists and validates, hydrate the form from it; otherwise seed defaults (D-09). A thin `useLocalStorage`-style hook + a pure (de)serialize/migrate function in `src/lib/` (no IO in the pure part) is the suggested split — keep the schema-guard testable.
- **D-08 (Box model extension — BOX-03):** **Extend the locked `BoxType`** in `src/types/config.ts` with three fields:
  - `label: string` — user-facing name (e.g. "Standard carton"), **distinct from the builder slug `id`**. New types get a default label.
  - `maxLoad: number` — max load on top (kg).
  - `fragile: boolean` — fragile flag.
  **fragile ↔ maxLoad interaction** (from mockup): toggling fragile **ON disables the maxLoad input and forces it to 0** (fragile = nothing stacked on top); toggling **OFF restores the previous value**.
  **⚠ Critical contract note:** the verified `BoxRequest` (`src/types/pack-contract.ts`, confirmed against `pack-request.json`) has **NO slot for `maxLoad` or `fragile`**. For v1 these fields are **collected, persisted, and displayed but NOT sent to the API**. **Flag for the Phase 5 researcher:** confirm against the live OpenAPI whether the API accepts per-box `max_load` / `fragile` (or whether `fragile` should map to the `this_side_up` rotation) — if so, wire them into the request-builder then. Phase 4 collects + persists only; do not invent request fields.
  - Per-type **swatch colour** comes from **`colorForType(id)`** (`src/lib/palette.ts`) — colour by the stable `id`, not by parsed prefix, so the swatch is stable per type. This keeps the Phase 6 legend consistent.
- **D-09 (seed defaults & empty state):** Seed a sensible default config on first load (no saved draft): a **EUR-style pallet** (1200 × 800, max stack ~1800mm, max weight ~1000kg, max overhang ~40mm, `maxPallets` ~2) and **one starter box type** so the form is never blank. New box types default to `free` rotation, a default label, and reasonable dims (planner's discretion, mirror mockup values). Empty-catalog (user deletes all types) is a valid editing state but **blocks Run** (D-02).
- **D-10 (`maxPallets` placement — PACK-03):** `maxPallets` is a single integer field. Place it with the pallet/limits group (it is a solver budget, not a box attribute). The other three API options (`time_budget_s`, `seed`, `support_ratio`) stay **baked in the request-builder** (Phase 3 D-03) — **not** in the form.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase goal, requirements & scope
- `.planning/ROADMAP.md` §"Phase 4: Config Form & Local Persistence" — the goal and the **5 success criteria** this phase is measured against.
- `.planning/REQUIREMENTS.md` — the 10 phase requirements: **PALLET-01/02** (pallet dims + limits), **BOX-01/02/03/04/05/06** (catalog CRUD, dims/weight/qty, max-load+fragile, 3-mode rotation, live totals + large-count warning, validation), **PACK-03** (`max_pallets`), **DATA-02** (localStorage save/restore). ⚠ Note the BOX-04 footnote at the bottom: the *mapping* shipped in Phase 3; the *user-facing rotation choice* lands here.
- `.planning/PROJECT.md` — constraints (mm integer / kg units, no backend, localStorage-only, build-time `VITE_API_URL`), the **Key Decisions** table ("Simplify rotation UI to the API's 3 modes"), and **Out of Scope** (6-way rotation UI, CoG-as-input) — both directly shape this form.

### Visual north star (the form to port)
- `design/config.html` — the Configure-screen mockup: topbar + step nav, Pallet config card, Box catalog card with per-type rows (dims, weight/unit, quantity, max-load + fragile toggle), the live `typeCount`/`footMeta` running totals, "Add box type", and the sticky footer ("Save draft" + "Run packing"). **Port faithfully EXCEPT:** drop the 6 rotation chips → 3-mode control (C-03), drop the CoG-envelope field (C-04). Light-theme CSS-variable tokens here (`--accent #4f46e5`, surfaces, borders, `--danger #dc2626`) are the palette to fold into Tailwind `@theme`.

### The data contract the form fills (most important)
- `src/types/config.ts` — the **locked `PackConfig` / `PalletConfig` / `BoxType` / `RotationMode`** the form produces. **This phase EXTENDS `BoxType`** with `label` / `maxLoad` / `fragile` (D-08) — update the type + its doc comment.
- `src/types/pack-contract.ts` — the `PackRequest` / `BoxRequest` the request-builder emits. ⚠ `BoxRequest` has **no max-load/fragile slot** — basis for the persist-but-don't-send decision (D-08).
- `src/lib/request-builder.ts` — **`buildPackRequest(config)`**; the Run button feeds it (D-06). Read its signature + the `idToType` return.
- `src/lib/palette.ts` — **`colorForType(typeKeys[])`** for per-type swatch colours (D-08); keep keys consistent with the Phase 6 legend.
- `src/lib/mapping.ts` — `typeKeyOf` (the id-prefix parse fallback) — explains the **non-digit-leading slug** rule for generated ids (C-06).

### Stack, styling & prior-phase decisions
- `CLAUDE.md` — the locked stack + versions (RHF 7.77 / zod 4.4.3 / `@hookform/resolvers` 5.4 / nanoid 5.1.11 / clsx 2.1.1 / Tailwind v4), the RHF+`useFieldArray` and zod guidance, the code-split discipline, and the "test logic as pure functions" rule.
- `src/styles.css` — the Tailwind v4 `@theme` block. Phase 1 deferred the mockup palette to be ported **per-phase as UI lands** — this phase ports the **light config-form token group** from `design/config.html` here.
- `.planning/phases/03-pure-transform-core/03-CONTEXT.md` — the config-model + request-builder contract decisions (D-01 the form↔builder contract, D-03 baked options, D-05/06 rotation modes, D-07 id scheme).
- `.planning/phases/01-scaffolding-version-lock/01-CONTEXT.md` — signposted dirs (`src/features/` is populated **here** per D-01; `src/routes/ConfigurePage.tsx` is the eager `/` page), the per-phase token-porting convention, and the code-split gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/routes/ConfigurePage.tsx`** — currently a one-line placeholder (`<h1>Palletize</h1>`). This phase **replaces its body** with the full config form. It is the **eager `/` route** (not lazy) — no `three` imports allowed.
- **`src/types/config.ts`** — the exact in-memory shape the form binds to (RHF `useForm<PackConfig>`); extended with `label`/`maxLoad`/`fragile` (D-08).
- **`src/lib/request-builder.ts` → `buildPackRequest`** — wired to the Run button (D-06); already unit-tested in Phase 3.
- **`src/lib/palette.ts` → `colorForType`** — deterministic per-type colour for the catalog swatches + (later) the Phase 6 legend.
- **`src/components/`** — only `Hello.tsx` sample exists; shared form primitives (number-with-unit affix input, switch/toggle, card, section-label) are **new** and belong here (`src/components/` or `src/features/config/`).
- **`design/config.html`** — visual + interaction reference (recount logic, add/remove box, fragile→maxLoad toggle behaviour) — port the *behaviour*, not the vanilla-JS code.

### Established Patterns
- **Code-split gate:** `scripts/check-code-split.mjs` keeps `three`/r3f/drei out of the initial bundle — the form (eager `/`) must stay three-free.
- **Pure logic in `src/lib/` with co-located `*.test.ts`, no IO/React/three** — the box-fit check (D-01), the unit-count tallies, and the persistence (de)serialize/migrate guard (D-07) are all pure functions that belong here and are jsdom-testable.
- **Per-phase Tailwind `@theme` token porting** (Phase 1 D-07) — the light config palette lands in `src/styles.css` this phase.
- **Component tests in Vitest + @testing-library/react (jsdom)**; form interaction (add/remove box, validation errors, fragile toggle, restore-after-reload) is testable without WebGL.

### Integration Points
- **Form → request-builder:** `ConfigurePage` form state (`PackConfig`) → `buildPackRequest` on Run (D-06). The Phase 4/5 seam: Phase 5 takes this same `PackRequest` and POSTs it.
- **Form ↔ localStorage:** auto-save/restore hook persists/hydrates `PackConfig` (D-07). The Phase 5 submit flow reads the same in-memory config.
- **`src/features/`** (empty `.gitkeep` since Phase 1) is populated here — the config feature is its first real tenant.

</code_context>

<specifics>
## Specific Ideas

- **Port the mockup's behaviours, not its markup:** the live recount (`types · units · est. kg`), "Add box type" (focus + scroll the new row), per-box remove, and the **fragile→maxLoad** toggle (disable + zero on, restore on off) all come straight from `design/config.html`'s script — reimplement them in RHF.
- **Two visual edits vs the mockup are mandatory:** replace the 6 rotation chips with a **3-mode** control (C-03), and **remove the CoG-envelope field** (C-04). The mockup also has an "Allow overhang" switch — keep overhang as the numeric `maxOverhang` field; a separate boolean is optional (planner's call; not a requirement).
- **`maxLoad` + `fragile` are persisted/displayed but unsent in v1** — the single most important non-obvious decision (D-08). Do not add them to `BoxRequest`.
- **Box-fit hard-block is the riskiest rule** — keep it conservative (only reject the impossible), rotation-mode-aware, and pure/tested (D-01).
- **Refresh-safety is the headline feature** — auto-save + restore must work with zero user action; the explicit "Save draft" is a bonus, not the mechanism (D-07).

</specifics>

<deferred>
## Deferred Ideas

- **Standard pallet presets (EUR / GMA) picker** — **CFG-V2-01** (v2). REQUIREMENTS.md flags it "low cost; consider pulling into v1 during planning." Out of scope for the form's core decisions here; D-09 seeds a EUR-*shaped* default without a user-facing preset selector. Planner may revisit if cheap, but treat a preset *picker* as scope expansion.
- **Duplicate-a-box-type / CSV import-export** — **CFG-V2-02 / CFG-V2-03** (v2). Not this phase.
- **Share config via URL** — **SHR-V2-01** (v2, deferred until the schema is stable).
- **mm/in unit toggle** — permanently Out of Scope (API is mm/kg).
- **Sending `maxLoad` / `fragile` to the API** — pending Phase 5 OpenAPI confirmation (D-08); if the API accepts them, wire into the request-builder in Phase 5, not here.
- **Wiring Run to a real submit/poll/loading flow** — **Phase 5** (PACK-01/04/05/06). Phase 4 stops at `buildPackRequest` + console.

None of the above are scope creep into Phase 4 — they are correctly-placed later work.

</deferred>

---

*Phase: 4-Config Form & Local Persistence*
*Context gathered: 2026-06-04*
