---
phase: 4
slug: config-form-local-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 04-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.8` (jsdom) + @testing-library/react `16.3.2` + @testing-library/user-event `14.6.1`; Playwright `1.60.0` for E2E |
| **Config file** | `vitest.config.ts` (jsdom, globals, `setupFiles: ./src/test/setup.ts`, `tsconfigPaths()`); Playwright config for E2E |
| **Quick run command** | `npx vitest run src/lib/<file>.test.ts` (single file) |
| **Full suite command** | `npm run test` (= `vitest run`) |
| **Estimated runtime** | ~5–15 seconds (unit + component); E2E adds ~20s |

---

## Sampling Rate

- **After every task commit:** Run the single pure-lib test for the unit just changed — `npx vitest run src/lib/<file>.test.ts`
- **After every plan wave:** Run `npm run test` (full Vitest) + `npm run typecheck`
- **Before `/gsd-verify-work`:** Full Vitest + `npm run build` (proves the three-out-of-eager-chunk code-split gate stays green) + the new Playwright restore-after-reload spec — all green
- **Max feedback latency:** ~15 seconds (unit/component)

---

## Per-Task Verification Map

> Requirement-level seed. Task IDs (`4-NN-NN`) are filled in by the planner/executor against the final PLAN.md waves.

| Req ID | Plan | Wave | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|------|------|----------|------------|-----------|-------------------|-------------|--------|
| BOX-06 / D-01 | TBD | 1 | box-fits-pallet conservative check (all rotation modes, overhang, height) | — | unit (pure) | `npx vitest run src/lib/box-fit.test.ts` | ❌ W0 | ⬜ pending |
| BOX-05 / D-03 | TBD | 1 | tally types/units/estKg + >1000 warning + NaN-safe | — | unit (pure) | `npx vitest run src/lib/config-tally.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 / D-07 | TBD | 1 | serialize/deserialize guard: valid restores; bad/version-mismatch → defaults | T-4-PERSIST | unit (pure) | `npx vitest run src/lib/config-persist.test.ts` | ❌ W0 | ⬜ pending |
| BOX-01 | TBD | 2 | add/remove box type updates the list | — | component | `npx vitest run src/features/config/BoxCatalogCard.test.tsx` | ❌ W0 | ⬜ pending |
| BOX-03 / D-08 | TBD | 2 | fragile ON disables+zeroes maxLoad; OFF restores | — | component | `npx vitest run src/features/config/BoxRow.test.tsx` | ❌ W0 | ⬜ pending |
| BOX-04 | TBD | 2 | rotation control sets one of 3 modes | — | component | `npx vitest run src/features/config/BoxRow.test.tsx` | ❌ W0 | ⬜ pending |
| BOX-06 / D-02,04 | TBD | 2 | invalid input shows error on Run, blocks; valid logs request | — | component | `npx vitest run src/features/config/ConfigForm.test.tsx` | ❌ W0 | ⬜ pending |
| PALLET-01/02, PACK-03 | TBD | 2 | pallet + maxPallets fields bind and validate | — | component | `npx vitest run src/features/config/ConfigForm.test.tsx` | ❌ W0 | ⬜ pending |
| DATA-02 (SC-5) | TBD | 3 | type partial → reload → draft restored intact | — | E2E | `npm run test:e2e` (new spec) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/box-fit.test.ts` — covers BOX-06/D-01 (exact-fit, overhang-edge, too-tall-rotatable, 2000mm-typo golden cases)
- [ ] `src/lib/config-tally.test.ts` — covers BOX-05/D-03 (counts, >1000 threshold, NaN-safety)
- [ ] `src/lib/config-persist.test.ts` — covers DATA-02/D-07 (round-trip, null, unparseable, version mismatch, shape-guard fail → defaults)
- [ ] `src/features/config/*.test.tsx` — component tests (add/remove, fragile toggle, rotation, validation-blocks-Run)
- [ ] `e2e/config-persist.spec.ts` — Playwright partial-draft → reload → restored intact
- [ ] No new framework install — Vitest / @testing-library / Playwright are present (`src/test/setup.ts` already wires jest-dom)
- [ ] jsdom provides `localStorage`; persist tests pass a raw string to the pure deserializer (no `window` mocking needed by design)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual fidelity of ported config-form chrome vs `design/config.html` | D-05 | Pixel/visual judgement not unit-assertable | Run `npm run dev`, open `/`, compare topbar/cards/sticky-footer layout against the mockup |
| "Saved ✓" confirmation feel + debounce timing | D-07 | UX timing/feedback judgement | Edit a field, observe auto-save (~400ms) and the explicit Save-draft confirmation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
