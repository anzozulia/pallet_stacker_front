---
phase: 06-result-page-3d-wiring
plan: 02
subsystem: ui
tags: [react, react-router, react-query, result-page, carrier-seam, code-split, three]

# Dependency graph
requires:
  - phase: 05-loading-and-poll
    provides: usePollJob cache (['job', jobId], gcTime:Infinity), queryClient singleton, LoadingPage done-nav
  - phase: 03-pure-transform-core
    provides: mapDoneResponse(done, idToType) (map-PRIMARY type recovery), pack-contract types
  - phase: 06-01
    provides: src/lib pure derivations (summarise/mapCog/supportColor) + DECK_TOP_Y export (consumed by Plans 03-05)
provides:
  - "LoadingPage done-nav carrier: navigate('/result', { replace, state: { jobId, idToType } })"
  - "ResultPage live-cache read: queryClient.getQueryData(['job', jobId]) → real done payload (fixture import removed)"
  - "isResultNavState validator (string jobId + idToType instanceof Map) — T-06-03 guard"
  - "No-result redirect to / on absent/non-done cache (C-02 / T-06-04)"
  - "selectedPalletIndex (sel) + hoveredId state seam — one persistent Canvas swaps pallets (D-01/SC-1)"
  - "Result topbar (step-nav Configure ✓ → Result, Edit configuration; no Export/Solved-in) + viewer|rail grid (D-07/D-08/D-09)"
