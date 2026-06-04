---
phase: 05-api-client-async-polling
plan: 02
subsystem: api
tags: [react-query, polling, abortsignal, msw, mutation, useQuery, refetchInterval, safety-cap]

# Dependency graph
requires:
  - phase: 05-api-client-async-polling
    provides: "src/api/client.ts (submitPackJob/fetchJobState AbortSignal-aware), pack-schema.ts (JobState/JobStatus), errors.ts (PackError/classifyFetchError), src/test/msw/* (handlers/server/makePollSequence + renderWithClient)"
  - phase: 03-pure-transform-core
    provides: "src/types/pack-contract.ts (PackRequest)"
provides:
  - "usePollJob — useQuery(GET /jobs/{id}) whose refetchInterval returns false on terminal status (self-stopping poll, C-01/T-5-04), keeps the done payload cached (gcTime:Infinity, D-05), aborts on unmount (SC-3)"
  - "POLL_INTERVAL_MS (1000) + POLL_SAFETY_CAP_MS (120000) named constants + isTerminal helper"
  - "isCapExceeded wall-clock backstop (injectable cap) bounding a never-terminal job (T-5-05/PACK-05)"
  - "useSubmitJob — useMutation(POST /pack) over submitPackJob, AbortSignal-forwarded, error surfaced as-is for the page to classify (T-5-06/PACK-01)"
  - "queryClient — the single app-wide QueryClient mounted via QueryClientProvider in main.tsx (the in-memory carrier for the /result hand-off)"
