---
phase: 05-api-client-async-polling
verified: 2026-06-05T01:10:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "Cap did not stop the network loop (CR-02): enabled is now gated on !capExceeded — query disabled on cap trip"
    - "capTripped never reset, Retry broken (CR-01): replaced boolean latch with trippedJobId string state — identity mismatch makes capExceeded false for any new jobId from Retry"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Live API smoke: navigate to /loading with a valid config, submit a real job, verify the loading screen shows the comet spinner + summary card + honest status sub-line (Queued / Packing…), confirm no fake % and no cycling flavor text"
    expected: "Loading screen matches design/loading.html; status sub-line shows Queued then Packing…; job completes and navigates to /result"
    why_human: "Visual fidelity and live API behavior cannot be verified programmatically; design/loading.html comparison requires a human eye"
  - test: "Retry after a server-timeout job: with a slow/stuck job, wait for the client safety cap to trip (2 minutes), then click Retry — verify the spinner (not the timeout card) appears and a new job starts"
    expected: "After clicking Retry, the loading spinner returns and a fresh job polls successfully; the timeout card does NOT appear immediately on the new job"
    why_human: "The 2-minute production cap makes this impractical to automate at full duration. The CR-01 fix is now covered by the usePollJob unit regression test (identity-latch test with 50ms injected cap), but end-to-end visual confirmation on the real UI path is advisable once."
---

# Phase 5: API Client & Async Polling — Verification Report (Re-verification)

**Phase Goal:** A user can submit a real packing job and watch an honest loading state while the app polls the asynchronous job to a terminal state, can cancel cleanly, and every failure mode is distinguished and handled without crashing.
**Verified:** 2026-06-05T01:10:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure on CR-01 and CR-02

## Re-verification Summary

Previous status: `gaps_found` (2/4). Two blockers were identified:
- CR-01: `capTripped` boolean never reset — Retry after cap trip immediately showed the timeout card on a brand-new healthy job
- CR-02: Cap was cosmetic — `enabled` and `refetchInterval` not gated on cap state, so the poll loop continued firing `GET /jobs/{id}` indefinitely after the cap tripped

