---
phase: 05-api-client-async-polling
plan: 01
subsystem: api
tags: [zod, react-query, msw, fetch, abortsignal, contract-validation, testing]

# Dependency graph
requires:
  - phase: 03-pure-transform-core
    provides: src/types/pack-contract.ts (PackRequest, DoneResponse contract types)
  - phase: 04-config-form
    provides: src/features/config/schema.ts (the existing zod conventions mirrored here)
provides:
  - "zod network-boundary schemas (jobStateSchema/jobAcceptedSchema/errorBodySchema/jobStatusSchema) tightening status to the closed union, non-strict for forward-compat (C-02)"
  - "PackError taxonomy + classifyFetchError: unreachable / aborted / contract-drift transport buckets (D-07)"
  - "AbortSignal-aware fetch client (submitPackJob/fetchJobState) with API_BASE two-seam resolution + zod-at-boundary (D-11/C-04)"
  - "MSW 2 test transport (handlers/server/makePollSequence) + renderWithClient isolated-QueryClient RTL helper (Wave-0 infra)"
affects: [05-02-hooks, 05-03-loading-page, 05-04-failure-cancel]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-query@5.101.0", "msw@2.14.6 (dev)"]
  patterns:
    - "zod at the network boundary: parse() untrusted JSON, never as-cast (T-5-01)"
    - "transport-error bucketing via classifyFetchError, never read res.status off a thrown fetch (T-5-02)"
    - "fresh QueryClient per test (retry:false, gcTime:0) for RTL isolation"
    - "MSW scriptable poll-sequence factory for deterministic async-poll tests"

key-files:
  created:
    - src/api/pack-schema.ts
    - src/api/pack-schema.test.ts
    - src/api/errors.ts
    - src/api/errors.test.ts
    - src/api/client.ts
    - src/test/msw/handlers.ts
    - src/test/msw/server.ts
    - src/test/msw/renderWithClient.tsx
  modified:
    - src/test/setup.ts
    - package.json
    - package-lock.json

key-decisions:
  - "jobStateSchema leaves result as z.unknown() — the result page owns the heavy DoneResult shape; the poll boundary only validates the envelope"
  - "Used z.record(z.string(), valueSchema) explicit key+value form for zod v4 typing of meta/links"
  - "PackError covers TRANSPORT failures only; a failed/timeout JOB is a successfully-parsed JobState, not a PackError"

patterns-established:
  - "zod-at-boundary: untrusted API JSON is parsed (jobStateSchema.parse) so contract drift is a handled ZodError, never a render crash"
  - "classifyFetchError bucketing: opaque-CORS TypeError → unreachable, AbortError → aborted, ZodError → contract-drift, unknown → unreachable default"
  - "renderWithClient: per-test fresh QueryClient isolation for react-query component tests"

requirements-completed: [PACK-01, PACK-04, PACK-06]

# Metrics
duration: 10min
completed: 2026-06-04
---

# Phase 5 Plan 01: API Client + Async-Polling Foundation Summary

**The three-free contract layer for Phase 5: a zod network-boundary schema (status tightened, objects non-strict), a PackError transport taxonomy with CORS/abort bucketing, an AbortSignal-aware submit+poll fetch client, and the MSW test transport + isolated-QueryClient render helper every downstream hook/page test consumes.**

## Performance

- **Duration:** ~10 min (Task 1 supply-chain gate done in a prior session; Tasks 2-3 in this continuation)
- **Started:** 2026-06-04T20:23:11Z (Task 1 commit)
- **Completed:** 2026-06-04T20:33:00Z
- **Tasks:** 3
- **Files modified:** 11 (8 created, 3 modified across the whole plan)

## Accomplishments
- zod network-boundary schemas that TIGHTEN `status` to the verified closed union `{queued, running, done, failed, timeout}` while staying NON-strict everywhere else, so a forward-compat field on a benign API minor-bump is tolerated, not false-positived as contract-drift (C-02 / Pitfall 5 / threat T-5-01).
- `PackError` + `classifyFetchError` mapping any thrown value into the three transport buckets — unreachable (incl. opaque-CORS `TypeError`, never reading a status), aborted (`DOMException AbortError`), contract-drift (`ZodError`) — with a safe `unreachable` default (D-07 / threats T-5-02, T-5-03).
- A thin AbortSignal-forwarding fetch client (`submitPackJob`/`fetchJobState`) validating responses at the zod boundary, with `API_BASE` resolving the dev '' (proxy) vs prod baked-`VITE_API_URL`-origin two-seam model (D-11/C-04/D-16).
- The Wave-0 test infra: MSW 2 handlers with a scriptable `makePollSequence` factory (queued→running→done / failed / timeout / throw), a `setupServer` instance, the `renderWithClient` fresh-QueryClient RTL helper, and the MSW lifecycle wired into `setup.ts` — without breaking the existing 125-test jsdom suite.