affects: [06-03, 06-04, 06-05, result-page, pallet-switcher, placement-list, summary-block, unpacked-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carrier seam: nav state carries only { jobId, idToType }; the payload body stays the single source of truth in the react-query cache (gcTime:Infinity) — never bloating history.state"
    - "nav-state validator mirrors isLoadingNavState (instanceof Map discipline) so a crafted history.state degrades to a redirect, never a render crash"
    - "all data-shaping hooks (mapper/palette/legend) kept ABOVE the JSX early-return guard so hook order is stable across the redirect render"
    - "WebGL viewer subtree mocked in the jsdom unit test (Canvas/Boxes/Pallet/CameraPresets stand-ins); real canvas + presets proven only in Playwright"

key-files:
  created:
    - src/routes/ResultPage.test.tsx
  modified:
    - src/routes/ResultPage.tsx
    - src/routes/LoadingPage.tsx
    - src/routes/LoadingPage.test.tsx
    - e2e/result-viewer.spec.ts
    - e2e/api-poll.spec.ts

key-decisions:
  - "Carrier carries { jobId, idToType } only; the done body is read from the cache by jobId (RESEARCH anti-pattern: carrying the payload bloats history.state)"
  - "Cast ONLY done.result to DoneResult — the JobState envelope already matches DoneResponse; result is typed unknown at the poll boundary but IS the DoneResult body (confirmed by the e2e fulfil shape)"
  - "Redirect guard is hasResult = done && status==='done' && !!done.result; a wrong-shape/non-done done fails the guard → redirect, never a render crash (T-06-04)"
  - "buildPalette built from the WHOLE result ({ result }) so the legend is stable across pallet switches (Pitfall 5)"
  - "sel is clamped (Math.min(sel, pallets.length-1)) so a stale selected index never reads past the array"
  - "setSel/setHoveredId declared now (carrier seam) but consumed by PalletSwitcher/PlacementList in Plans 03-05; voided to satisfy lint"
  - "bare deep-link e2e converted to assert the C-02 redirect; viewer + preset e2e driven through the stubbed Configure→Run→Result flow to a populated /result"

patterns-established:
  - "Pattern 1: a route's nav-state carrier is validated by an isXNavState type-guard before any consumer read; failure → redirect home"
  - "Pattern 2: read settled job bodies once via queryClient.getQueryData (no live subscription) for a cross-route hand-off"
  - "Pattern 3: jsdom unit tests mock the entire r3f viewer subtree; WebGL pixels are Playwright-only"

requirements-completed: [RESULT-04]

# Metrics
duration: 6min
completed: 2026-06-05
---

# Phase 6 Plan 02: Result-Page Live-Cache Carrier Summary

**The vertical slice that makes `/result` REAL: LoadingPage now hands over `{ jobId, idToType }` on the `done` navigation, ResultPage reads the actual returned payload from the react-query cache (fixture import removed), threads `idToType` into `mapDoneResponse` for map-PRIMARY type recovery, redirects home on any absent/non-done result (C-02), and introduces the `selectedPalletIndex` state that swaps which pallet feeds the one persistent Canvas — all behind the result topbar + viewer|rail grid shell.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-05T09:48:00Z
- **Completed:** 2026-06-05T09:54:38Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- **LoadingPage carrier (C-03):** the `done`-navigation now carries `state: { jobId, idToType }` with `jobId`/`idToType` added to the effect deps. The payload body is NOT carried — it stays in the cache under `['job', jobId]` (gcTime:Infinity).
- **ResultPage live read (C-02/C-03/D-01):** removed the committed-fixture import; the page reads the settled job via `queryClient.getQueryData(['job', jobId])`, validates the nav state via a new `isResultNavState` (string `jobId` + `idToType instanceof Map`), redirects to `/` on absent/non-done result, runs `mapDoneResponse(done.result, idToType)` for map-PRIMARY recovery, and introduces `sel`/`hoveredId` state feeding the one persistent Canvas (the scene subtree from the fixture version was preserved verbatim — C-01).
- **Topbar + layout (D-07/D-08/D-09):** added the result topbar (brand glyph + step-nav `Configure ✓` → `Result` active + an `Edit configuration` ghost button that returns to `/`; NO Export, NO "Solved in") and wrapped the viewer in a `viewer 1fr | rail 384px` grid that stacks below 900px (rail is an empty placeholder this slice; Plans 03-05 fill it).
- **Unit coverage (TDD):** co-located `ResultPage.test.tsx` (jsdom, WebGL mocked) covers renders-on-valid, redirect-on-no-state, redirect-on-missing-cache, redirect-on-non-done, and idToType-reaches-mapper (map-PRIMARY recovery proven distinct from the typeKeyOf fallback). Satisfies the Nyquist Wave-0 gap.
- **e2e carrier contract:** `result-viewer.spec.ts` now asserts the bare-deep-link redirect AND drives the stubbed Configure→Run→Result flow to a populated `/result`; `api-poll.spec.ts` happy path asserts the r3f canvas + D/F/T legend on `/result` (live data, not the fixture). All routes stubbed — never the live API.

## Task Commits

1. **Task 1: Carry { jobId, idToType } on LoadingPage done navigation (C-03)** — `8a5d64b` (feat)
2. **Task 2: ResultPage live cache + redirect + selected-pallet state (C-02/C-03/D-01)** — `3436db7` (feat, TDD RED→GREEN in one commit)
3. **Task 3: Update e2e for the carrier (redirect + populated stubbed flow)** — `0ff6ec1` (test)

## Files Created/Modified

- `src/routes/ResultPage.tsx` — fixture import removed; carrier read + `isResultNavState` + no-result redirect + `mapDoneResponse(idToType)` + `sel`/`hoveredId` state + topbar + viewer|rail grid; scene subtree preserved
- `src/routes/ResultPage.test.tsx` (created) — jsdom RTL test (WebGL subtree mocked) for carrier/redirect/idToType wiring
- `src/routes/LoadingPage.tsx` — done-nav carries `state: { jobId, idToType }`; deps gain jobId + idToType
- `src/routes/LoadingPage.test.tsx` — two done-nav assertions updated to the carrier contract (state matcher)
- `e2e/result-viewer.spec.ts` — bare deep-link asserts the C-02 redirect; viewer + preset tests driven through the stubbed Configure→Run→Result flow
- `e2e/api-poll.spec.ts` — happy path asserts the r3f canvas + D/F/T legend on /result

## Decisions Made

Captured in frontmatter `key-decisions`. All trace to the plan/PATTERNS/UI-SPEC: carrier carries the cache key (not the body), cast only `done.result`, redirect on the status guard, whole-result palette, clamped `sel`, the setSel/setHoveredId seam for Plans 03-05, and the e2e carrier rework.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated LoadingPage.test.tsx done-nav assertions to the carrier contract**
- **Found during:** Task 1
- **Issue:** Two existing LoadingPage tests asserted `navigate('/result', { replace: true })` with EXACT args. Task 1 adds `state: { jobId, idToType }` to that call, so the literal-args assertions no longer matched — one test timed out waiting for the never-matching call.
- **Fix:** Updated both assertions to `expect.objectContaining({ replace: true, state: expect.objectContaining({ jobId: expect.any(String), idToType: expect.any(Map) }) })` (and a looser `state: expect.any(Object)` for the unpacked-is-success case). This is the required consequence of the carrier change, explicitly anticipated by the plan ("LoadingPage tests updated to the carrier contract"). The negative `not.toHaveBeenCalledWith('/result', { replace: true })` assertions in the failed/timeout/unreachable/cancel tests remain valid (no done-nav occurs there).
- **Files modified:** src/routes/LoadingPage.test.tsx
- **Commit:** 8a5d64b

## Issues Encountered

- **vi.hoisted needed for the mapper spy:** the `vi.mock('@/lib/result-mapper', …)` factory calls `mapSpy.mockImplementation(…)` at factory-eval time, which is hoisted above the `const mapSpy = vi.fn()` declaration → `Cannot access 'mapSpy' before initialization`. Resolved by declaring both spies via `vi.hoisted(() => ({ navigateSpy, mapSpy }))`. (The `navigateSpy` alone worked without hoisting only because it is referenced lazily inside the `useNavigate: () => navigateSpy` closure.)
- **afterEach must not vi.clearAllMocks():** the mapper spy delegates to the real implementation; `clearAllMocks` would strip that implementation and break later tests. Switched to per-spy `mockClear()`.

## Known Stubs

- **Result rail is an empty placeholder this slice (intentional, plan-scoped):** the `<aside data-result-rail>` renders no Summary/Pallets/Placement/Unpacked blocks yet — Plans 03-05 fill it. The plan's objective explicitly defers the rail contents ("rail empty placeholder this slice; Plans 03–05 fill it"). This does not block the plan's goal (real pallet 0 in the persistent canvas + the carrier seam), which is fully delivered.
- **`setSel` / `setHoveredId` declared but not yet consumed:** the state setters are the carrier seam for PalletSwitcher (sel) and PlacementList (hoveredId) landing in Plans 03-05; `void`-ed to satisfy lint. `sel` IS consumed (clamped, drives `selPallet`); `hoveredId` value is not yet read. Intentional, resolved by Plans 03-05.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. The two trust boundaries (router history.state → ResultPage, react-query cache → render) are mitigated as planned: `isResultNavState` validates the crafted-state vector (T-06-03), the status guard bounds the cached body (T-06-04), and all API strings render as React text only (T-06-02 — `dangerouslySetInnerHTML` grep over ResultPage.tsx returns 0).

## Verification

- `npx vitest run` — full unit suite 26 files / 169 tests green (incl. ResultPage.test.tsx 5 tests + the updated LoadingPage tests)
- `npm run typecheck` — clean
- `npm run build && node scripts/check-code-split.mjs` — code-split gate PASSED (three only in the lazy ResultPage chunk; entry chunk three-free — queryClient/mapper/nav-state read add no three to the eager chunk)
- `npx playwright test e2e/api-poll.spec.ts e2e/result-viewer.spec.ts` — 9 tests green (deep-link redirect, populated stubbed flow, preset regression guard, happy-path real-scene assertion)
- `grep -c dangerouslySetInnerHTML src/routes/ResultPage.tsx` — 0 (T-06-02)

## Next Phase Readiness

- The carrier seam every Wave 3-5 UI slice consumes is live: `/result` renders the REAL cached payload, `sel`/`setSel` swap the rendered pallet on one persistent Canvas, `hoveredId`/`setHoveredId` await the PlacementList hover link, and the `view`/`palette`/`legend` derivations are computed and ready to feed the rail blocks.
- The rail container (`<aside data-result-rail>`) is the mount point for SummaryBlock / PalletSwitcher / PlacementList / UnpackedPanel (Plans 03-05).
- Carry-forward concern (unchanged): the InstancedMesh ~100-200 box threshold remains an estimate to verify empirically.

## Self-Check: PASSED

All 6 created/modified files present on disk; all 3 task commits (8a5d64b, 3436db7, 0ff6ec1) found in git log.

---
*Phase: 06-result-page-3d-wiring*
*Completed: 2026-06-05*
