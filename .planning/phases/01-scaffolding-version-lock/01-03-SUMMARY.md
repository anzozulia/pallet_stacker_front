---
phase: 01-scaffolding-version-lock
plan: 03
subsystem: testing
tags: [vitest, jsdom, testing-library, jest-dom, playwright, e2e, react-three-fiber, webgl, code-split, vite-preview]

# Dependency graph
requires:
  - phase: "01-01"
    provides: "version-locked package.json (vitest 4.1.8, @testing-library/react 16, jest-dom, @playwright/test 1.60, jsdom ^26), tsconfig @/* path alias, vite-tsconfig-paths"
  - phase: "01-02"
    provides: "react-router 7 SPA shell, lazy /result route hosting an empty r3f <Canvas data-testid=\"r3f-canvas\"> (the SC-2 build path the e2e smoke targets)"
provides:
  - "Vitest jsdom harness (vitest.config.ts): jsdom env, globals, setupFiles, tsconfigPaths registered for tests, e2e/** excluded"
  - "jest-dom matcher wiring (src/test/setup.ts) — toBeInTheDocument et al. available in Vitest"
  - "Passing sample unit test (src/components/Hello.tsx + Hello.test.tsx) exercising React + Testing Library + the @/ alias-in-tests seam, with zero WebGL imports"
  - "Playwright smoke harness (playwright.config.ts): webServer builds + boots vite preview on 4173 (real static build, not dev server), reuseExistingServer"
  - "Live e2e smoke (e2e/smoke.spec.ts): deep-links /result, asserts the r3f Canvas mounts in real Chromium with zero webgl/three console errors (live SC-2 + SC-3b)"
