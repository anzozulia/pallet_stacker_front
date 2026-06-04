---
phase: 05-api-client-async-polling
plan: 03
subsystem: ui
tags: [react-router, react-query, loading-page, submit-poll, navigation-state, code-split, msw]

# Dependency graph
requires:
  - phase: 05-api-client-async-polling
    provides: "useSubmitJob (POST mutation, AbortSignal-forwarded) + usePollJob (terminal-aware self-stopping poll, gcTime:Infinity done cache) under the app-wide QueryClientProvider (05-02)"
  - phase: 03-pure-transform-core
    provides: "buildPackRequest → { request, idToType } (request-builder), tallyCatalog (config-tally), PackRequest (pack-contract)"
  - phase: 04
    provides: "ConfigForm onValid Run gate (checkAllBoxesFit + setError) + the eager Configure chunk"
provides:
  - "LoadingPage — the three-free EAGER /loading route: reads { request, idToType } nav state, fires useSubmitJob on mount, chains job_id into usePollJob, renders the comet spinner + tally-derived job-summary card with an HONEST status sub-line, and on done navigate('/result', { replace: true })"
  - "/loading route entry in src/router.tsx (static eager import, NO lazy/Suspense — three stays out of the entry chunk, C-06/D-03)"
  - "ConfigForm Run seam swapped: console.log → navigate('/loading', { state: { request, idToType } }) (C-05), Run gate untouched (C-03)"
  - "T-5-07 no-nav-state deep-link guard: /loading with no state redirects home rather than crashing"