affects: [05-03-loading-page, 05-04-failure-cancel, result-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Query v5 single-arg refetchInterval callback returning false on terminal status (no hand-rolled setInterval, C-01)"
    - "client wall-clock safety cap layered ON TOP of react-query via a single setTimeout, derived isCapExceeded (no synchronous setState-in-effect)"
    - "AbortSignal forwarded through mutation variables into the fetch client (SC-3)"
    - "renderHook + a per-test fresh QueryClient wrapper for isolated react-query hook tests"

key-files:
  created:
    - src/api/usePollJob.ts
    - src/api/usePollJob.test.tsx
    - src/api/useSubmitJob.ts
    - src/api/useSubmitJob.test.tsx
    - src/api/queryClient.ts
  modified:
    - src/main.tsx

key-decisions:
  - "isCapExceeded is DERIVED (capTripped && !!jobId && !terminal) rather than reset via a synchronous setState in the effect — satisfies react-hooks/set-state-in-effect (the lint rule the pre-commit hook enforces) while guaranteeing a settled/absent job never reports a stale cap trip"
  - "UsePollJobResult is a type INTERSECTION (UseQueryResult<JobState> & { isCapExceeded }) not an interface-extends — UseQueryResult is a discriminated union and cannot be extended"
  - "useSubmitJob carries the AbortSignal through the mutation VARIABLES ({ request, signal }) since react-query v5 mutationFn does not receive a native signal the way queryFn does"
  - "POLL_SAFETY_CAP_MS = 120000 — bottom of the ~120-140s window, ABOVE the server's ~120s hard kill so the server's own timeout terminal almost always wins first; a tunable named constant, injectable via options for fast deterministic tests"

patterns-established:
  - "terminal-aware self-stopping poll: refetchInterval: (q) => isTerminal(q.state.data?.status) ? false : POLL_INTERVAL_MS"
  - "safety cap without a hand-rolled poll: a single setTimeout(remaining) flips a tripped flag; the public flag is derived so it auto-clears on settle/disable"
  - "react-query hook tests: renderHook with a fresh-QueryClient wrapper + MSW makePollSequence, never the live API"

requirements-completed: [PACK-01, PACK-04, PACK-05]

# Metrics
duration: 4min
completed: 2026-06-04
---

# Phase 5 Plan 02: Submit-then-Poll Hooks Summary

**The C-01 submit-then-poll engine realized: `useSubmitJob` (POST mutation, AbortSignal-forwarded) and `usePollJob` (a `useQuery` whose `refetchInterval` self-stops on terminal status, keeps the done payload cached, and enforces a ~120s client safety cap), wired under a single app-wide `QueryClientProvider` in `main.tsx` — no hand-rolled `setInterval`.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-04T20:36:20Z
- **Completed:** 2026-06-04T20:40:26Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `usePollJob`: a `useQuery(GET /jobs/{id})` over the Wave-1 `fetchJobState` whose `refetchInterval` returns `false` the instant `query.state.data.status` is terminal (done/failed/timeout) — react-query owns the poll loop, interval timer, cancellation, and the in-flight AbortSignal (C-01 / threat T-5-04). The `done` payload survives in cache (`gcTime: Infinity`) for the /result hand-off (D-05).
- A client wall-clock SAFETY CAP layered on top WITHOUT a hand-rolled poll: a single `setTimeout` flips a tripped flag at `POLL_SAFETY_CAP_MS` (120000, named constant, injectable for tests); the public `isCapExceeded` is derived so it auto-clears the moment the job settles or the query disables — bounding a never-terminal job (T-5-05 / PACK-05).
- `useSubmitJob`: a thin `useMutation(POST /pack)` over `submitPackJob`, forwarding an AbortSignal through the mutation variables (SC-3) and surfacing the thrown `PackError` AS-IS so the Wave-3 page can `classifyFetchError` it (T-5-06 / PACK-01).
- `queryClient` (single app-wide instance, `retry:false`) mounted via `<QueryClientProvider>` wrapping `<RouterProvider>` inside `<StrictMode>` in `main.tsx` — the in-memory carrier for the loading→result hand-off. Tests use their own isolated per-render clients.
- 12 MSW-backed hook tests (9 poll + 3 submit) proving terminal stop, `enabled` gating, cap trip with a tiny injected cap, clean unmount, 202→job_id resolution, and the non-2xx unreachable bucket. Full suite: 137/137 green (was 125 pre-Wave-1).

## Task Commits

Each task was committed atomically (TDD: test + impl co-committed per the project's GREEN-in-one-commit convention from Wave 1):

1. **Task 1: usePollJob — terminal-aware poll query + safety cap** - `8df10c2` (feat)
2. **Task 2: useSubmitJob mutation + queryClient + QueryClientProvider wiring** - `d39f214` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `src/api/usePollJob.ts` - `useQuery` poll hook; `isTerminal`, `POLL_INTERVAL_MS`, `POLL_SAFETY_CAP_MS` exports; derived `isCapExceeded`. Three-free.
- `src/api/usePollJob.test.tsx` - MSW-backed: terminal stop, isTerminal semantics, enabled:false gating, cap trip (tiny injected cap), cap clears on settle, clean unmount.
- `src/api/useSubmitJob.ts` - `useMutation` over `submitPackJob`, AbortSignal via variables, error surfaced as-is. Three-free.
- `src/api/useSubmitJob.test.tsx` - MSW-backed: 202 resolves job_id, non-2xx surfaces PackError 'unreachable', signal forwarded.
- `src/api/queryClient.ts` - single app-wide QueryClient (retry:false, refetchOnWindowFocus:false). Three-free.
- `src/main.tsx` - MODIFIED: `<QueryClientProvider client={queryClient}>` wraps `<RouterProvider>` inside `<StrictMode>`; nothing else changed.

## Decisions Made
- `isCapExceeded` is DERIVED (`capTripped && !!jobId && !terminal`) rather than reset via a synchronous `setState` inside the effect. This satisfies the `react-hooks/set-state-in-effect` lint rule the pre-commit hook enforces (the first commit attempt failed on it) while guaranteeing a settled/absent job never reports a stale cap trip. Only the timer callback sets state.
- `UsePollJobResult` is a type INTERSECTION (`UseQueryResult<JobState> & { isCapExceeded }`), not `interface extends` — `UseQueryResult` is a discriminated union and cannot be `extends`-ed (the typecheck flagged this).
- `useSubmitJob` carries the AbortSignal through the mutation VARIABLES (`{ request, signal }`) because react-query v5's `mutationFn` does not receive a native `signal` the way `queryFn` does; this keeps cancel/unmount aborting the in-flight POST (SC-3).
- `POLL_SAFETY_CAP_MS = 120000` (bottom of the ~120-140s window) sits above the server's ~120s hard kill so the server's own `timeout` terminal almost always wins first; it is a tunable named constant, injectable via the options arg for fast deterministic tests.

## Deviations from Plan

None - plan executed exactly as written. The two TypeScript/lint adjustments above (intersection-type for the union result; derived-not-synchronously-reset `isCapExceeded`) were implementation refinements to the plan's stated approach, not scope changes — both serve the plan's own acceptance criteria verbatim. The lint-staged pre-commit hook reformatted the `useSubmitJob` signature onto one line with no semantic change.

## Issues Encountered
- First commit of Task 1 was rejected by the `react-hooks/set-state-in-effect` pre-commit lint rule (a synchronous `setIsCapExceeded(false)` in the effect body). Resolved by restructuring to set state ONLY from the timer callback and deriving the public `isCapExceeded` flag — see Decisions. Re-lint + re-typecheck + re-test all green before re-commit.
- TypeScript rejected `interface UsePollJobResult extends UseQueryResult<JobState>` (union not extendable). Switched to an intersection type; typecheck then clean.

## User Setup Required
None - no external service configuration required (both deps were installed + human-approved in Wave 1).

## Next Phase Readiness
- 05-03 (LoadingPage) can now consume fixed hook signatures: `useSubmitJob().mutate({ request, signal })` → `data.job_id`, chained into `usePollJob(jobId)` → `{ data: JobState, isCapExceeded, ... }`. Terminal detection, gcTime:Infinity caching, abort, and the safety cap are all proven.
- The app-wide `QueryClientProvider` is now mounted; the poll query's `done` entry survives in that cache for the /result read (D-05).
- All new files are three-free (visual + grep scan confirmed: matches are comments only). The project-wide code-split build gate is enforced in Wave 4 once consumers exist. `tsc -b --noEmit` exits 0.

## Self-Check: PASSED

All 5 created source files and this SUMMARY exist on disk; both task commits (`8df10c2`, `d39f214`) are present in git history. `npm run typecheck` exits 0; `npm run test -- src/api/usePollJob.test.tsx src/api/useSubmitJob.test.tsx` exits 0 (12/12); full suite 137/137.

---
*Phase: 05-api-client-async-polling*
*Completed: 2026-06-04*
