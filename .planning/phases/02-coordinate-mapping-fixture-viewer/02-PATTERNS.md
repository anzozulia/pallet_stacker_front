# Phase 2: Coordinate Mapping & Fixture Viewer - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 11 (new/modified)
**Analogs found:** 8 with codebase analog / 11 total (3 are genuinely-new patterns — first real `src/lib/` content + first real drei usage)

This phase is mostly _new content_ in an established scaffold. The repo is greenfield past Phase 1: there is one trivial pure-ish component (`Hello.tsx`), one jsdom test (`Hello.test.tsx`), one empty r3f route (`ResultPage.tsx`), one Playwright smoke (`smoke.spec.ts`), and the config/scaffold seams. The analogs below give the _project conventions_ (file headers, import style, test wiring, code-split discipline) to copy; the _domain logic_ (mapping math, drei scene) is new and sourced from RESEARCH.md, not from any existing analog.

---

## File Classification

| New/Modified File                                                                                            | Role                        | Data Flow                      | Closest Analog                                                                                                        | Match Quality                                                 |
| ------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/lib/__fixtures__/pack-request.json`                                                                     | fixture (static asset)      | — (committed data)             | `.../captured-fixture/pack-request.json` (already captured)                                                           | exact — copy verbatim                                         |
| `src/lib/__fixtures__/pack-done-response.json`                                                               | fixture (static asset)      | — (committed data)             | `.../captured-fixture/pack-done-response.json` (already captured)                                                     | exact — copy verbatim                                         |
| `src/lib/mapping.ts`                                                                                         | utility (pure transform)    | transform                      | none (first real `src/lib/` content)                                                                                  | no analog — use RESEARCH Pattern 1                            |
| `src/lib/mapping.test.ts`                                                                                    | test (unit, jsdom)          | transform                      | `src/components/Hello.test.tsx`                                                                                       | role-match (test wiring), domain new (RESEARCH golden values) |
| `src/lib/palette.ts`                                                                                         | utility (pure)              | transform                      | none (first real `src/lib/` content)                                                                                  | no analog — use RESEARCH "Code Examples" palette              |
| `src/lib/palette.test.ts`                                                                                    | test (unit, jsdom)          | transform                      | `src/components/Hello.test.tsx`                                                                                       | role-match (wiring)                                           |
| `src/lib/camera-presets.ts` (optional, discretionary)                                                        | utility (pure bbox→vectors) | transform                      | none                                                                                                                  | no analog — RESEARCH Pattern 4                                |
| `src/routes/ResultPage.tsx`                                                                                  | route/component (r3f scene) | event-driven (render + camera) | `src/routes/ResultPage.tsx` (current empty body)                                                                      | exact shell, new body                                         |
| viewer subcomponents (`src/components/viewer/*` — Pallet, Boxes, Overlay, etc.; location is executor's call) | component (r3f/drei)        | render                         | `src/components/Hello.tsx` (only as file-header/export convention) + current `ResultPage.tsx` (r3f import discipline) | role-match (conventions), domain new (first drei usage)       |
| `src/styles.css`                                                                                             | config (Tailwind `@theme`)  | —                              | `src/styles.css` (existing `@theme` block)                                                                            | exact — extend in place                                       |
| `e2e/result-viewer.spec.ts`                                                                                  | test (e2e/Playwright)       | event-driven                   | `e2e/smoke.spec.ts`                                                                                                   | exact role + flow match                                       |

---

## Pattern Assignments

### `src/lib/__fixtures__/pack-request.json` + `pack-done-response.json` (fixture, committed data)

**Analog:** the already-captured pair at `.planning/phases/02-coordinate-mapping-fixture-viewer/captured-fixture/`.

**Action:** copy these two files verbatim into `src/lib/__fixtures__/` (RESEARCH "Recommended Project Structure", lines 145–158). They are the golden source for every test below. **Do not re-capture** — RESEARCH A4 confirms this is the richest of three captures (2 pallets, 7 unpacked, 3 types `T`/`D`/`F`, 3-cycle perm `[2,0,1]`).

**Verified golden anchors** (read directly from `pack-done-response.json`, pallet `P001`):

- pallet 0 dims: `{ L: 1000, W: 800, H: 1000 }`
- `T000`: `position {0,0,0}`, `dimensions {L:250,W:250,H:700}`, `perm [0,1,2]` — the non-rotated golden case.
- `D003`: `position {0,0,700}`, `dimensions {L:150,W:600,H:300}`, `perm [2,0,1] name HLW` — the **load-bearing rotated golden case**.
- pallet 0 carries only types `T` and `D` (the `F` cubes are on `P002`/unpacked) — RESEARCH Pitfall 5: derive the legend from the **whole-fixture** type set so 3 swatches show.

---

### `src/lib/mapping.ts` (utility, pure transform) — NO ANALOG (first real `src/lib/` content)

**No codebase analog exists.** `src/lib/` currently holds only `.gitkeep`. This is the inside-out architecture's first real `lib/` module (01-CONTEXT). Build it from RESEARCH.md, not from a copied file.

**Source of truth:** RESEARCH Pattern 1 (lines 160–206). The locked risk is _resolved_ — `position` = MIN CORNER, `dimensions` = POST-orientation, `perm` is NOT applied to geometry.

**Convention to copy from `src/routes/ResultPage.tsx` / `src/components/Hello.tsx`:** terse top-of-file comment explaining _why_ the module exists (every existing file has one), `export function`/`export interface` named exports (no default for utilities; defaults are reserved for route/page components as in `ResultPage.tsx` line 3 and `Hello.tsx` line 5).

**Code-split discipline (Pitfall 3, lines 303–307):** this file may import `three` only as `import type` (erased at build, won't bundle three into the entry chunk). Prefer plain `number[]`/tuples to avoid even type imports. `scripts/check-code-split.mjs` is the gate.

**Mapping (verified, RESEARCH lines 187–205):**

```typescript
size: [L, H, W],                 // API L→three x, H→three y, W→three z
center: [
  x + L / 2 - pallet.L / 2,      // x
  DECK_TOP_Y + z + H / 2,        // y (up)
  y + W / 2 - pallet.W / 2,      // z
];
// DECK_TOP_Y = 100 (blockH 78 + deckH 22); tunable.
```

**Dev-mode AABB assertion** (RESEARCH Pattern 5, lines 253–267): gate with `if (!import.meta.env.DEV) return;` so it tree-shakes from prod. `import.meta.env` is the Vite seam already used by the router's lazy split.

---

### `src/lib/mapping.test.ts` (test, unit/jsdom)

**Analog:** `src/components/Hello.test.tsx` — copy the _test wiring_, replace the _content_.

**Wiring to copy** (Hello.test.tsx lines 1–14):

- `import { describe, expect, it } from 'vitest';` (vitest globals are on, but explicit imports match the existing file).
- co-located next to the module under test.
- the jsdom-WebGL-free rule is load-bearing here (Hello.test.tsx lines 4–6 comment): **import only `mapping.ts`, never a Canvas.** jsdom has no WebGL.

**Content (new, from RESEARCH "Golden-value test", lines 353–376):** assert exact captured numbers —

```typescript
// T000 (non-rotated): size [250,700,250], center [-375, 450, -275]
// D003 (rotated, post-orientation dims): size [150,300,600], center [-425, 950, -100]
```

Plus the AABB-envelope property test over all pallet-0 placements (0 violations expected). RESEARCH "Test Map" (lines 433–440) names the `-t` filters: `"non-rotated"`, `"rotated"`, `"envelope"`.

---

### `src/lib/palette.ts` + `palette.test.ts` (utility + test) — NO ANALOG for the helper

**No codebase analog** for the palette helper. Source: RESEARCH "Code Examples" (lines 337–351) + UI-SPEC "Box-type colour palette" (lines 116–127).

- Seed `['#6d63f5', '#0ea5a3', '#e0892b']`; deterministic sorted-key assignment; `spinHue` for >3 types.
- Test wiring identical to `mapping.test.ts` (which copies `Hello.test.tsx`). Assert determinism (same input → same Map) and that the whole-fixture type set `{T,D,F}` maps to the three seeds in stable order.

---

### `src/lib/camera-presets.ts` (optional, discretionary) — NO ANALOG

Only if the executor extracts bbox→vector math as a pure helper (RESEARCH Pattern 4, lines 243–252; testable in jsdom). Otherwise this math lives inline in `ResultPage`. Pure-function + co-located-test convention same as `mapping.ts`.

---

### `src/routes/ResultPage.tsx` (route/component, r3f scene)

**Analog:** the **current** `src/routes/ResultPage.tsx` (its own shell) — keep the wrapper, replace the body.

**Shell to PRESERVE verbatim** (current file, lines 7–8):

```tsx
<div style={{ width: '100%', height: '100dvh' }}>
  <Canvas data-testid="r3f-canvas">
```

- The `100dvh` wrapper (the comment on lines 5–6 explains why: zero-height parent → 0×0 canvas).
- `data-testid="r3f-canvas"` — the Playwright smoke and `e2e/smoke.spec.ts` rely on a mounted `<canvas>`; keep the testid.
- `export default function ResultPage()` — default export, matches the lazy import in `src/router.tsx` line 7.

**Body to REPLACE** (current lines 9–10, the empty scene): build the drei scene from RESEARCH Pattern 3 (lines 216–241) + UI-SPEC scene/lighting/material constants table (lines 129–144). This is the **first real drei usage** — `<OrbitControls makeDefault enableDamping>`, `<Bounds fit clip observe>`, `<Edges>`, `<Grid>`, fog, lights, per-box `<mesh>`. No prior analog; props are RESEARCH-cited (A1: verify against pmndrs.github.io/drei).

**Code-split (Pitfall 3):** all three/r3f/drei imports MUST stay inside this lazy subtree. The router already isolates it (`src/router.tsx` lines 5–7, `lazy(() => import('@/routes/ResultPage'))`). Importing `mapping.ts`/`palette.ts` (pure, type-only three) here is safe.

---

### viewer subcomponents (`src/components/viewer/*` — discretionary location)

**Analog (conventions only):** `src/components/Hello.tsx` for the file-header + export convention; current `ResultPage.tsx` for r3f import discipline. **Domain is new** (first drei scene). RESEARCH "Recommended Project Structure" line 157 suggests `src/components/viewer/` (Pallet, Boxes, Overlay) but flags it discretionary. Each must keep three/r3f/drei imports inside this lazy subtree (never imported from `ConfigurePage` or `router.tsx` entry path).

**Overlay chrome** (header / legend / hints / ISO-TOP-FRONT buttons): UI-SPEC "Overlay Layout" (lines 184–193) + "Color"/"Typography" tables. RESEARCH Open Question 2 (lines 406–408) recommends plain absolute-positioned DOM over the Canvas (not drei `<Html>`) for screen-anchored chrome. Tailwind classes use the new `--color-d-*` tokens (below) and the existing `font-sans`/`font-mono` (`src/styles.css`).

---

### `src/styles.css` (config, Tailwind `@theme`)

**Analog:** `src/styles.css` itself — EXTEND the existing `@theme` block in place (do not duplicate `--font-sans`/`--font-mono`/`--color-accent`).

**Existing block** (lines 19–23):

```css
@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --color-accent: #4f46e5;
}
```

**Add the D-08 dark-overlay group** (UI-SPEC lines 55–65), ported verbatim from `design/result.html` `:root`:

```css
--color-d-bg: #0c0f17;
--color-d-border: #222838;
--color-d-text: #e6e8ee;
--color-d-text-2: #838b9e;
```

Scene material colours (wood, lights, grid, box palette) are NOT tokens — they live as module constants in the viewer (UI-SPEC line 67).

---

### `e2e/result-viewer.spec.ts` (test, Playwright e2e)

**Analog:** `e2e/smoke.spec.ts` — copy structure and the console-error pattern almost verbatim.

**Pattern to copy** (smoke.spec.ts lines 1–21):

- `import { test, expect } from '@playwright/test';`
- console-error collector registered BEFORE `page.goto` (lines 9–12).
- `await page.goto('/result');` then `await expect(page.locator('canvas')).toBeVisible();` (lines 14–17).
- assert zero `webgl|three` console errors (line 20).
- runs against the **preview build** webServer (`playwright.config.ts` lines 10–17), not dev server.

**New content (RESEARCH Test Map, lines 439–440):** add ≥1-box-mesh smoke + ISO/TOP/FRONT preset assertions — locate the three buttons (UI-SPEC copy `ISO`/`TOP`/`FRONT`, lines 173), click, assert the active-button `.on`/accent state toggles and/or canvas pixels change. The `-g presets` filter (RESEARCH line 440) implies grouping the preset test by name.

---

## Shared Patterns

### File-header convention

**Source:** every existing source file (`ResultPage.tsx` 5–6, `Hello.tsx` 1–4, `Hello.test.tsx` 4–6, `router.tsx` 5–6, `vitest.config.ts` 7–9).
**Apply to:** all new files. Each new module opens with a short comment stating _why it exists / what invariant it guards_ (not what each line does). This is a strong, consistent house style.

### Named vs default exports

**Source:** `ResultPage.tsx` (default for the route component) vs `router.tsx` (`export const router`).
**Apply to:** route/page components → `export default function`; pure utilities (`mapping`, `palette`, `camera-presets`) and their types → named exports.

### `@/` path alias in tests

**Source:** `Hello.test.tsx` line 7 (`import Hello from '@/components/Hello'`) + `vitest.config.ts` lines 2–9 (`tsconfigPaths()` re-registered so the alias resolves under Vitest).
**Apply to:** all new tests — import the module under test via `@/lib/...`. The seam already works; no config change needed.

### jsdom-WebGL-free testing split

**Source:** `Hello.test.tsx` lines 4–6 (comment) + `vitest.config.ts` line 18 (`exclude: ['e2e/**']`) + `playwright.config.ts` (preview-build webServer).
**Apply to:** mapping/palette correctness → Vitest (pure, no Canvas import). Canvas render + camera presets → Playwright only. jsdom has no WebGL (RESEARCH Pitfall 4).

### Code-split boundary

**Source:** `src/router.tsx` lines 5–7 (lazy `/result`) + `scripts/check-code-split.mjs` (build gate: three must be ABSENT from `index-*` entry chunk, PRESENT in a lazy chunk; markers `BufferGeometry`, `WebGLRenderer`).
**Apply to:** all three/r3f/drei usage stays inside the `ResultPage` lazy subtree. `mapping.ts`/`palette.ts` use `import type` (or no) three so they can be imported anywhere without leaking the engine. **Run `npm run build` then the check script as the phase gate** (RESEARCH "Sampling Rate", lines 442–445).

---

## No Analog Found

Files with no close codebase match — the planner/executor should use the cited RESEARCH/UI-SPEC sections, not a copied file:

| File                                                            | Role                     | Data Flow | Reason                                                                      | Use Instead                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------ | --------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/mapping.ts`                                            | utility (pure transform) | transform | First real `src/lib/` content; the coordinate-mapping math is domain-novel  | RESEARCH Pattern 1 (lines 160–206) + verified fixture numbers                                                                                                        |
| `src/lib/palette.ts`                                            | utility (pure)           | transform | First real `src/lib/` content; no existing palette logic                    | RESEARCH "Code Examples" (337–351) + UI-SPEC palette table (116–127)                                                                                                 |
| `src/lib/camera-presets.ts` (optional)                          | utility (pure)           | transform | No bbox/camera math exists                                                  | RESEARCH Pattern 4 (243–252)                                                                                                                                         |
| drei scene body of `ResultPage.tsx` + `src/components/viewer/*` | component (r3f/drei)     | render    | First real drei usage; current `ResultPage` is an empty single-light Canvas | RESEARCH Pattern 3 (216–241), UI-SPEC scene/light/material constants (129–144) & overlay layout (184–193), `design/result.html` lines ~286–352 as VISUAL intent only |

---

## Metadata

**Analog search scope:** `src/` (all), `e2e/`, `scripts/`, root configs (`vitest.config.ts`, `playwright.config.ts`, `tsconfig*`), `src/styles.css`, and the captured fixture dir.
**Files scanned:** 16 source/config files + the 2 captured fixture JSONs.
**Pattern extraction date:** 2026-06-03
**Key insight:** Phase 2 is _new domain code on a proven scaffold_. Copy project _conventions_ (headers, exports, test wiring, code-split, testid, `@theme`) from the Phase-1 analogs; source all _domain logic_ (mapping math, palette, drei scene) from the (HIGH-confidence, empirically-resolved) RESEARCH.md — the mockup `design/result.html` is visual intent only, NOT importable code, and its "box-centre" note is wrong for the real API.
