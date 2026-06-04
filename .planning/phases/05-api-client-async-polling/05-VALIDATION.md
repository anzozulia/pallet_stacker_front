---
phase: 5
slug: api-client-async-polling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` → "Validation Architecture". All four phase
> requirements are testable deterministically with MSW (jsdom hooks) +
> Playwright `route` interception (preview build) — never the live API.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `4.1.8` (jsdom) + @testing-library/react `16.3.2`; @playwright/test `1.60.0` (e2e) |
| **Config file** | `vitest.config.ts` (setupFiles: `./src/test/setup.ts`); `e2e/**` excluded from vitest |
| **Quick run command** | `npm run test` (vitest, jsdom) |
| **Full suite command** | `npm run test` then `npm run build && npm run preview` Playwright e2e (existing webServer pattern) |
| **Estimated runtime** | ~15–40 seconds (vitest quick); e2e adds preview-build time |

---

## Sampling Rate

- **After every task commit:** Run `npm run test` (vitest quick run, jsdom)
- **After every plan wave:** Run `npm run test` then `npm run build && node scripts/check-code-split.mjs` (code-split gate)
- **Before `/gsd-verify-work`:** Full vitest + Playwright e2e must be green
- **Max feedback latency:** ~40 seconds (vitest quick run)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; this map is keyed by requirement +
> behavior from the research Requirements→Test map and will be reconciled to
> concrete `5-NN-MM` task IDs once PLAN.md files exist.

| Plan (expected) | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----------------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| api-client | 1 | PACK-01 | — | Valid config → POST `/pack` → `202 { job_id }`; submit hook returns job_id | unit (MSW) | `npm run test -- src/api/useSubmitJob.test.tsx` | ❌ W0 | ⬜ pending |
| api-client | 1 | PACK-04 | V5 input-val | zod boundary: malformed `JobState` → handled error, not crash | unit | `npm run test -- src/api/pack-schema.test.ts` | ❌ W0 | ⬜ pending |
| poll-hook | 2 | PACK-04 | — | Poll `/jobs/{id}` until terminal; `refetchInterval` stops on `done`; honest status sub-line | unit (MSW) | `npm run test -- src/api/usePollJob.test.tsx` | ❌ W0 | ⬜ pending |
| loading-route | 2 | PACK-05 | resource-leak | Cancel/unmount aborts in-flight + stops poll; no leaked interval/request | unit (MSW) + e2e | `npm run test -- src/routes/LoadingPage.test.tsx` | ❌ W0 | ⬜ pending |
| loading-route | 2 | PACK-06 | tamper/DoS | `failed` / `timeout` / unreachable-CORS / unpacked>0 each distinguished; none crash | unit (MSW) + e2e | `npm run test -- src/routes/LoadingPage.test.tsx` | ❌ W0 | ⬜ pending |
| e2e-flow | 3 | PACK-06 | — | full Configure→loading→result + each error path | e2e (Playwright `route`) | `e2e/api-poll.spec.ts` | ❌ W0 | ⬜ pending |
| code-split-gate | — | C-06 | — | `/loading` + `src/api/` stay three-free | build gate | `node scripts/check-code-split.mjs` (after `npm run build`) | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D msw@2.14.6` — test transport stub (behind the `T-5-SC` supply-chain checkpoint; note benign `postinstall`)
- [ ] `src/test/msw/handlers.ts` — POST 202 + GET poll-sequence stubs: `queued→running→done`, `→failed`, `→timeout`, network-throw
- [ ] `src/test/msw/server.ts` — `setupServer` from `msw/node`
- [ ] Extend `src/test/setup.ts` with MSW `listen / resetHandlers / close` lifecycle (`onUnhandledRequest: 'error'`)
- [ ] `renderWithClient` helper — fresh `QueryClient` per test (`retry: false`, `gcTime: 0` for tests); the standard RTL + react-query isolation gotcha
- [ ] `src/api/useSubmitJob.test.tsx`, `src/api/usePollJob.test.tsx`, `src/api/pack-schema.test.ts`, `src/routes/LoadingPage.test.tsx`
- [ ] `e2e/api-poll.spec.ts` using Playwright `page.route('**/api/v1/**', ...)` to stub the poll sequence deterministically (mirror existing `e2e/config-persist.spec.ts` style)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real live-API submit→poll→done against `packerapi.anzozulia.xyz` via the `/api` dev proxy | PACK-01/04 | CI must stay deterministic and offline (CLAUDE.md: never the live service in CI); a real end-to-end smoke is human-run | `npm run dev`, fill a valid config, click Run, watch `/loading` advance `queued→running→done` and land on `/result` |
| Visual fidelity of the loading screen vs `design/loading.html` (comet spinner, summary card) | PACK-04 | Visual judgment | Compare `/loading` render to `design/loading.html`; confirm honest status sub-line (no fake %) and Cancel control present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (MSW install + handlers + setup wiring + test wrapper)
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
