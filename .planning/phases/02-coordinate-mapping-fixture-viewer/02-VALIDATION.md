---
phase: 2
slug: coordinate-mapping-fixture-viewer
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-03
reconciled: 2026-06-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 02-RESEARCH.md § Validation Architecture (locked risk resolved empirically against the live API).

---

## Test Infrastructure

| Property               | Value                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | vitest `4.1.8` (jsdom env) + @testing-library/react `16.3.2`; @playwright/test `1.60.0` for the WebGL Canvas smoke |
| **Config file**        | `vitest.config.ts` + `playwright.config.ts` (both from Phase 1 — already present; no install needed)               |
| **Quick run command**  | `npx vitest run src/lib/`                                                                                          |
| **Full suite command** | `npm test` (vitest) then `npm run test:e2e` (Playwright preview-build)                                             |
| **Estimated runtime**  | ~1s for `src/lib/` unit goldens; ~30–45s for the Playwright preview-build smoke                                    |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/` (mapping + palette goldens — sub-second)
- **After every plan wave:** Run `npm test` then `npm run test:e2e`
- **Before `/gsd-verify-work`:** Full suite green AND `node scripts/check-code-split.mjs` passes (three/r3f/drei stay in the lazy `/result` chunk)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs reconciled against the finalized plans (02-01-PLAN.md, 02-02-PLAN.md). Every auto task carries an `<automated>` verify; the human-verify checkpoint (02-02-04) is intentionally manual (see Manual-Only Verifications).

| Task ID  | Plan | Wave | Requirement          | Threat Ref | Secure Behavior                             | Test Type  | Automated Command                                                                                                                                                                      | File Exists          | Status     |
| -------- | ---- | ---- | -------------------- | ---------- | ------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------- |
| 02-01-01 | 01   | 1    | RESULT-01            | T-02-01    | committed trusted fixture, no runtime input | data       | `node -e "...require('src/lib/__fixtures__/pack-done-response.json'); status==='done' && 2 pallets && 7 unpacked && perm [2,0,1] present"`                                             | ❌ → created in task | ⬜ pending |
| 02-01-02 | 01   | 1    | RESULT-01            | —          | N/A (pure fn)                               | unit       | `npx vitest run src/lib/mapping.test.ts` (`-t "non-rotated"`, `-t "rotated"` load-bearing post-orientation/perm-not-reapplied, `-t "envelope"` AABB invariant over all pallet-0 items) | ❌ → created in task | ⬜ pending |
| 02-01-03 | 01   | 1    | RESULT-01            | —          | N/A (pure fn)                               | unit       | `npx vitest run src/lib/palette.test.ts` (deterministic colour-by-type; whole-fixture set {D,F,T})                                                                                     | ❌ → created in task | ⬜ pending |
| 02-02-01 | 02   | 2    | RESULT-01, RESULT-02 | —          | N/A (pure math + CSS tokens)                | unit       | `npx vitest run src/lib/camera-presets.test.ts` (ISO/TOP/FRONT computed from scene bbox)                                                                                               | ❌ → created in task | ⬜ pending |
| 02-02-02 | 02   | 2    | RESULT-01            | —          | N/A (client render)                         | build/gate | `npm run build && node scripts/check-code-split.mjs` (three/r3f/drei stay in lazy /result chunk)                                                                                       | ❌ → created in task | ⬜ pending |
| 02-02-03 | 02   | 2    | RESULT-01, RESULT-02 | —          | N/A                                         | e2e        | `npx playwright test e2e/result-viewer.spec.ts` (Canvas mounts + ≥1 box mesh, no WebGL errors; `-g presets` → ISO/TOP/FRONT change camera / button `.on` toggles)                      | ❌ → created in task | ⬜ pending |
| 02-02-04 | 02   | 2    | RESULT-01, RESULT-02 | —          | N/A                                         | manual     | human visual + camera-feel sign-off (blocking checkpoint — see Manual-Only Verifications)                                                                                              | —                    | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · "created in task" = the task that first authors the test/fixture also runs its verify_

---

## Wave 0 Requirements

**No separate Wave 0 bootstrap is needed for this phase** — the test frameworks (vitest 4.1.8 + @playwright/test 1.60.0) were installed and configured in Phase 1, and feedback sampling works from the first task. Each test file below is authored _inside_ the feature task that implements it (tdd-style co-location), so there is no test-infra gap to fill before feature work begins. `wave_0_complete: true` reflects this (framework present; no install/stub prerequisite outstanding).

Test artifacts produced within the plan waves (not a pre-wave):

- `src/lib/__fixtures__/pack-{request,done-response}.json` — committed golden pair (copied verbatim from research capture) — task 02-01-01
- `src/lib/mapping.test.ts` — non-rotated + rotated goldens + AABB invariant (RESULT-01) — task 02-01-02
- `src/lib/palette.test.ts` — deterministic colour-by-type (RESULT-01) — task 02-01-03
- `src/lib/camera-presets.test.ts` — ISO/TOP/FRONT bbox math (RESULT-02) — task 02-02-01
- `e2e/result-viewer.spec.ts` — Canvas mount + ISO/TOP/FRONT presets (RESULT-01/02) — task 02-02-03

---

## Manual-Only Verifications

| Behavior                                                                                                                                        | Requirement      | Why Manual                                                                                                                                                                                                                            | Test Instructions                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static viewer _visually matches_ `design/result.html` (pallet model, lighting, shadows, fog, edge-lines, legend placement, dark overlay header) | RESULT-01 (SC-3) | Pixel-faithful visual fidelity to a mockup is subjective; jsdom has no WebGL and pixel-diff against a hand-authored HTML mockup is brittle. The Playwright smoke proves the Canvas renders; "matches the mockup" is a human judgment. | Run `npm run preview`, open `/result`, compare side-by-side with `design/result.html`: coloured boxes on a wood pallet, top-right legend (swatch + type), dark overlay header with dims tag + control hints, soft shadows + grid + fog. |
| ISO/TOP/FRONT presets _visibly_ reframe (TOP looks straight down, FRONT looks along an axis) with smooth animated transitions                   | RESULT-02        | Camera "feel" (easing, framing composition) is qualitative; the e2e asserts the camera changed, not that it feels right.                                                                                                              | In `/result`, click each preset; confirm TOP is a plan view, FRONT is an elevation, ISO is 3/4, and transitions animate (damping on).                                                                                                   |

---

## Validation Sign-Off

- [x] All auto tasks have `<automated>` verify (02-01-01..03, 02-02-01..03); 02-02-04 is an intentional human-verify checkpoint
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No separate Wave 0 — frameworks installed in Phase 1; tests co-authored in feature tasks (no MISSING references outstanding)
- [x] No watch-mode flags (CI-safe `vitest run` / `playwright test` / `playwright test -g`)
- [x] Feedback latency < 60s (sub-second `src/lib/` unit run per commit)
- [x] `nyquist_compliant: true` set in frontmatter (Task IDs reconciled to the finalized plans)

**Approval:** approved 2026-06-03 (reconciled against 02-01-PLAN.md + 02-02-PLAN.md)
