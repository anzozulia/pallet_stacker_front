---
phase: 05-api-client-async-polling
verified: 2026-06-05T00:30:00Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A user can cancel an in-progress job and polling stops cleanly with no leaked intervals or in-flight requests on unmount"
    status: partial
    reason: >
      The Cancel/unmount path is clean (dropping jobId disables the react-query query, AbortController aborts the POST).
      However, when the CLIENT SAFETY CAP (isCapExceeded) trips on a stuck/never-terminal job, the poll loop continues
      firing GET /jobs/{id} indefinitely. The `enabled` option in useQuery is `!!jobId` only — not gated on `capTripped`
      or `isCapExceeded`. `refetchInterval` returns `false` only on `isTerminal(...)`, not on cap-exceeded.
      The timeout card appears in the UI but the network loop runs unbounded until the user explicitly clicks Cancel/Back.
      With `refetchIntervalInBackground: true`, this also keeps polling a backgrounded tab indefinitely.
      This is confirmed in src/api/usePollJob.ts lines 77-84: `enabled: !!jobId` (no cap gate),
      `refetchInterval: (q) => isTerminal(...) ? false : POLL_INTERVAL_MS` (no cap gate).
    artifacts:
      - path: "src/api/usePollJob.ts"
        issue: "enabled is `!!jobId` only; refetchInterval does not return false when capTripped. Cap is cosmetic — stops the UI, not the network loop."
    missing:
      - "Gate `enabled` on `!!jobId && !capTripped` (or equivalent), OR have LoadingPage drop the jobId once poll.isCapExceeded is true, to actually stop network requests when the cap fires."

  - truth: "Job failure, timeout, unreachable/CORS errors, and 'some items unpacked' are each distinguished in the UI and none crash the app"
    status: partial
    reason: >
      All four terminal-state distinctions exist and none crash. However, Retry after a prior cap trip
      immediately shows the 'timeout' error card on the BRAND NEW job, before that job has had any
      chance to poll. This is CR-01: `capTripped` state (useState) is never reset to false. When
      the prior trip set capTripped=true, Retry calls `submit.reset()` + `fireSubmit()`. Between
      `submit.reset()` and the new mutation resolving, `usePollJob(undefined)` runs (jobId is undefined),
      clearing `startRef.current = null`. When the new job_id arrives, `isCapExceeded = capTripped && !!jobId && !terminal
      = true && true && true = true` — the timeout card renders immediately on a new job.
      The only escape is if the job settles before the next render, which is not guaranteed and
      certainly not the common case on a slow server (the exact scenario that caused the cap trip).
      This makes Retry effectively broken after any cap-exceeded event.
      No test covers this path (confirmed: usePollJob.test.tsx and LoadingPage.test.tsx use only
      fresh hook instances; no test mounts the hook, trips the cap, then retries on the same instance).
    artifacts:
      - path: "src/api/usePollJob.ts"
        issue: "capTripped (line 93) is only ever set to true (line 107), never reset. The derived isCapExceeded (line 113) masks a stale trip only while jobId is absent but does not reset capTripped, so a new non-terminal jobId immediately re-triggers isCapExceeded=true."
      - path: "src/routes/LoadingPage.tsx"
        issue: "handleRetry (line 157-163) calls submit.reset() + fireSubmit() but cannot reset capTripped since it lives inside usePollJob. No mechanism exists to signal the hook to reset the latch."
    missing:
      - "Reset capTripped to false when a fresh polling arm begins (startRef.current === null branch in the useEffect, line 103-105 of usePollJob.ts: add `setCapTripped(false)` in the fresh-arm branch)."
      - "Add a test that: (1) trips the cap on a stuck job, (2) clicks Retry on the same hook instance, (3) asserts the spinner (not the timeout card) appears after Retry."
human_verification:
  - test: "Live API smoke: navigate to /loading with a valid config, submit a real job, verify the loading screen shows the comet spinner + summary card + honest status sub-line (Queued / Packing…), confirm no fake % and no cycling flavor text"
    expected: "Loading screen matches design/loading.html; status sub-line shows Queued then Packing…; job completes and navigates to /result"
    why_human: "Visual fidelity and live API behavior cannot be verified programmatically; design/loading.html comparison requires a human eye"
  - test: "Retry after a server-timeout job: with a slow/stuck job, wait for the client safety cap to trip (2 minutes), then click Retry — verify the spinner (not the timeout card) appears and a new job starts"
    expected: "After clicking Retry, the loading spinner returns and a fresh job polls successfully; the timeout card does NOT appear immediately on the new job"
    why_human: "CR-01 is not covered by any automated test. The 2-minute real cap makes this impractical to automate without test infrastructure changes."
---

# Phase 5: API Client & Async Polling — Verification Report

