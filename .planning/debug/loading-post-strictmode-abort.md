---
status: resolved
trigger: "Dev-only infinite 'Packing your pallets… / Submitting…' hang: POST /api/v1/pack never fires under `npm run dev`, despite a primitive 10-box task."
created: 2026-06-05T00:00:00Z
updated: 2026-06-05T12:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: CONFIRMED. React StrictMode (dev-only) double-invokes LoadingPage's mount effect; the effect's cleanup aborts the in-flight POST's AbortController, and the once-only `firedRef` guard blocks the StrictMode remount from re-firing — so the sole POST is aborted before it leaves the browser and is never retried.
test: PASSED. The fix (cleanup also resets `firedRef`) makes the StrictMode remount re-fire a fresh, un-aborted POST → jobId set → poll runs → /result. Verified by a new isolated regression test, the full gate, and a live dev-browser probe against the real API.
expecting: (met) The flow reaches /result with a single completed POST and no console errors.
next_action: DONE — fix applied, regression test added, full gate green, live dev re-confirmed. Ready to commit.
reasoning_checkpoint: null
tdd_checkpoint: null

## Symptoms
<!-- Written during gathering, then immutable -->

expected: Clicking "Run packing" submits a job to the packing API and the loading screen advances to /result within a few seconds (a 10-box job solves in seconds).
actual: The "/loading" screen stays on "Packing your pallets…" with sub-line "Submitting…" indefinitely (>2 minutes observed). It never advances, never errors, never even hits the 120s safety-cap timeout card.
errors: None surfaced in the UI (no error card). The aborted POST classifies as 'aborted', which LoadingPage deliberately treats as a no-op (Pitfall 3) — so the failure is silent.
reproduction: `npm run dev` → open http://localhost:5173 → Configure (default config) → click "Run packing". Confirmed via a headless Playwright probe driving the same flow against the live dev server.
started: Present in the dev environment for this phase's build; surfaced now during manual local testing of the Phase 6 result page. The production build (Docker/nginx) is unaffected.

## Eliminated
<!-- APPEND only - prevents re-investigating after /clear -->