affects: [05-04-failure-cancel, result-page, e2e-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-router navigation state as the loading→page handoff carrier ({ request, idToType } via useLocation().state, validated with a type guard)"
    - "once-on-mount submit fired from a useEffect guarded by a ref (StrictMode double-invoke safe) with a per-mount AbortController aborted on cleanup"
    - "navigation performed only in effects (status==='done' → /result replace; invalid state → / replace) — never navigate-during-render"
    - "honest status → fixed sub-line map ({ queued: 'Queued', running: 'Packing…' }) — no fake %, no cycling mockup flavor text"
    - "summary card derived from the EXISTING tallyCatalog over the already-quantity-expanded request boxes (no recompute, D-01); distinct TYPES recovered from the idToType value set"

key-files:
  created:
    - src/routes/LoadingPage.tsx
    - src/routes/LoadingPage.test.tsx
  modified:
    - src/router.tsx
    - src/features/config/ConfigForm.tsx

key-decisions:
  - "Distinct box TYPES for the summary card are recovered from new Set(idToType.values()).size, not the request.boxes row count — request boxes are already expanded one-per-unit so the row count is the UNIT count; idToType is the type-recovery channel (C-05)"
  - "Summary built by mapping each expanded request box to a { quantity: 1, weight } row and feeding tallyCatalog, reusing the exact footer tally logic (D-01) rather than recomputing units/weight"
  - "submit fired once via a firedRef guard so React 19 StrictMode dev double-invoke never double-submits; a per-mount AbortController aborts the in-flight POST on unmount (SC-3)"
  - "All navigation (done→/result replace D-03/D-05; invalid-state→/ replace T-5-07) runs in effects with replace, never during render"
  - "Comet spinner ported from design/loading.html via @theme tokens (--color-accent) + color-mix/conic-gradient, motion-reduce:animate-none for prefers-reduced-motion — NOT inline hex"

patterns-established:
  - "loading-route handoff: ConfigForm navigate('/loading', { state: { request, idToType } }) → LoadingPage useLocation().state, type-guarded; a stateless deep-link degrades to a home redirect"
  - "happy-path submit→poll spine: useSubmitJob.mutate on mount → submit.data.job_id → usePollJob(jobId) → status; done is a navigation, queued/running are sub-line text"
  - "eager three-free route: static import in router.tsx (no lazy/Suspense) + zero three/viewer/ResultPage imports keeps /loading on the Configure entry chunk (C-06)"

requirements-completed: [PACK-01, PACK-04]

# Metrics
duration: 2min
completed: 2026-06-04
---

# Phase 5 Plan 03: Loading Page — Submit→Poll Happy-Path Spine Summary

**The first user-observable end-to-end slice: a valid Run now navigates to an eager, three-free `/loading` route that fires `useSubmitJob` on mount, chains the `job_id` into `usePollJob`, shows a comet spinner + tally-derived job-summary card with an HONEST real-status sub-line (no fake %, no cycling flavor text), and on `done` hands off to `/result` via replace navigation.**

## Performance

- **Duration:** ~2 min (implementation session; commits 23:45→23:47 local)
- **Started:** 2026-06-04T20:45:30Z (commit 7c1217e author time, UTC)
- **Completed:** 2026-06-04T20:47:05Z (commit d623817 author time, UTC)
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `LoadingPage` (`src/routes/LoadingPage.tsx`, default export): reads the `{ request, idToType }` react-router navigation state, fires `useSubmitJob` once on mount (ref-guarded against StrictMode double-invoke, AbortController on cleanup), chains the returned `job_id` into `usePollJob`, and renders the comet spinner + the job-summary card. On `status === 'done'` it `navigate('/result', { replace: true })` so Back skips the spinner (D-03/D-05); the done payload stays in the react-query cache (gcTime:Infinity, Wave 2) for /result to read.
- HONEST status sub-line driven by a fixed `{ queued: 'Queued', running: 'Packing…' }` map (with a neutral "Submitting…" while no job_id yet) — NO fake %, NO cycling mockup flavor text (D-01).
- Job-summary card derived from the EXISTING `tallyCatalog` (no recompute, D-01): each already-expanded request box maps to a `{ quantity: 1, weight }` row → `{ units, estKg }`; distinct TYPES come from `new Set(idToType.values()).size`; pallet dims from `request.pallet`.
- Comet spinner ported from `design/loading.html` using `@theme` tokens (`--color-accent`) + `conic-gradient`/`color-mix` + a radial mask, `motion-reduce:animate-none` for `prefers-reduced-motion` — no inline hex.
- T-5-07 defensive guard: a deep-link to `/loading` with no nav state has nothing to submit → `navigate('/', { replace: true })` in an effect, never a crash on `undefined`.
- `/loading` wired into `src/router.tsx` as a STATIC eager import with a plain `element={<LoadingPage />}` — NO `lazy()`, NO `<Suspense>` — so three never enters the entry chunk (C-06/D-03). The existing `/` eager and `/result` lazy entries are untouched.
- ConfigForm Run seam swapped: `onValid` now destructures `{ request, idToType }` from `buildPackRequest` and `navigate('/loading', { state: { request, idToType } })`, replacing the Phase-4 `console.log` (C-05). The `checkAllBoxesFit` gate, per-failure `setError`, early `return`, and `runDisabled` are unchanged (C-03); the form is not destructively unmounted and the draft persists (D-08).
- MSW-backed component test (`LoadingPage.test.tsx`): a queued→running→done sequence asserts the tally-derived summary values (`1200 × 800 × 1800 mm`, `2 types · 3 units`, `17 kg`), the honest sub-line (`Packing…`, explicitly NOT `%` and NOT the mockup flavor text), the `done → navigate('/result', { replace: true })` intent (spied `useNavigate`), and the no-nav-state → home redirect. ConfigForm.test was wrapped in `MemoryRouter` and now asserts navigation intent (blocked Run navigates nowhere; valid Run carries the request + idToType Map).

## Task Commits

Each task was committed atomically (test + impl co-committed per the project's GREEN-in-one-commit convention):

1. **Task 1: LoadingPage happy path — submit→poll→spinner+summary→navigate('/result')** - `7c1217e` (feat)
2. **Task 2: Wire the /loading route (eager) + swap the ConfigForm Run seam** - `d623817` (feat)

**Plan metadata:** this SUMMARY + STATE/ROADMAP tracking committed separately by the closeout agent (see Notes).

## Files Created/Modified
- `src/routes/LoadingPage.tsx` (created) - the three-free eager `/loading` page: nav-state read + type guard, once-on-mount submit (ref+AbortController), `usePollJob` chain, comet spinner, tally-derived summary card, honest status sub-line, done→/result replace, T-5-07 no-state guard, Cancel placeholder.
- `src/routes/LoadingPage.test.tsx` (created) - MSW-backed component test: summary values, honest sub-line (no %/flavor text), done→/result intent, no-state redirect.
- `src/router.tsx` (modified) - static eager `import LoadingPage` + `{ path: '/loading', element: <LoadingPage /> }`; `/` and lazy `/result` untouched.
- `src/features/config/ConfigForm.tsx` (modified) - `useNavigate`; `onValid` destructures `{ request, idToType }` and navigates to `/loading` with state, replacing `console.log`; Run gate + `runDisabled` unchanged.

## Decisions Made
- Distinct box TYPES for the summary are recovered from `new Set(idToType.values()).size`, not `request.boxes.length` — the request boxes are already quantity-expanded (one entry per unit), so the row count is the UNIT count; `idToType` is the C-05 type-recovery channel.
- Summary reuses `tallyCatalog` over `{ quantity: 1, weight }` rows mapped from the expanded request boxes (D-01: no recompute of units/weight).
- Submit fired once via a `firedRef` guard (StrictMode dev double-invoke safe) with a per-mount `AbortController` aborted on unmount (SC-3).
- All navigation runs in effects with `replace` (done→/result D-03/D-05; invalid-state→/ T-5-07), never during render.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan inaccuracy] `src/styles.css` listed but not modified**
- **Found during:** Task 1 (LoadingPage)
- **Issue:** The plan listed `src/styles.css` in `files_modified` for porting "any missing loading.html token". On inspection every `@theme` token the comet spinner + summary card need (`--color-accent`, `--color-surface`, `--color-border`, `--color-text`/`-2`/`-3`, `--font-mono`, `--shadow`, `--topbar-height`, radii) already existed from earlier phases.
- **Fix:** No `styles.css` edit was made — the spinner/card were authored against the existing tokens (plus `color-mix`/`conic-gradient` inline in the component `style`/className, not new theme tokens). Honoring the plan's own "add only genuinely missing ones" instruction, nothing was genuinely missing.
- **Files modified:** none (styles.css untouched)
- **Verification:** `tsc -b --noEmit` exit 0; full suite green; visual fidelity deferred to the Plan-04 human-verify checkpoint per the plan's verification section.
- **Committed in:** n/a (no change to commit)

---

**Total deviations:** 1 (plan listed a file that needed no change).
**Impact on plan:** No scope change — every acceptance criterion for both tasks was met. The unused `styles.css` entry was the plan over-listing a possible touch-point, not missing work.

## Issues Encountered
None during the planned work itself. The two tasks were implemented and committed cleanly (`7c1217e`, `d623817`); the orchestrator independently verified `tsc -b --noEmit` exit 0 and the full suite at 141 tests across 22 files (up from 137 at 05-02, +4 LoadingPage tests). See Notes for the post-commit process termination.

## User Setup Required
None - no external service configuration required (the API hooks/deps were installed + human-approved in earlier waves).

## Notes
- **Closeout context (honest record):** The implementing session committed BOTH task commits successfully (`7c1217e` at 23:45, `d623817` at 23:47 local), then terminated on an upstream API socket error BEFORE it could write this SUMMARY or update tracking. No source code was lost — both commits are intact in git history and all four task files are on disk. This SUMMARY plus the STATE.md/ROADMAP.md tracking updates were produced by a SEPARATE closeout agent, which verified the committed work without re-implementing or re-committing any source. Durations/timestamps above are reconstructed from the two commit author times.
- Failed / timeout / cap-exceeded / cancel-abort distinctions and the live e2e flow are explicitly Plan 04 — this slice is the happy-path spine only. The Cancel button is a placeholder that currently `navigate('/')`; its abort+navigate behavior lands in Plan 04.
- The project-wide code-split build gate (`scripts/check-code-split.mjs`) that machine-enforces three staying out of the `/loading` entry chunk is wired in Wave 4 now that the eager consumer exists. LoadingPage imports only React, react-router, the three-free Wave-2 hooks, and the pure `tallyCatalog` — no three/r3f/drei/viewer/ResultPage (grep-confirmed).

## Next Phase Readiness
- 05-04 (failure/cancel) can now layer the failed/timeout/unreachable/cap-exceeded cards and the real Cancel abort onto LoadingPage's existing submit→poll lifecycle and status-driven sub-line.
- The /result hand-off works: the `done` payload survives in the app-wide react-query cache (gcTime:Infinity) for ResultPage to read after the replace navigation.
- The eager three-free `/loading` route is in place; the Wave-4 code-split gate has its consumer to assert against.

## Self-Check: PASSED

Both task commits (`7c1217e`, `d623817`) are present in git history (`git log --oneline --grep="05-03"`). All four task files exist on disk: `src/routes/LoadingPage.tsx`, `src/routes/LoadingPage.test.tsx`, `src/router.tsx`, `src/features/config/ConfigForm.tsx` (the plan-listed `src/styles.css` was correctly left unmodified — see Deviations). Orchestrator-verified: `tsc -b --noEmit` exit 0; full suite 141 tests pass across 22 files.

---
*Phase: 05-api-client-async-polling*
*Completed: 2026-06-04*
