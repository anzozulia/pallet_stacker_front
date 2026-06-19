---
phase: 8
slug: assembly-insight-layer-explode-isolation-in-the-3d-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `08-RESEARCH.md` → "Validation Architecture". Task IDs marked `TBD` are filled in once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `4.1.8` (+ @testing-library/react 16, jsdom ~26) |
| **Config file** | `vite.config.ts` (Vitest shares the Vite transform; `@/` alias proven in existing tests) |
| **Quick run command** | `npx vitest run src/lib/computeLayers.test.ts` |
| **Full suite command** | `npx vitest run` (or `npm test`) |
| **Build / code-split gate** | `npm run build && node scripts/check-code-split.mjs` (three must stay out of `index-*.js`) |
| **E2E** | `npx playwright test` (route-intercepted `done` response — never live API) |
| **Estimated runtime** | ~10s unit; build+gate ~20s; Playwright ~30–60s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/computeLayers.test.ts` (+ tests for any touched module).
- **After every plan wave:** Run `npx vitest run` (full unit suite) AND `npm run build && node scripts/check-code-split.mjs`.
- **Before `/gsd-verify-work`:** Full unit suite + Playwright green; code-split gate green.
- **Max feedback latency:** ~10 seconds (unit quick-run).

---

## Per-Task Verification Map

> Task IDs are `TBD` until plans are created. Requirement IDs use the recommended phase requirement **RESULT-07** (mapping all 5 success criteria); see `08-RESEARCH.md` requirement-mapping recommendation. Rows below are the contract the planner MUST satisfy.

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | RESULT-07 (SC-1) | N/A | unit | `npx vitest run src/lib/computeLayers.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RESULT-07 (SC-1) banding/order/membership | N/A | unit | `npx vitest run src/lib/computeLayers.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RESULT-07 (SC-1) single / uneven / tall-floating | N/A | unit | `npx vitest run src/lib/computeLayers.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RESULT-07 (SC-1) no-three / code-split | N/A | build gate | `npm run build && node scripts/check-code-split.mjs` | ✅ exists | ⬜ pending |
| TBD | TBD | 1 | RESULT-07 (D-05) `inflateBboxForExplode` | N/A | unit | `npx vitest run src/lib/camera-presets.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RESULT-07 (SC-2) explode 0=assembled, >0 gaps, CoG/deck sane | N/A | e2e | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RESULT-07 (SC-3) default byte-identical to assembled | N/A | e2e pixel | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RESULT-07 (SC-4) composes w/ presets, CoG/heatmap, switcher, hover, isolate | N/A | e2e | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RESULT-07 (D-05) camera unchanged on pallet switch | N/A | e2e | `npx playwright test` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RESULT-07 (SC-5) interactive frame rate, multi-layer presets | N/A | manual / e2e smoke | `npx playwright test` (render assert) | manual-justified | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### `computeLayers` unit-test acceptance contract (SC-1)

The `computeLayers.test.ts` must assert (verbatim from `08-RESEARCH.md`):
1. **Layer count & order** — P001 → 2 layers `[baseZ 0, 700]`; P002 → 4 layers `[0,150,350,700]`, ordered floor-up (`layers[i].index === i`, ascending `baseZ`).
2. **Membership by base** — every item's `position.z` within `tolerance` of its layer `baseZ`; H=350 box at z=0 → layer 0 (not layer 2).
3. **Single-layer case** — all items at `z=0` → exactly 1 layer; drives Layers slider max=1 / disabled state.
4. **Uneven-height case** — mixed H in one base band (P002 z=0: H=350 & H=150) → still ONE layer; `topZ` = max top.
5. **Floating/relative case** — lone box at z=150 → its OWN layer (>tolerance gap starts a band).
6. **item→layer map completeness** — `itemToLayer.size === items.length`; every `item_id` → valid layer index.
7. **Golden literals** — assert hand-computed expected arrays (codebase convention: `cog-map.test.ts`/`result-summary.test.ts`), NOT values re-derived from the formula.
8. **No three import** — runs under jsdom with no Canvas; reinforced by the build gate.

---

## Wave 0 Requirements

- [ ] `src/lib/computeLayers.test.ts` — stubs/tests for SC-1 (assertions 1–8 above)
- [ ] `src/lib/camera-presets.test.ts` — golden cases for `inflateBboxForExplode` (D-05 pure helper)
- [ ] Playwright spec for explode / isolate / compose paths (route-intercepted `done`) — SC-2/3/4 + D-05 camera-unchanged-on-switch
- [ ] (Optional — RESEARCH Open Q3) capture a multi-layer demo-preset `done` response as a second fixture for richer banding confirmation

*vitest + Playwright infrastructure already exist; Wave 0 adds the new spec files above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Interactive frame rate while exploding/isolating on dense multi-layer presets | RESULT-07 (SC-5) | True FPS/perceptual smoothness can't be asserted reliably in jsdom/headless; Playwright can only smoke-assert a render | Load a demo preset → drag Explode 0→max and scrub the Layers control → confirm no visible stutter at interactive rates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
