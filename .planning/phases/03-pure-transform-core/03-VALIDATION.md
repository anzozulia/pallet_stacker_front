---
phase: 3
slug: pure-transform-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 03-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.8` (jsdom env, globals on) |
| **Config file** | `vitest.config.ts` (registers `react()` + `tsconfigPaths()`; `setupFiles: ./src/test/setup.ts`) — already present |
| **Quick run command** | `npm run test -- src/lib/request-builder.test.ts src/lib/result-mapper.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds (two co-located files); full suite a few seconds more |
| **Purity gate** | `npm run build && node scripts/check-code-split.mjs` (proves SC-4 zero React/IO/runtime-three) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/lib/request-builder.test.ts src/lib/result-mapper.test.ts`
- **After every plan wave:** Run `npm run test` (full suite — includes existing mapping/palette/camera-preset tests to catch grouping-key regressions)
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` + `node scripts/check-code-split.mjs` green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Task IDs are filled in once PLAN.md files exist (populated during/after planning by the nyquist auditor). Requirement→behavior coverage below is the contract those tasks must satisfy.

| Req / SC | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| PACK-02 | Each box type's `quantity` expands into exactly N individual boxes with unique ids | unit | `npm run test -- src/lib/request-builder.test.ts -t "expands quantity"` | ❌ W0 | ⬜ pending |
| PACK-02 | IDs unique across the whole request (no cross-type collisions) | unit | `… -t "ids are unique"` | ❌ W0 | ⬜ pending |
| PACK-02 | IDs deterministic across repeated builds (stable) | unit | `… -t "deterministic across rebuilds"` | ❌ W0 | ⬜ pending |
| PACK-02 / SC-1 | `idToType` map recovers every item's type in O(1); fixture-id round-trip via `typeKeyOf` fallback yields D/T/F | unit | `npm run test -- src/lib/result-mapper.test.ts -t "round-trip"` | ❌ W0 | ⬜ pending |
| BOX-04 / SC-2 | Each of the 3 domain modes maps to exactly one distinct API string (`all`/`this_side_up`/`none`); table is total | unit | `npm run test -- src/lib/request-builder.test.ts -t "rotation"` | ❌ W0 | ⬜ pending |
| SC-3 | Mapper groups by type AND by pallet; exposes per-pallet `cog` + per-box `support_ratio` raw | unit | `npm run test -- src/lib/result-mapper.test.ts -t "groups by type and pallet"` | ❌ W0 | ⬜ pending |
| SC-3 | Multi-pallet (2) + 7 unpacked items surfaced correctly | unit | `… -t "multi-pallet"` / `-t "unpacked"` | ❌ W0 | ⬜ pending |
| SC-4 | Transform modules import zero React/IO/runtime-three | static | `npm run build && node scripts/check-code-split.mjs` | partial (gate exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/request-builder.test.ts` — PACK-02 (expansion / uniqueness / determinism), BOX-04 (rotation table), builder-output-shape vs `__fixtures__/pack-request.json`
- [ ] `src/lib/result-mapper.test.ts` — SC-1 round-trip, SC-3 dual grouping + raw diagnostics, multi-pallet + unpacked
- [ ] No new framework install or shared fixtures required — existing `vitest.config.ts` + `__fixtures__/*.json` cover everything

*Corpus: the paired captured fixtures (`pack-request.json`, `pack-done-response.json` — 2 pallets, 31 packed [D=11/F=8/T=12], 7 unpacked, 3 types, all 3 rotation modes) plus one small synthetic `PackConfig` for builder expansion/determinism/rotation tests that does NOT rely on single-letter prefixes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (pure functions against committed fixtures).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
