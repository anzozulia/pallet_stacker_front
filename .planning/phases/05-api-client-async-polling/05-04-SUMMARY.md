---
phase: 05-api-client-async-polling
plan: 04
subsystem: ui
tags: [react-router, react-query, loading-page, error-handling, abort-controller, classify-fetch-error, playwright, code-split, e2e]

# Dependency graph
requires:
  - phase: 05-api-client-async-polling
    provides: "LoadingPage happy-path submit→poll spine (05-03): eager three-free /loading reads { request, idToType } nav state, fires useSubmitJob on mount, chains job_id into usePollJob, comet spinner + tally summary + honest status sub-line, done→/result replace"
  - phase: 05-api-client-async-polling
    provides: "usePollJob terminal-aware self-stopping poll + isCapExceeded client safety cap (05-02); classifyFetchError transport bucketing (TypeError→unreachable / AbortError→aborted / ZodError→contract-drift) + zod-at-boundary error body (05-01)"
  - phase: 04
    provides: "ConfigForm Run gate + useLocalStorageAutosave debounced draft persistence (the Back/Cancel draft-intact contract D-08)"
provides:
  - "ErrorCard (src/features/loading/ErrorCard.tsx, default export) — the distinct-terminal-state card for kind 'failed' | 'timeout' | 'unreachable' with Retry + Back; renders untrusted server message/problems as auto-escaped React text (no dangerouslySetInnerHTML, T-5-10); --color-danger token, three-free"
  - "LoadingPage four-terminal-state distinction: done (incl. unpacked_items>0) → /result SUCCESS; failed → failed card (server message); timeout OR isCapExceeded → timeout card; a thrown POST/poll → classifyFetchError → unreachable card; an aborted throw is a no-op (Pitfall 3) — none crash (PACK-06)"
  - "LoadingPage Cancel = abort the in-flight POST (per-attempt AbortController) + stop the poll (drop jobId → query disables) + navigate('/'), no confirmation (D-08); Retry re-POSTs the SAME built request from nav state (D-07); Back returns to / draft-intact — no leaked interval/request (PACK-05)"
  - "e2e/api-poll.spec.ts — deterministic Playwright route-intercepted (**/api/v1/pack + **/api/v1/jobs/**) Configure→loading→result + every error/cancel path, never the live API; runs against the preview production build"