**Phase Goal:** A user can submit a real packing job and watch an honest loading state while the app polls the asynchronous job to a terminal state, can cancel cleanly, and every failure mode is distinguished and handled without crashing.
**Verified:** 2026-06-05T00:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can submit a valid configuration and the app POSTs to /api/v1/pack and polls /api/v1/jobs/{job_id} until a terminal state | VERIFIED | `submitPackJob` in client.ts POSTs to `${API_BASE}/api/v1/pack`; `fetchJobState` polls `${API_BASE}/api/v1/jobs/${jobId}`. `usePollJob` with `refetchInterval` self-stops on terminal status. e2e HAPPY PATH and unit tests pass. |
| 2 | A loading screen shows while polling, and reaching `done` advances the user toward the result | VERIFIED | LoadingPage renders comet spinner + tally-derived summary card with honest status sub-line (STATUS_SUBLINE map). On `status === 'done'` calls `navigate('/result', { replace: true })`. e2e HAPPY PATH passes. All LoadingPage unit tests pass (146/146 total). |
| 3 | A user can cancel an in-progress job and polling stops cleanly with no leaked intervals or in-flight requests on unmount | PARTIAL — BLOCKER | Cancel/unmount path is clean (dropping jobId disables query). BUT the client safety cap path does NOT stop the network loop (CR-02): when `isCapExceeded` trips, `enabled = !!jobId` remains true and `refetchInterval` keeps returning `POLL_INTERVAL_MS`. The timeout card shows but GET /jobs/{id} keeps firing indefinitely with `refetchIntervalInBackground:true`. |
| 4 | Job failure, timeout, unreachable/CORS errors, and "some items unpacked" are each distinguished in the UI and none crash the app | PARTIAL — BLOCKER | All four distinctions exist and none crash on fresh jobs. BUT Retry after a prior cap trip (CR-01) immediately shows the timeout card on a brand new non-terminal job because `capTripped` (useState) is never reset. Retry is effectively broken after any cap-exceeded event. |

