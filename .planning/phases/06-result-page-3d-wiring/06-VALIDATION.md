---
phase: 6
slug: result-page-3d-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (jsdom ^26) for pure/DOM logic · @playwright/test 1.60.0 for the rendered canvas |
| **Config file** | `vite.config.ts` (vitest config) · `playwright.config.ts` — existing, no Wave 0 install needed |
| **Quick run command** | `npm test` (`vitest run`) |
| **Full suite command** | `npm test && npm run test:e2e` |
| **Estimated runtime** | unit ~5–15s · e2e (preview build + route-intercepted `done`) ~30–60s |

**Reference dataset:** the real captured `src/lib/__fixtures__/pack-done-response.json` (2 pallets — P001=19 boxes, P002=12 boxes; 7 unpacked; types D/F/T; ≥1 rotated). **Caveat from research:** every fixture `support_ratio` is exactly `1.0`, so the support-ratio bucketing golden test MUST use synthetic ratios (`[1.0, 0.8, 0.5, 0.2, 0]`) — the captured corpus only exercises the top bucket.

---

## Sampling Rate

- **After every task commit:** Run `npm test` (jsdom unit/DOM suite — sub-15s feedback)
- **After every plan wave:** Run `npm test && npm run test:e2e`
- **Before `/gsd-verify-work`:** Full suite (unit + e2e) green, plus `npm run typecheck` and `npm run build` (code-split gate via `scripts/check-code-split.mjs`)
- **Max feedback latency:** ~15 seconds (unit) / ~60 seconds (full)

---

## Per-Task Verification Map

> Populated against real task IDs once PLAN.md files exist (see `/gsd-validate-phase`).
> The pure derivations below are golden/unit testable in jsdom; the rendered scene
> (CoG marker, heatmap, hover emissive) is verified via Playwright route-interception.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RESULT-03 (summary aggregation) | — | N/A | unit (jsdom) | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RESULT-04 (per-pallet switch + stats) | — | N/A | unit + e2e | `npm test` / `npm run test:e2e` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RESULT-05 (placement hover→mesh) | — | N/A | e2e (Playwright) | `npm run test:e2e` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RESULT-06 (unpacked panel, conditional) | — | N/A | unit + e2e | `npm test` / `npm run test:e2e` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DIAG-01 (CoG point-map, golden `cog.z` up-axis) | — | N/A | unit (golden) + e2e | `npm test` / `npm run test:e2e` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DIAG-02 (support-ratio surface + heatmap bucketing) | — | N/A | unit (synthetic ratios) + e2e | `npm test` / `npm run test:e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Golden test for the new CoG point-map (`src/lib/`) — assert against the fixture's reported `cog` for both pallets (up-axis = `cog.z`, no half-dimension term).
- [ ] Unit test for summary aggregation + per-pallet stats (`src/lib/`) — whole-job vs per-pallet scopes (D-03).
- [ ] Unit test for support-ratio bucketing/colour-scale (`src/lib/`) — **synthetic** ratios, not the all-1.0 fixture.
- [ ] Playwright spec scaffolding for the route-intercepted `done` flow (configure → run → `/result`), asserting persistent canvas, pallet switch keeps camera (D-02), hover→mesh emissive, CoG marker visible.

*Existing vitest + Playwright infrastructure covers the framework — Wave 0 adds the per-derivation test files, no framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual fidelity of rail vs `design/result.html` + `06-UI-SPEC.md` | RESULT-03/04/06 | Subjective visual match beyond DOM assertions | Build preview, compare rail blocks (Summary 2×2, switcher rows, placement cards, unpacked panel) against the mockup + UI-SPEC |
| Heatmap colour legibility (support gradient) | DIAG-02 | Colour perception is subjective | Toggle heatmap on a real captured pallet; confirm well-supported→low-support reads correctly |

*Most phase behaviors have automated verification; the two above are visual-judgment items.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