affects: [03-test-infra-ci-docker, 04-config-form, 05-api-client, 06-result-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vitest config in its own file MUST re-register tsconfigPaths() — it does NOT inherit vite.config.ts plugins; without it @/ imports break in `npm run test` (Pitfall 4)"
    - "jsdom tests are WebGL-free by construction: e2e/** excluded from Vitest and no jsdom test imports Canvas/three/r3f (Pitfall 2); the Canvas-mount assertion lives ONLY in Playwright (real Chromium)"
    - "Playwright webServer runs `npm run build && npm run preview` so the e2e smoke tests the REAL production static build (what Docker serves), not the dev server"
    - "Console-error collector registered BEFORE page.goto so no early WebGL/three error is missed; assertion filters /webgl|three/i to length 0"
    - "Playwright browser binaries are a separate download keyed to the package version (Pitfall 5): Playwright 1.60 needs Chromium build 1223; `npx playwright install chromium` provisions it"

key-files:
  created:
    - vitest.config.ts
    - src/test/setup.ts
    - src/components/Hello.tsx
    - src/components/Hello.test.tsx
    - playwright.config.ts
    - e2e/smoke.spec.ts
  modified: []

key-decisions:
  - "Used a standalone vitest.config.ts (not a test block in vite.config.ts) and re-registered tsconfigPaths() there — the plan/RESEARCH snippet shape; keeps the Tailwind plugin out of the test pipeline while preserving @/ alias resolution"
  - "Hello.test.tsx imports Hello via the `@/` alias (not a relative path) deliberately, to make the alias-in-tests seam a live, failing-if-broken assertion (Pitfall 4)"
  - "No `compilerOptions.types` change needed: importing `expect`/`test` from 'vitest' explicitly + the `@testing-library/jest-dom/vitest` side-effect import in setup.ts augment the matcher types globally, so `tsc -b` stays green without adding vitest/globals to tsconfig"

patterns-established:
  - "Wave 0 test harness is the durable feedback loop: `npm run test` (fast jsdom unit loop) + `npm run test:e2e` (preview-build Chromium smoke) are the quality gates Plan 04's CI runs"
  - "Any future 3D/WebGL behavior is verified in Playwright against the preview build, never in jsdom"

requirements-completed: []

# Metrics
duration: ~8min
completed: 2026-06-03
---

# Phase 1 Plan 03: Test Harness (Vitest jsdom + Playwright preview-build smoke) Summary

**The full Wave 0 test infrastructure: a Vitest/jsdom unit harness running a passing sample component test through the `@/` alias (with zero WebGL imports), plus a Playwright smoke that builds and boots `vite preview` and proves the r3f `<Canvas>` mounts on `/result` in real Chromium with zero WebGL console errors — the live proof of SC-2 alongside SC-3a/SC-3b.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-06-03
- **Tasks:** 2 (`type="auto"`; Task 1 `tdd="true"`) — fully autonomous, no checkpoints
- **Files:** 6 created, 0 modified

## Accomplishments
- **Vitest jsdom harness** (`vitest.config.ts`): `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, `exclude: ['**/node_modules/**', 'e2e/**']`, and `tsconfigPaths()` re-registered so `@/` resolves in tests (Pitfall 4 handled).
- **jest-dom wired** (`src/test/setup.ts`): single `import '@testing-library/jest-dom/vitest'` brings `toBeInTheDocument` and augments the matcher types.
- **Passing sample unit test** (`src/components/Hello.tsx` + `Hello.test.tsx`): renders `<Hello/>` (`<h1>Palletize</h1>`), imported via the `@/` alias, asserts the heading with a jest-dom matcher — `npm run test` exits 0 (SC-3a). No Canvas/three/r3f imported (Pitfall 2).
- **Playwright preview-build harness** (`playwright.config.ts`): `testDir: './e2e'`, `baseURL: http://localhost:4173`, `webServer.command = 'npm run build && npm run preview'` (the REAL static build, not dev server), `reuseExistingServer: !process.env.CI`, `timeout: 120_000`.
- **Live smoke** (`e2e/smoke.spec.ts`): registers a console-error collector before navigating, deep-links `/result`, asserts `locator('canvas')` visible (lazy chunk loads + r3f Canvas mounts), and asserts `/webgl|three/i` console errors === 0 — observed green in real Chromium (live SC-2 + SC-3b).

## Verification Evidence

| Criterion | Command | Result (observed this session) |
|-----------|---------|--------------------------------|
| SC-3a — Vitest sample passes | `npm run test` | exit 0 — 1 file / 1 test passed (jsdom) |
| SC-2 (live) + SC-3b — Canvas mounts, no WebGL errors | `npm run test:e2e` | exit 0 — `1 passed (4.3s)`; canvas visible, 0 webgl/three console errors, against the preview build |
| `@/` alias resolves in Vitest | `Hello.test.tsx` imports `@/components/Hello` | test passes (alias seam live) |
| Vitest never runs Playwright specs | `exclude: e2e/**` in vitest.config.ts | confirmed (1 test file discovered, e2e not run) |
| No Canvas in jsdom (Pitfall 2) | `! grep -rEq "Canvas|@react-three" src/components/Hello.test.tsx src/test/setup.ts` | clean (no token, no import) |
| Quality gates | `npm run typecheck` / `npm run lint` | typecheck exit 0; lint 0 errors (1 pre-existing router.tsx react-refresh warning, out of scope) |
| Preview build chunks | `dist/assets/*.js` | `index-BY8pcgTv.js` (entry) + `ResultPage-DS0Gw-wq.js` (lazy three chunk) — built by the webServer step |

## Task Commits

Each task committed atomically:

1. **Task 1: Vitest harness (jsdom) + jest-dom setup + passing sample unit test** — `fb42895` (test)
2. **Task 2: Playwright smoke — preview-build webServer + /result Canvas-mount assertion** — `954a5fa` (test)

**Follow-up (Task 1 file, AC hardening):** `4554dfd` (test) — reword a Hello.test.tsx comment so the literal `! grep "Canvas|@react-three"` AC passes verbatim (comment-only; behavior unchanged).

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `vitest.config.ts` — Vitest jsdom config: env, globals, setupFiles, e2e/** excluded, tsconfigPaths re-registered
- `src/test/setup.ts` — wires `@testing-library/jest-dom/vitest` matchers into Vitest
- `src/components/Hello.tsx` — trivial sample component (`<h1>Palletize</h1>`), default export, no 3D imports
- `src/components/Hello.test.tsx` — passing render-and-assert test using the `@/` alias and a jest-dom matcher
- `playwright.config.ts` — webServer builds + boots `vite preview` on 4173; Chromium; reuseExistingServer
- `e2e/smoke.spec.ts` — `/result` deep-link, canvas-visible + zero-WebGL-error assertion

## Decisions Made
- **Standalone `vitest.config.ts` with its own `tsconfigPaths()`:** matches the RESEARCH snippet and keeps the Tailwind plugin out of the test pipeline; the explicit re-registration is exactly what closes the #1 alias-breaks-in-tests gotcha (Pitfall 4).
- **Alias used in the sample test on purpose:** importing `@/components/Hello` (not `./Hello`) turns the alias-in-tests seam into a live assertion that would fail loudly if the plugin were ever dropped.
- **No tsconfig `types` change:** the explicit `vitest` imports plus the jest-dom `/vitest` side-effect import are sufficient for both runtime and `tsc -b`, so the typecheck gate stayed green without widening `compilerOptions.types`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed the matching Playwright Chromium browser binary**
- **Found during:** Task 2 (first `npm run test:e2e` run)
- **Issue:** The preview build booted and the spec started, but Chromium launch failed — `Executable doesn't exist … chromium_headless_shell-1223`. Playwright 1.60 expects browser build 1223; only older builds (1217/1169) were cached locally. Browser binaries are a separate download from the npm package (Pitfall 5) and the run cannot pass without the matching build.
- **Fix:** Ran `npx playwright install chromium` (downloaded Chrome for Testing 148 / Playwright chromium v1223 + headless shell). This is the sanctioned browser-provisioning step (NOT a package-manager package install), explicitly called out in the plan/RESEARCH as the Pitfall 5 mitigation; CI runs the same step in Plan 04.
- **Verification:** Re-ran `npm run test:e2e` → `1 passed (4.3s)`; canvas visible, zero webgl/three console errors.
- **Committed in:** No repo change (browser binaries live in the Playwright cache, outside the repo) — nothing to commit.

---

**Total deviations:** 1 auto-fixed (1 blocking — browser-binary provisioning, not a package install).
**Impact on plan:** Necessary to observe the live e2e pass; no code/scope change. The plan anticipated this exact step (Pitfall 5).

## Issues Encountered
- The informational Vite log "vite-tsconfig-paths is detected … Vite now supports resolve.tsconfigPaths natively" appears under both `npm run test` and the preview build. The plugin still works correctly (tests and alias pass); migrating to the native `resolve.tsconfigPaths` option is an optional future cleanup, not a Phase 1 concern (also noted in 01-02-SUMMARY).

## Known Stubs
- `src/components/Hello.tsx` is an intentional sample/test fixture (heading only), not a product component. It exists to exercise the unit-test pipeline + `@/` alias; real shared UI lands in Phases 4/6. Documented, not blocking.

## User Setup Required
None — no external service configuration required. (Local Playwright Chromium binary was provisioned during execution; CI provisions it via `npx playwright install --with-deps chromium` in Plan 04.)

## Next Phase Readiness
- **Plan 04 (CI + Docker):** `npm run test` and `npm run test:e2e` are the green quality gates the CI pipeline runs; CI must include the `npx playwright install --with-deps chromium` step before the e2e job (Pitfall 5). The `/result` deep-link the smoke exercises is exactly the route the nginx `try_files … /index.html` SPA fallback (D-05) must serve.
- **All later phases:** the Wave 0 feedback loop is live — fast jsdom unit tests for logic/DOM, Playwright preview-build smoke for any 3D/WebGL behavior (never jsdom).

## TDD Gate Compliance
Task 1 carried `tdd="true"`. Its commit is a `test(...)` commit; for this Wave 0 harness the "implementation" under test is the sample `Hello.tsx` component plus the harness wiring, created together and verified by an immediately-passing `npm run test` (no pre-existing feature to RED against — the harness itself is the deliverable). The sample test was observed green, satisfying the behavior the task specifies. Note: this is harness bootstrapping, not feature TDD, so a separate RED-then-GREEN commit pair is not meaningful here.

## Self-Check: PASSED

**Created files verified present:**
- vitest.config.ts, src/test/setup.ts, src/components/Hello.tsx, src/components/Hello.test.tsx, playwright.config.ts, e2e/smoke.spec.ts — FOUND

**Commits verified present in git log:**
- fb42895 (Task 1), 954a5fa (Task 2), 4554dfd (AC follow-up) — FOUND

**Live runs observed this session:** `npm run test` exit 0 (1/1 passed); `npm run test:e2e` exit 0 (`1 passed`, canvas visible, 0 webgl/three errors) against the preview build; `npm run typecheck` exit 0; `npm run lint` 0 errors.

---
*Phase: 01-scaffolding-version-lock*
*Completed: 2026-06-03*