affects: [result-page, e2e-flow, self-hosting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "transport-failure-to-card pipeline: every thrown POST/poll is classifyFetchError-bucketed (never read a status off a throw); unreachable/contract-drift → ErrorCard kind 'unreachable', aborted → render nothing (the user is leaving, Pitfall 3)"
    - "four terminal states each have a handled render branch (failed/timeout/unreachable cards + done→/result) so no state reaches an unhandled render (T-5-11 DoS-availability mitigation)"
    - "unpacked_items.length > 0 on a done response is SUCCESS → /result, never an error branch (Anti-Pattern guard)"
    - "untrusted API error message/problems rendered as React text only (auto-escaped), NEVER dangerouslySetInnerHTML (T-5-10 / ASVS V5)"
    - "Cancel/Back/unmount cleanliness: per-attempt AbortController on the POST + dropping jobId disables the react-query poll → react-query auto-cancels; the AbortError is classified 'aborted' so no error card flashes (T-5-12 / SC-3)"
    - "deterministic Playwright poll-sequence stub: page.route scripts the GET poll across calls (queued→running→done / →failed / →timeout / route.abort) so the async lifecycle is tested without the live API (CLAUDE.md)"

key-files:
  created:
    - src/features/loading/ErrorCard.tsx
    - e2e/api-poll.spec.ts
  modified:
    - src/routes/LoadingPage.tsx
    - src/routes/LoadingPage.test.tsx

key-decisions:
  - "The four terminal states map to distinct outcomes: done (incl. unpacked_items>0) → /result SUCCESS; failed → ErrorCard 'failed' with the server message; timeout (server terminal) OR isCapExceeded (client safety cap) → ErrorCard 'timeout'; any thrown POST/poll → classifyFetchError → ErrorCard 'unreachable' — none reach an unhandled render (PACK-06 / T-5-11)"
  - "A thrown fetch is bucketed by classifyFetchError, never inspected for a status (opaque CORS responses have none, Pitfall 2); an 'aborted' bucket renders nothing rather than an error card because the user is intentionally leaving (Pitfall 3)"
  - "unpacked_items.length > 0 is treated as SUCCESS and routes to /result, NOT an error (Anti-Pattern); proven by the unit test and the dedicated e2e case (the committed fixture has 7 unpacked items)"
  - "ErrorCard renders the untrusted server message/problems as React text only — no dangerouslySetInnerHTML — so a hostile/changed API body cannot inject markup (T-5-10 / ASVS V5); the body is also zod-parsed upstream (05-01)"
  - "Cancel aborts the in-flight POST via a per-attempt AbortController and stops the poll by dropping the jobId (disabling the query so react-query auto-cancels), then navigate('/') with no confirmation dialog (D-04/D-08); Retry re-fires useSubmitJob.mutate with the SAME already-built request from nav state (no bounce through the form, D-07); Back returns to / draft-intact (D-08)"

patterns-established:
  - "terminal-state → render branch table on LoadingPage: a single classify step turns poll status + thrown errors + the client safety cap into one of {navigate /result, failed card, timeout card, unreachable card, no-op} — exhaustive, crash-free"
  - "deterministic e2e poll stub: page.route('**/api/v1/jobs/**') returns a scripted sequence across successive GETs to drive queued→running→terminal without timing flakes or the live API; the same skeleton (console-error collector + expect(errors).toHaveLength(0)) as config-persist.spec.ts"
  - "the code-split build gate (scripts/check-code-split.mjs) now has its full Wave-4 consumer set asserted: /loading + src/features/loading/* + src/api stay three-free; three lives only in the lazy /result chunk (C-06)"

requirements-completed: [PACK-05, PACK-06]

# Metrics
duration: 3min
completed: 2026-06-05
---

# Phase 5 Plan 04: Failure / Timeout / Unreachable / Cancel — the Honest Terminal-State Slice Summary

**Layers the four-terminal-state distinction (failed / timeout / unreachable-CORS / unpacked-is-success), clean Cancel/Back/Retry abort behavior, and a deterministic route-intercepted Playwright e2e onto the LoadingPage submit→poll spine — so every job outcome is distinguished and recovered without crashing, completing PACK-05 and PACK-06 and the phase.**

## Performance

- **Duration:** ~3 min (implementation session; commits 23:59→00:02 local)
- **Started:** 2026-06-04T20:59:00Z (commit d7a8b42 author time, UTC)
- **Completed:** 2026-06-04T21:02:13Z (commit 4b0a073 author time, UTC)
- **Tasks:** 3 (2 implementation, 1 human-verify checkpoint)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `ErrorCard` (`src/features/loading/ErrorCard.tsx`, default export): a presentational card taking `kind` ('failed' | 'timeout' | 'unreachable'), an optional server `message`/`problems`, and `onRetry`/`onBack` callbacks. Each kind maps to a distinct title/body — `failed` → the solver/job error message; `timeout` → "the solver ran out of time"; `unreachable` → "couldn't reach the packing service". The untrusted server message/problems are rendered as React TEXT only (auto-escaped, NEVER `dangerouslySetInnerHTML` — T-5-10 / ASVS V5). Uses the `--color-danger` token (no inline hex) and is three-free.
- `LoadingPage` terminal-state routing extended onto the 05-03 happy-path spine: `status === 'done'` → `navigate('/result', { replace })` INCLUDING when `result.unpacked_items.length > 0` (that is SUCCESS, not an error — Anti-Pattern guard); `status === 'failed'` → ErrorCard 'failed' with the server message; `status === 'timeout'` (server terminal) OR `isCapExceeded` (client safety cap) → ErrorCard 'timeout'.
- Transport-failure handling: a thrown submit-mutation OR poll is `classifyFetchError`-bucketed (never reads a status off a throw); an `unreachable`/`contract-drift` bucket → ErrorCard 'unreachable'; an `aborted` bucket renders nothing (the user is leaving — Pitfall 3, no error card flash). Every terminal state has a handled branch so none reach an unhandled render (T-5-11).
- Cancel / Back / unmount cleanliness: Cancel aborts the in-flight POST via a per-attempt `AbortController` and stops the poll by dropping the `jobId` (disabling the react-query query so it auto-cancels), then `navigate('/')` with NO confirmation dialog (D-04/D-08). Retry re-fires `useSubmitJob.mutate(request)` with the SAME already-built request from nav state (no bounce through the form — D-07). Back returns to `/` with the draft intact (the form was never destructively unmounted — D-08). No leaked interval/request (PACK-05 / T-5-12).
- `LoadingPage.test.tsx` extended with MSW sequences (5 new tests, 146 total green): failed (distinct card + server message), timeout (distinct card), a network-throw (unreachable card, app does not crash), an `unpacked_items > 0` done (navigates to /result, NOT an error), and a cancel/unmount that leaves no pending poll.
- `e2e/api-poll.spec.ts` (created): a deterministic Playwright spec mirroring config-persist.spec.ts's console-error-collector skeleton, using `page.route('**/api/v1/pack', ...)` + `page.route('**/api/v1/jobs/**', ...)` to script the POST + GET poll sequence across calls — never the live API (CLAUDE.md). Six cases (all 6/6 passing): happy path (Configure→loading spinner+summary+honest status→/result), failed (server-message card), timeout ("ran out of time" card), unreachable (`route.abort` → "couldn't reach" card), unpacked-is-success (done body with 7 unpacked_items → /result, not an error), and cancel (→ / with draft intact, no hang). Runs against the preview production build via the existing Playwright webServer.
- The project-wide code-split build gate (`scripts/check-code-split.mjs`) passes with its full Wave-4 consumer set: the entry/index chunk is three-free; three appears only in the lazy /result chunk. `/loading` + `src/features/loading/*` + `src/api` do not leak three (C-06).

## Task Commits

Each implementation task was committed atomically (test + impl co-committed per the project's GREEN-in-one-commit convention):

1. **Task 1: Distinguish the four terminal states + Cancel/Retry/Back on LoadingPage** - `d7a8b42` (feat)
2. **Task 2: Playwright e2e — full flow + each error/cancel path + code-split gate** - `4b0a073` (test)
3. **Task 3: Human sign-off — loading screen fidelity + honest status + error/cancel UX** - human-approved checkpoint (no source commit; this closeout records the sign-off)

**Plan metadata:** this SUMMARY + STATE/ROADMAP/REQUIREMENTS tracking committed separately by the closeout agent.

## Files Created/Modified
- `src/features/loading/ErrorCard.tsx` (created) - the distinct-terminal-state card (failed/timeout/unreachable) with Retry + Back; untrusted message/problems rendered as escaped React text (no dangerouslySetInnerHTML, T-5-10); `--color-danger` token, three-free.
- `e2e/api-poll.spec.ts` (created) - deterministic route-intercepted Playwright spec: the six Configure→loading→result + error/cancel cases, never the live API, against the preview production build.
- `src/routes/LoadingPage.tsx` (modified) - terminal-state routing (failed/timeout/unreachable cards + unpacked-is-success→/result), `classifyFetchError` bucketing of thrown POST/poll, per-attempt AbortController Cancel + poll-disable, Retry re-POST of the built request, Back→/ draft-intact.
- `src/routes/LoadingPage.test.tsx` (modified) - 5 new MSW-backed tests: failed/timeout/throw distinct cards, unpacked>0 done→/result, cancel/unmount leaves no pending poll.

## Decisions Made
- The four terminal states each map to a distinct, handled outcome (done incl. unpacked>0 → /result; failed → failed card with server message; timeout/cap → timeout card; thrown → unreachable card) — none reach an unhandled render (PACK-06 / T-5-11).
- A thrown fetch is bucketed by `classifyFetchError`, never inspected for a status (opaque CORS responses have none — Pitfall 2); an `aborted` bucket renders nothing because the user is intentionally leaving (Pitfall 3).
- `unpacked_items.length > 0` on a done response is SUCCESS → /result, NOT an error (Anti-Pattern), proven by both a unit test and a dedicated e2e case.
- ErrorCard renders the untrusted server message/problems as React text only — no `dangerouslySetInnerHTML` (T-5-10 / ASVS V5); the body is also zod-parsed upstream (05-01).
- Cancel aborts the in-flight POST (per-attempt AbortController) + disables the poll query (react-query auto-cancels) + `navigate('/')` with no confirmation (D-04/D-08); Retry re-fires the mutation with the SAME built request from nav state (D-07); Back returns to / draft-intact (D-08).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test timing] CANCEL e2e waits for the autosave debounce to flush before Run**
- **Found during:** Task 2 (the cancel e2e case)
- **Issue:** `useLocalStorageAutosave` (Phase 4) cancels its pending debounce (~400ms) on unmount WITHOUT flushing it, so a sub-400ms un-flushed keystroke typed immediately before clicking Run would be lost on Cancel — making a naive "type then immediately Run then Cancel" assertion flaky. The *persisted* draft (the D-08 contract) always survives; only an in-flight un-flushed keystroke is at risk.
- **Fix:** The CANCEL e2e case waits for the autosave debounce to flush before clicking Run, so the assertion exercises the real D-08 persisted-draft-survives contract deterministically rather than racing the debounce. Forcing a flush-on-Run (so an un-flushed keystroke is never lost) would be a Phase-4 change to `useLocalStorageAutosave`, out of scope for this plan.
- **Files modified:** `e2e/api-poll.spec.ts`
- **Verification:** the cancel e2e passes deterministically; the persisted draft survives Cancel; flagged as a candidate future improvement (flush-on-Run in `useLocalStorageAutosave`).
- **Committed in:** `4b0a073` (Task 2 commit)
- **Sign-off:** surfaced to and explicitly accepted by the human at the Task 3 sign-off.

---

**Total deviations:** 1 auto-fixed (1 test-timing accommodation of a pre-existing Phase-4 debounce behavior).
**Impact on plan:** No scope change — every acceptance criterion for both implementation tasks was met. The deviation is a test-determinism accommodation, not a behavior gap; the D-08 persisted-draft contract holds. A flush-on-Run improvement to `useLocalStorageAutosave` is flagged for a future Phase-4 follow-up.

## Issues Encountered
None during the planned work itself. Both tasks were implemented and committed cleanly (`d7a8b42`, `4b0a073`). The orchestrator independently verified the green state: 146 vitest tests pass across 22 files, `tsc -b --noEmit` exit 0, Playwright e2e 6/6 pass (happy / failed / timeout / unreachable-CORS / unpacked-is-success / cancel) all route-intercepted (never live API), and the code-split gate clean (entry chunk three-free; three only in the lazy ResultPage chunk).

## Human Sign-off (Task 3, blocking checkpoint)
The Task 3 `checkpoint:human-verify` (gate="blocking") was **APPROVED** by the human ("approved"). The human walked the dev-server checks and signed off on: the `/loading` screen visual fidelity against `design/loading.html`; the HONEST status sub-line (real Queued → Packing… status, no fake % and no cycling flavor text — D-01); `done` advancing to `/result`; the four terminal states each distinguished (failed / timeout / unreachable-CORS / unpacked-is-success) without crashing; and Cancel/Back returning to Configure with the draft intact and no leaked spinner/request. The test-timing deviation above was surfaced at sign-off and accepted.

## User Setup Required
None - no external service configuration required (the API hooks/deps were installed + human-approved in earlier waves).

## Next Phase Readiness
- **Phase 5 is functionally complete** (orchestrator owns the phase-level completion stamp). The full async submit-then-poll lifecycle is honest and crash-free: a valid Run submits, polls, and either advances to /result on success (including some-unpacked) or shows a distinct failed/timeout/unreachable card with Retry + Back; Cancel/Back/unmount abort cleanly and return to Configure draft-intact.
- Phase 6 (Result Page & 3D wiring) can read the real done payload from the app-wide react-query cache (gcTime:Infinity, survives the replace navigation) and replace the committed fixture that /result currently shows.
- The deterministic e2e (`e2e/api-poll.spec.ts`) is a regression guard over the whole lifecycle; the code-split gate now asserts against its full Wave-4 consumer set.
- **Flagged for a future Phase-4 follow-up:** an optional flush-on-Run in `useLocalStorageAutosave` so an un-flushed sub-400ms keystroke is never lost on Cancel (the persisted draft already survives — this is a nicety, not a contract gap).

## Self-Check: PASSED

Both implementation commits (`d7a8b42`, `4b0a073`) are present in git history (`git log --oneline --grep="05-04"`). Both created files exist on disk (`src/features/loading/ErrorCard.tsx`, `e2e/api-poll.spec.ts`) and both modified files are present (`src/routes/LoadingPage.tsx`, `src/routes/LoadingPage.test.tsx`). Orchestrator-verified green: 146 vitest tests across 22 files, `tsc -b --noEmit` exit 0, Playwright e2e 6/6, code-split gate clean. Task 3 human-verify checkpoint approved.

---
*Phase: 05-api-client-async-polling*
*Completed: 2026-06-05*