## Task Commits

Each task was committed atomically:

1. **Task 1: Supply-chain checkpoint (T-5-SC) — install react-query + msw** - `227f274` (chore) — completed in a prior session, human-approved.
2. **Task 2: zod network-boundary schema + PackError taxonomy** - `21e44e5` (feat, TDD: tests written RED → impl GREEN in one commit)
3. **Task 3: fetch client + MSW transport + isolated QueryClient helper** - `7dfaeae` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `src/api/pack-schema.ts` - zod boundary schemas (jobStateSchema/jobAcceptedSchema/errorBodySchema/jobStatusSchema) + JobState/JobStatus inferred types.
- `src/api/pack-schema.test.ts` - parses the real `pack-done-response.json` fixture, proves status-union tightening + non-strict tolerance + safeParse handling.
- `src/api/errors.ts` - PackError class + classifyFetchError four-bucket mapper.
- `src/api/errors.test.ts` - the four transport-bucket cases.
- `src/api/client.ts` - submitPackJob/fetchJobState (AbortSignal-forwarded, zod-at-boundary) + API_BASE/PACK_PATH/jobPath.
- `src/test/msw/handlers.ts` - MSW 2 POST 202 + scriptable GET poll-sequence (makePollSequence).
- `src/test/msw/server.ts` - setupServer instance from msw/node.
- `src/test/msw/renderWithClient.tsx` - fresh-QueryClient (retry:false, gcTime:0) RTL helper.
- `src/test/setup.ts` - EXTENDED with the MSW listen/resetHandlers/close lifecycle (onUnhandledRequest:'error').

## Decisions Made
- `jobStateSchema.result` is `z.unknown().nullish()` — the heavy DoneResult shape belongs to the result page; the poll boundary only validates the envelope (job_id + status), keeping the contract layer minimal and the result-shape concern downstream.
- Used the explicit `z.record(z.string(), valueSchema)` key+value form (zod v4) for `meta`/`links` rather than the 1-arg form, for clean `tsc -b` typing.
- `PackError` is scoped to TRANSPORT failures only; a `failed`/`timeout` JOB is a successfully-parsed `JobState` read off the poll boundary, not a thrown error — keeps the error taxonomy and the job-state taxonomy cleanly separated.

## Deviations from Plan

None - plan executed exactly as written. (Task 1 was pre-completed and human-approved; Tasks 2-3 followed the plan's actions and acceptance criteria verbatim. The lint-staged pre-commit hook auto-ran eslint --fix + prettier --write on both commits with no manual changes needed.)

## Issues Encountered
None. The full 125-test jsdom suite continued to pass after the MSW lifecycle was added to setup.ts (`onUnhandledRequest:'error'` only fires on real requests; the WebGL-free unit suite makes none). `tsc -b` exited 0.

## User Setup Required
None - no external service configuration required. (The two new deps were installed + human-approved in Task 1.)

## Next Phase Readiness
- 05-02 (the submit-then-poll hooks) can now build against fixed signatures: `submitPackJob`/`fetchJobState`, `jobStateSchema`/`JobState`, `classifyFetchError`, and for tests the MSW `server`/`makePollSequence` + `renderWithClient`.
- The app-wide `QueryClientProvider` is NOT yet mounted (that is 05-02's job) — `renderWithClient` provides a test-local client in the meantime.
- Every new file is three-free (visual scan confirmed); the project-wide code-split build gate is enforced in Wave 4 once consumers exist.

## Self-Check: PASSED

All 8 created source files and the SUMMARY exist on disk; all three task commits (`227f274`, `21e44e5`, `7dfaeae`) are present in git history.

---
*Phase: 05-api-client-async-polling*
*Completed: 2026-06-04*