- hypothesis: The packing API or the Vite dev proxy is down/slow.
  evidence: Direct curl through the proxy (http://localhost:5173/api/v1/pack) returns HTTP 202 in ~0.13s; polling GET /api/v1/jobs/{id} reaches `done` within seconds; the live `done` body passes the app's zod contract (8/8 checks). API + proxy are healthy.
  timestamp: 2026-06-05T00:00:00Z

- hypothesis: The poll hook (usePollJob) mishandles the real `queued → running → done` status sequence (e.g. stops on `running`).
  evidence: usePollJob's `isTerminal` set is {done,failed,timeout}; `refetchInterval` returns POLL_INTERVAL_MS for non-terminal (incl. `running`). The e2e happy-path stub emits queued→running→done and passes. The hang occurs BEFORE any poll — jobId is never set because the POST never completes.
  timestamp: 2026-06-05T00:00:00Z

- hypothesis: The bug is environment-agnostic (also breaks production / the e2e should have caught it).
  evidence: playwright.config.ts runs the e2e against a PRODUCTION build (`npm run build && npm run preview`), where React StrictMode does NOT double-invoke effects → the POST fires once and the happy-path passes. The defect is specific to dev-mode StrictMode double-invocation.
  timestamp: 2026-06-05T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered during investigation -->

- timestamp: 2026-06-05T00:00:00Z
  checked: Playwright probe of the live dev flow (Configure→Run→/loading), logging all /api requests + console + sub-line.
  found: Navigates to /loading; sub-line stuck "Submitting…" for 35s+; ZERO `POST /api/v1/pack` requests in the network log (only module GETs).
  implication: The submit mutation never reaches the network → submit.data.job_id is never set → poll never starts → infinite "Submitting…".

- timestamp: 2026-06-05T00:00:00Z
  checked: src/main.tsx
  found: App is wrapped in `<StrictMode>` (line 10).
  implication: In dev, React intentionally double-invokes effects (mount → cleanup → mount) to surface unsafe effects.

- timestamp: 2026-06-05T00:00:00Z
  checked: src/routes/LoadingPage.tsx mount effect (lines ~107-115) + fireSubmit (97-105) + firedRef (90) + controllerRef (83).
  found: Effect [deps: valid] sets `firedRef.current = true` then `fireSubmit()` (mints AbortController A, `submit.mutate({request, signal: A})`); cleanup `return () => controllerRef.current?.abort()`. StrictMode: mount① fires POST (A) → cleanup aborts A synchronously (before the fetch dispatches) → mount② sees `firedRef.current === true` → early-returns → POST never re-fired.
  implication: The `firedRef` guard prevents the re-fire while the cleanup aborts the only attempt — the two combine to permanently kill the POST. Root cause confirmed.

- timestamp: 2026-06-05T00:00:00Z
  checked: usePollJob safety cap (POLL_SAFETY_CAP_MS = 120000) arming condition.
  found: The wall-clock cap only arms once `jobId` is truthy; jobId never becomes truthy here.
  implication: Not even the timeout card ever shows — the hang is truly unbounded, matching the ">2 minutes" report.

- timestamp: 2026-06-05T12:00:00Z
  checked: Applied the fix (cleanup resets `firedRef`), added an isolated StrictMode regression test (src/routes/LoadingPage.strictmode.test.tsx), ran the full gate, and ran a live-dev Playwright probe against the running dev server (real /api proxy).
  found: Regression test RED on the unfixed cleanup (mutate fires once → never reaches /result) and GREEN with the fix (mutate fires twice — the second un-aborted → /result). Full gate green: vitest 184/184, typecheck clean, lint 0 errors, build OK, code-split gate PASSED (LoadingPage three-free), e2e 14/14. Live dev probe: POST /api/v1/pack fired (count=1), URL reached http://localhost:5173/result, 0 console errors.
  implication: Root cause and fix verified end-to-end. The bug is genuinely invisible to the production-build e2e and required the StrictMode-as-root + abort-aware stub harness to reproduce in jsdom (RTL only replays the effect double-invoke when <StrictMode> is the top-level render container).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Dev-only React StrictMode double-invocation of LoadingPage's submit-on-mount effect. The effect's cleanup aborts the in-flight POST's AbortController (controllerRef), and the once-only `firedRef` guard blocks the StrictMode remount from re-firing. Net: the sole POST /api/v1/pack is aborted before it leaves the browser and is never retried, so jobId is never set, the poll never starts, and the loading screen spins forever on "Submitting…". Masked from the e2e because playwright.config.ts runs a production build (no StrictMode effect double-invoke).
fix: In src/routes/LoadingPage.tsx the submit-on-mount effect cleanup now ALSO resets the once-per-lifecycle guard — `return () => { controllerRef.current?.abort(); firedRef.current = false; }`. On a StrictMode dev remount this lets mount② re-fire a fresh, un-aborted POST (the one the cleanup just aborted); on a real unmount the reset is moot (the instance is gone) so the SC-3 / Cancel abort-on-unmount behavior is preserved. The guard is kept (it still suppresses a same-instance re-render double-fire); only its cleanup-reset was missing.
verification: VERIFIED. Full gate green — vitest 184/184 (incl. the new regression test), `tsc -b --noEmit` clean, eslint 0 errors, `tsc -b && vite build` OK, `scripts/check-code-split.mjs` PASSED (LoadingPage stays three-free in the eager chunk), playwright e2e 14/14. The new regression test (src/routes/LoadingPage.strictmode.test.tsx) is RED against the unfixed cleanup and GREEN with the fix; it asserts the StrictMode remount re-fires an un-aborted submit and the flow reaches /result — something the production-build e2e cannot catch. Live dev-browser probe against the real API confirmed POST /api/v1/pack fires and the flow reaches /result with no console errors.
files_changed:
  - src/routes/LoadingPage.tsx (fix: cleanup resets firedRef)
  - src/routes/LoadingPage.strictmode.test.tsx (new StrictMode regression test)