Both have been resolved. The architectural approach changed from a boolean latch (`capTripped: boolean`) to a job-identity latch (`trippedJobId: string | null`). The new design is provably correct: `capExceeded = !!jobId && trippedJobId === jobId`, so a new `jobId` from Retry yields `false` without any synchronous `setState` in an effect. The same predicate gates both `enabled` and `refetchInterval`, stopping the network loop when the cap fires.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can submit a valid configuration and the app POSTs to /api/v1/pack and polls /api/v1/jobs/{job_id} until a terminal state | VERIFIED | `submitPackJob` in client.ts POSTs to `${API_BASE}/api/v1/pack`; `fetchJobState` polls `${API_BASE}/api/v1/jobs/${jobId}`. `usePollJob` with `refetchInterval` self-stops on terminal status. e2e HAPPY PATH and unit tests pass. 153/153 unit tests pass. |
| 2 | A loading screen shows while polling, and reaching `done` advances the user toward the result | VERIFIED | LoadingPage renders comet spinner + tally-derived summary card with honest `STATUS_SUBLINE` map. On `status === 'done'` calls `navigate('/result', { replace: true })`. e2e HAPPY PATH (2.6s) and UNPACKED-IS-SUCCESS cases pass. |
| 3 | A user can cancel an in-progress job and polling stops cleanly with NO leaked intervals or in-flight requests on unmount — AND the client safety cap ACTUALLY stops the poll loop when it fires | VERIFIED | Cancel/unmount path: `cancelled` state drops `jobId` to `undefined`, disabling the query. Cap path (CR-02 fixed): `enabled: !!jobId && !capExceeded` — when cap fires, query is disabled and react-query aborts the in-flight GET. Regression test "STOPS firing GET /jobs/{id} once the cap trips (CR-02 regression)" passes: call count stops increasing within one interval of the cap firing. |
| 4 | Job failure, timeout, unreachable/CORS errors, and "some items unpacked" are each distinguished in the UI and none crash — AND Retry after a cap trip must work (show spinner for the new job, not a spurious timeout card) | VERIFIED | All four terminal-state distinctions confirmed by e2e (FAILED, TIMEOUT, UNREACHABLE, UNPACKED-IS-SUCCESS — 0 console errors in all cases). Retry after cap trip (CR-01 fixed): `trippedJobId` identity latch — `capExceeded = !!jobId && trippedJobId === jobId` is immediately `false` for a new `jobId`. Regression test "does NOT inherit a stale cap trip when re-armed with a NEW jobId — Retry recovers (CR-01 regression)" passes. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/api/pack-schema.ts` | zod boundary schemas (jobStateSchema, jobAcceptedSchema, errorBodySchema, jobStatusSchema) | VERIFIED | All four schemas present. `z.enum(['queued','running','done','failed','timeout'])`. |
| `src/api/errors.ts` | PackError taxonomy + classifyFetchError bucketing | VERIFIED | `PackError` class, `classifyFetchError` function, `PackErrorKind` type all present and correct. Correctly buckets: PackError→kind, AbortError→aborted, ZodError→contract-drift, TypeError→unreachable. |
| `src/api/client.ts` | AbortSignal-aware fetch client (submitPackJob, fetchJobState) | VERIFIED | Both functions present, both accept `AbortSignal`, `fetchJobState` calls `jobStateSchema.parse`. |
| `src/api/useSubmitJob.ts` | useMutation(POST /pack) wrapper | VERIFIED | `useMutation` with `mutationFn: ({ request, signal }) => submitPackJob(request, signal)`. AbortSignal forwarded. |
| `src/api/usePollJob.ts` | useQuery(GET /jobs/{id}) with terminal-aware refetchInterval + safety cap that stops the network loop | VERIFIED | Core polling works. `enabled: !!jobId && !capExceeded` (CR-02 fix). `refetchInterval` returns `false` on terminal OR cap. `trippedJobId` identity latch (CR-01 fix). `gcTime: Infinity`. `POLL_SAFETY_CAP_MS = 120000`. Two explicit regression tests cover CR-01 and CR-02. |
| `src/api/queryClient.ts` | app-wide QueryClient instance | VERIFIED | `new QueryClient` with `retry: false`, `refetchOnWindowFocus: false`. |
| `src/routes/LoadingPage.tsx` | loading route: spinner + summary + terminal-state handling + cancel/retry | VERIFIED | Happy path, Cancel, failed/timeout/unreachable/done distinctions all work. `handleRetry` calls `setCancelled(false)` + `submit.reset()` + `fireSubmit()`. No `capTripped` in LoadingPage — no need, the hook handles identity internally. |
| `src/features/loading/ErrorCard.tsx` | distinct terminal-state error card (failed/timeout/unreachable) with Retry + Back | VERIFIED | Three distinct kinds with COPY map. Renders untrusted message/problems as React text. `--color-danger` token. |
| `src/router.tsx` | /loading route entry (eager, not lazy) | VERIFIED | Static `import LoadingPage from '@/routes/LoadingPage'` at top. `{ path: '/loading', element: <LoadingPage /> }` — no `lazy()`, no `<Suspense>`. |
| `src/main.tsx` | QueryClientProvider wraps RouterProvider | VERIFIED | `<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>` |
| `src/features/config/ConfigForm.tsx` | navigates to /loading on valid Run | VERIFIED | `navigate('/loading', { state: { request, idToType } })` in `onValid`. |
| `e2e/api-poll.spec.ts` | Playwright route-intercepted e2e with 6 cases | VERIFIED | All 6 tests pass (12.1s): HAPPY PATH, FAILED, TIMEOUT, UNREACHABLE, UNPACKED-IS-SUCCESS, CANCEL. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/api/client.ts` | `src/api/pack-schema.ts` | `jobStateSchema.parse` at GET boundary | VERIFIED | Line 58: `return jobStateSchema.parse(await res.json())` |
| `src/api/client.ts` | `src/api/errors.ts` | `throw new PackError('unreachable')` on non-2xx | VERIFIED | Lines 42-44 (submit), 55-57 (poll) |
| `src/api/useSubmitJob.ts` | `src/api/client.ts` | `mutationFn` calls `submitPackJob(request, signal)` | VERIFIED | Line 33 |
| `src/api/usePollJob.ts` | `src/api/client.ts` | `queryFn` calls `fetchJobState(jobId, signal)` | VERIFIED | Line 76 (approx) |
| `src/api/usePollJob.ts` | refetchInterval terminal stop | returns `false` on `isTerminal(q.state.data?.status)` | VERIFIED | `isTerminal(...) || capExceeded ? false : POLL_INTERVAL_MS` |
| `src/api/usePollJob.ts` | enabled cap gate | `enabled: !!jobId && !capExceeded` | VERIFIED | Line 108 — query disabled when cap fires (CR-02) |
| `src/api/usePollJob.ts` | trippedJobId identity latch | `capExceeded = !!jobId && trippedJobId === jobId` | VERIFIED | Line 101 — false for any new jobId from Retry (CR-01) |
| `src/routes/LoadingPage.tsx` | `src/api/errors.ts` | `classifyFetchError` buckets thrown POST/poll errors | VERIFIED | `transportKind` derived from `submit.error ?? poll.error` |
| `src/routes/LoadingPage.tsx` | `src/features/loading/ErrorCard.tsx` | renders `<ErrorCard kind={errorKind} ...>` on terminal error | VERIFIED | `if (errorKind)` branch renders ErrorCard |
| `src/features/config/ConfigForm.tsx` | `/loading` | `navigate('/loading', { state: { request, idToType } })` | VERIFIED | `onValid` callback |
| `src/main.tsx` | `src/api/queryClient.ts` | `QueryClientProvider wraps RouterProvider` | VERIFIED | Lines 3, 5, 11-13 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LoadingPage.tsx` | `poll.data?.status` | `usePollJob(jobId)` → `fetchJobState` → zod-parsed API response | Real data from network (MSW in tests, live API in prod) | FLOWING |
| `LoadingPage.tsx` | `summary` (types/units/estKg) | `tallyCatalog(request.boxes.map(...))` + idToType | Derived from nav state (real request data) | FLOWING |
| `ErrorCard.tsx` | `message`, `problems` | `poll.data?.error` (zod-parsed) | Real data from API error body (failed state) | FLOWING |
| `usePollJob.ts` | `capExceeded` | `trippedJobId` state set by `setTimeout` callback after `safetyCapMs` | Identity-keyed to current jobId — real derived predicate | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npm run typecheck` | Exit 0, no errors | PASS |
| All unit + component tests | `npm run test -- --run` | 153/153 pass (22 files) | PASS |
| Code-split gate | `npm run build && node scripts/check-code-split.mjs` | "code-split check PASSED — entry chunk(s) three-free: index-D--ouj6T.js; three lives in lazy chunk(s): ResultPage-CORWcee_.js" | PASS |
| Playwright e2e (6 cases) | `npx playwright test e2e/api-poll.spec.ts` | 6/6 passed (12.1s) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PACK-01 | 05-01, 05-02, 05-03 | User can submit the configuration to run a packing calculation | SATISFIED | ConfigForm navigates to /loading; LoadingPage fires POST via useSubmitJob; e2e HAPPY PATH passes |
| PACK-04 | 05-01, 05-02, 05-03 | App shows a loading state and polls the async job until terminal | SATISFIED | LoadingPage renders spinner; usePollJob polls until terminal; SC-1/SC-2 verified |
| PACK-05 | 05-02, 05-04 | User can cancel an in-progress packing job, polling stops cleanly | SATISFIED | Cancel path clean (drops jobId); cap-exceeded path also stops poll (CR-02 fixed: `enabled: !!jobId && !capExceeded`) |
| PACK-06 | 05-01, 05-04 | App distinguishes job failure, timeout, unreachable/CORS, some-unpacked — none crash | SATISFIED | All four states distinguished on fresh jobs; Retry after cap trip no longer broken (CR-01 fixed: identity latch) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/api/client.ts` | 20 | `API_BASE` becomes literal `"undefined"` string if `VITE_API_URL` unset at build | WARNING | Self-hosters without the build-arg get silently broken fetch URLs (WR-01). Pre-existing, not introduced by gap-closure. |
| `src/api/pack-schema.ts` | 55 | `links` field required but never consumed | WARNING | A 202 without `links` throws contract-drift. Pre-existing (WR-03). |
| `src/routes/LoadingPage.tsx` | 47 | `STATUS_SUBLINE` typed `Partial<Record<JobStatus, string>>` | INFO | Closed-union type safety on the status map. Pre-existing (IN-03), now correct. |
| `src/api/errors.ts` | 47-48 | Two branches both return `'unreachable'` — redundant branch | INFO | Harmless redundancy (IN-02). Pre-existing. |

No new anti-patterns introduced by the gap-closure commits. No TBD/FIXME/XXX markers found in any modified files.

### Human Verification Required

All automated checks pass (153/153 unit tests, 6/6 e2e, clean typecheck and build). The following items require human confirmation before this phase is fully signed off:

#### 1. Loading Screen Visual Fidelity (deferred from Plan 04 Task 3 checkpoint)

**Test:** Run `npm run dev`, fill a valid config, click Run packing. On /loading confirm the comet spinner matches `design/loading.html`, the summary card shows the correct pallet dimensions + box counts + estimated weight, and the status sub-line shows `Queued` then `Packing…` (never a fake %, never cycling flavor text).
**Expected:** Visual matches the mockup; status sub-line is honest; completing a job navigates to /result; Back returns to Configure with the draft intact.
**Why human:** Visual fidelity against design/loading.html requires a human eye. The live API poll path cannot be stubbed in a dev session.

#### 2. Retry After Safety-Cap Trip (CR-01 end-to-end confirmation)

**Test:** With a slow/stuck job (or with the safety cap reduced to ~5s in a dev build via an env override for testing), wait for `isCapExceeded` to trip and the timeout card to appear. Click Retry. Verify the spinner appears again (not another immediate timeout card), and a new job polls successfully.
**Expected:** After Retry, the spinner is shown and a new job polls through to completion. The timeout card does NOT appear immediately on the new job.
**Why human:** The CR-01 fix is covered by the usePollJob unit regression test ("does NOT inherit a stale cap trip when re-armed with a NEW jobId" — passes). The 2-minute production cap makes end-to-end manual confirmation impractical without injecting a reduced cap. One-time human confirmation of the complete visual flow is advisable given this was a prior blocker.

### Gaps Summary

No gaps. Both blockers from the previous verification have been closed.

**CR-01 (Retry broken after cap) — CLOSED:**
The boolean `capTripped: useState(false)` that was never reset has been replaced by `trippedJobId: useState<string | null>(null)`. The derived predicate `capExceeded = !!jobId && trippedJobId === jobId` is false for any new `jobId` from Retry — no synchronous `setState` in an effect required. Regression test "does NOT inherit a stale cap trip when re-armed with a NEW jobId — Retry recovers (CR-01 regression)" passes.

**CR-02 (cap does not stop the network loop) — CLOSED:**
`enabled: !!jobId && !capExceeded` — when `capExceeded` becomes true, the query is disabled: react-query aborts the in-flight GET and clears the `refetchInterval`. Also `refetchInterval` returns `false` when `capExceeded`. Regression test "STOPS firing GET /jobs/{id} once the cap trips on a never-terminal job (CR-02 regression)" passes: call count measured at cap-trip, verified not increasing over subsequent poll intervals.

---

_Verified: 2026-06-05T01:10:00Z_
_Verifier: Claude (gsd-verifier)_