**Score:** 2/4 truths verified (SC-1, SC-2 pass; SC-3, SC-4 partial/fail)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/api/pack-schema.ts` | zod boundary schemas (jobStateSchema, jobAcceptedSchema, errorBodySchema, jobStatusSchema) | VERIFIED | All four schemas present. `z.enum(['queued','running','done','failed','timeout'])`. Non-strict (no `.strict()`). `links` field is required (WR-03: stricter than needed since `links` is unused, but not a blocker). |
| `src/api/errors.ts` | PackError taxonomy + classifyFetchError bucketing | VERIFIED | `PackError` class, `classifyFetchError` function, `PackErrorKind` type all present and correct. Correctly buckets: PackError→kind, AbortError→aborted, ZodError→contract-drift, TypeError→unreachable, unknown→unreachable. Last two branches are redundant (IN-02) but harmless. |
| `src/api/client.ts` | AbortSignal-aware fetch client (submitPackJob, fetchJobState) | VERIFIED | Both functions present, both accept `AbortSignal`, `fetchJobState` calls `jobStateSchema.parse`. `API_BASE` resolved from `import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL`. WR-01 (undefined coercion without VITE_API_URL set) noted as a WARNING but not a blocker for phase goal. |
| `src/api/useSubmitJob.ts` | useMutation(POST /pack) wrapper | VERIFIED | `useMutation` with `mutationFn: ({ request, signal }) => submitPackJob(request, signal)`. AbortSignal forwarded. |
| `src/api/usePollJob.ts` | useQuery(GET /jobs/{id}) with terminal-aware refetchInterval + safety cap | PARTIAL | Core polling works. `refetchInterval` returns `false` on terminal. `gcTime: Infinity`. `POLL_SAFETY_CAP_MS = 120000`. BUT: (a) `capTripped` never resets — Retry after cap trip immediately shows timeout card (CR-01 BLOCKER), (b) cap does not disable the query (`enabled` not gated on capTripped) — poll runs unbounded after cap (CR-02 BLOCKER). |
| `src/api/queryClient.ts` | app-wide QueryClient instance | VERIFIED | `new QueryClient` with `retry: false`, `refetchOnWindowFocus: false`. |
| `src/routes/LoadingPage.tsx` | loading route: spinner + summary + terminal-state handling + cancel/retry | PARTIAL | Happy path, Cancel, failed/timeout/unreachable/done distinctions all work. Retry broken after cap trip (CR-01). |
| `src/features/loading/ErrorCard.tsx` | distinct terminal-state error card (failed/timeout/unreachable) with Retry + Back | VERIFIED | Three distinct kinds with COPY map. No `dangerouslySetInnerHTML`. Renders untrusted message/problems as React text. `--color-danger` token. |
| `src/router.tsx` | /loading route entry (eager, not lazy) | VERIFIED | Static `import LoadingPage from '@/routes/LoadingPage'` at top. `{ path: '/loading', element: <LoadingPage /> }` — no `lazy()`, no `<Suspense>`. |
| `src/main.tsx` | QueryClientProvider wraps RouterProvider | VERIFIED | `<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>` |
| `src/features/config/ConfigForm.tsx` | navigates to /loading on valid Run | VERIFIED | `navigate('/loading', { state: { request, idToType } })` in `onValid`. `checkAllBoxesFit` gate intact. |
| `e2e/api-poll.spec.ts` | Playwright route-intercepted e2e with 6 cases | VERIFIED | All 6 tests pass: HAPPY PATH, FAILED, TIMEOUT, UNREACHABLE, UNPACKED-IS-SUCCESS, CANCEL. Uses `page.route('**/api/v1/**')`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/api/client.ts` | `src/api/pack-schema.ts` | `jobStateSchema.parse` at GET boundary | VERIFIED | Line 58: `return jobStateSchema.parse(await res.json())` |
| `src/api/client.ts` | `src/api/errors.ts` | `throw new PackError('unreachable')` on non-2xx | VERIFIED | Lines 42-44 (submit), 55-57 (poll) |
| `src/api/useSubmitJob.ts` | `src/api/client.ts` | `mutationFn` calls `submitPackJob(request, signal)` | VERIFIED | Line 33 |
| `src/api/usePollJob.ts` | `src/api/client.ts` | `queryFn` calls `fetchJobState(jobId, signal)` | VERIFIED | Line 76 |
| `src/api/usePollJob.ts` | refetchInterval terminal stop | returns `false` on `isTerminal(q.state.data?.status)` | VERIFIED | Line 79 |
| `src/routes/LoadingPage.tsx` | `src/api/errors.ts` | `classifyFetchError` buckets thrown POST/poll | VERIFIED | Line 133 |
| `src/routes/LoadingPage.tsx` | `src/features/loading/ErrorCard.tsx` | renders `<ErrorCard kind={errorKind} ...>` on terminal error | VERIFIED | Lines 193-199 |
| `src/features/config/ConfigForm.tsx` | `/loading` | `navigate('/loading', { state: { request, idToType } })` | VERIFIED | Line 93 |
| `src/main.tsx` | `src/api/queryClient.ts` | `QueryClientProvider wraps RouterProvider` | VERIFIED | Lines 3, 5, 11-13 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LoadingPage.tsx` | `poll.data?.status` | `usePollJob(jobId)` → `fetchJobState` → zod-parsed API response | Real data from network (MSW in tests, live API in prod) | FLOWING |
| `LoadingPage.tsx` | `summary` (types/units/estKg) | `tallyCatalog(request.boxes.map(...))` + idToType | Derived from nav state (real request data) | FLOWING |
| `ErrorCard.tsx` | `message`, `problems` | `poll.data?.error` (zod-parsed, cast as JobErrorBody) | Real data from API error body | FLOWING (with IN-01 note: duplicate interface + `as` cast) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npm run typecheck` | Exits 0, no errors | PASS |
| All unit + component tests | `npm run test` | 146/146 pass | PASS |
| Code-split gate | `npm run build && node scripts/check-code-split.mjs` | "code-split check PASSED" | PASS |
| Playwright e2e (6 cases) | `npx playwright test e2e/api-poll.spec.ts` | 6/6 passed (12.2s) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PACK-01 | 05-01, 05-02, 05-03 | User can submit the configuration to run a packing calculation | SATISFIED | ConfigForm navigates to /loading; LoadingPage fires POST via useSubmitJob; e2e HAPPY PATH passes |
| PACK-04 | 05-01, 05-02, 05-03 | App shows a loading state and polls the async job until terminal | SATISFIED | LoadingPage renders spinner; usePollJob polls until terminal; SC-1/SC-2 verified |
| PACK-05 | 05-02, 05-04 | User can cancel an in-progress packing job, polling stops cleanly | PARTIAL | Cancel path clean; cap-exceeded path does NOT stop the poll (CR-02 blocker) |
| PACK-06 | 05-01, 05-04 | App distinguishes job failure, timeout, unreachable/CORS, some-unpacked — none crash | PARTIAL | All four states distinguished on fresh jobs; Retry after cap trip broken (CR-01 blocker) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/api/usePollJob.ts` | 93, 107, 113 | `capTripped` never reset to `false` | BLOCKER | Retry after cap trip immediately shows timeout card on a new healthy job (CR-01) |
| `src/api/usePollJob.ts` | 77, 79, 113 | `enabled` and `refetchInterval` not gated on `capTripped` | BLOCKER | Poll loop runs unbounded after cap trips; cap stops the UI only, not the network (CR-02) |
| `src/api/client.ts` | 20 | `API_BASE` becomes literal `"undefined"` string if `VITE_API_URL` unset at build | WARNING | Self-hosters without the build-arg get silently broken fetch URLs (WR-01) |
| `src/api/pack-schema.ts` | 55 | `links` field required but never consumed by any code | WARNING | A 202 without `links` throws contract-drift on an otherwise valid job acceptance (WR-03) |
| `src/routes/LoadingPage.tsx` | 41-46 | Local `JobErrorBody` interface duplicates `errorBodySchema`; uses `as` cast | INFO | Drift risk; `as` cast defeats boundary validation for the error body (IN-01) |
| `src/routes/LoadingPage.tsx` | 53 | `STATUS_SUBLINE` typed `Record<string, string>` not `Partial<Record<JobStatus, string>>` | INFO | Loses the closed-union type safety on the status map (IN-03) |
| `src/api/errors.ts` | 47-48 | Two branches both return `'unreachable'` — `instanceof TypeError` is dead code | INFO | Harmless redundancy; comment implies meaningful distinction that does not exist (IN-02) |

### Human Verification Required

The following items need human testing. Note: status `human_needed` is NOT the overall status because hard blockers (CR-01 and CR-02) were found — `gaps_found` takes precedence per the decision tree.

#### 1. Loading Screen Visual Fidelity (deferred from Plan 04 Task 3 checkpoint)

**Test:** Run `npm run dev`, fill a valid config, click Run packing. On /loading confirm the comet spinner matches `design/loading.html`, the summary card shows the correct pallet dimensions + box counts + estimated weight, and the status sub-line shows `Queued` then `Packing…` (never a fake %, never cycling flavor text).
**Expected:** Visual matches the mockup; status sub-line is honest; completing a job navigates to /result; Back returns to Configure with the draft intact.
**Why human:** Visual fidelity against design/loading.html requires a human eye. The live API poll path cannot be stubbed in a dev session.

#### 2. Retry After Safety-Cap Trip

**Test:** With a slow/stuck job (or with the safety cap reduced to ~5s for testing), wait for `isCapExceeded` to trip and the timeout card to appear. Click Retry. Verify the spinner appears again (not another immediate timeout card).
**Expected:** After Retry, the spinner is shown and a new job polls successfully.
**Why human:** This is the CR-01 scenario. No automated test covers it. The 2-minute production cap makes it impractical to automate without injecting the tiny-cap path into the live app. Must be verified AFTER the CR-01 fix is applied.

### Gaps Summary

Two blockers prevent the phase goal from being fully achieved.

**BLOCKER 1 — CR-01: `capTripped` never resets (Retry broken after cap)**

`usePollJob.ts` uses `useState(false)` for `capTripped`. It is set to `true` in a `setTimeout` callback and is never set back to `false`. The derived `isCapExceeded = capTripped && !!jobId && !terminal` masks the stale trip when `jobId` is absent, but when `handleRetry` fires on `LoadingPage`, the sequence is:
1. `submit.reset()` clears `job_id` → `usePollJob(undefined)` → `!jobId` clears `startRef.current`
2. `capTripped` remains `true`
3. New mutation resolves → new `job_id` → `usePollJob(new_job_id)` → `isCapExceeded = true && true && true = true`
4. Timeout card shows instantly on the new healthy job

Fix: in the `!jobId || terminal` branch of the cap effect (line 99-101), add `setCapTripped(false)` so the latch clears when the hook is effectively disarmed. Or add it in the `startRef.current === null` fresh-arm branch (line 103-105).

**BLOCKER 2 — CR-02: Cap stops the UI but not the poll loop**

When the safety cap trips (`capTripped` → `isCapExceeded`), the `useQuery` continues because `enabled: !!jobId` is not gated on `capTripped`, and `refetchInterval` returns `POLL_INTERVAL_MS` (not `false`) as long as the status is non-terminal. With `refetchIntervalInBackground: true`, this means an unbounded `GET /jobs/{id}` loop running at 1 Hz even when the timeout card is displayed, until the user clicks Cancel or Back.

Fix: change `enabled` to `!!jobId && !capTripped` in `usePollJob`, or change `LoadingPage` to pass `undefined` as `jobId` once `poll.isCapExceeded` is true (mirroring the `cancelled` guard at line 113).

These two issues affect SC-3 (clean stop) and SC-4 (Retry broken = timeout card appears incorrectly). They do not prevent the basic happy path, the Cancel path, or the first-attempt failure distinctions from working — those are all verified. But the phase goal explicitly includes "can cancel cleanly" and "every failure mode is distinguished without crashing", and the Retry-after-cap scenario violates the latter: the timeout "failure mode" is incorrectly shown on a non-failed job.

---

_Verified: 2026-06-05T00:30:00Z_
_Verifier: Claude (gsd-verifier)_
