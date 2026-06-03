---
phase: 01-scaffolding-version-lock
plan: 02
subsystem: app-shell-routing
tags: [react-router7, spa, react-lazy, code-split, react-three-fiber, canvas, directory-skeleton, eslint]

# Dependency graph
requires:
  - "01-01: version-locked package.json + lockfile, Vite config (@/ alias + Tailwind v4), TS project refs, src/styles.css, index.html referencing /src/main.tsx"
provides:
  - "App entry (src/main.tsx): createRoot + RouterProvider + @/styles.css import"
  - "react-router 7 SPA routing (src/router.tsx): createBrowserRouter with / eager (ConfigurePage) and /result React.lazy behind Suspense"
  - "Lazy /result route (src/routes/ResultPage.tsx) hosting an empty r3f <Canvas> in a 100dvh wrapper (SC-2 build path)"
  - "Signposted directory skeleton (components/features/lib/api/types) with .gitkeep only (D-01/D-02)"
  - "Build-time code-split assertion (scripts/check-code-split.mjs): fails the build if three leaks into the entry chunk (D-04/T-1-03)"
affects: [03-test-infra-ci-docker, 04-config-form, 05-api-client, 06-result-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-router 7 SPA/library mode: createBrowserRouter + RouterProvider, imported from `react-router` (NOT react-router-dom)"
    - "Route-level code-split: /result via React.lazy(() => import('@/routes/ResultPage')) with <Suspense> wrapping the lazy element AT the route definition — keeps three/r3f/drei out of the entry chunk"
    - "Empty r3f <Canvas> requires an explicit-height parent (100dvh); a zero-height parent yields a 0x0 canvas"
    - "Build-gate assertion script (node .mjs) reads dist/assets/*.js and fails if three markers appear in the index-* entry chunk"
    - "ESLint flat config: separate node-globals block for scripts/*.mjs + root config files; eslint-config-prettier stays last"

key-files:
  created:
    - src/main.tsx
    - src/router.tsx
    - src/routes/ConfigurePage.tsx
    - src/routes/ResultPage.tsx
    - src/components/.gitkeep
    - src/features/.gitkeep
    - src/lib/.gitkeep
    - src/api/.gitkeep
    - src/types/.gitkeep
    - scripts/check-code-split.mjs
  modified:
    - eslint.config.js

key-decisions:
  - "Folded the app shell into router.tsx (no separate src/App.tsx) per D-01's thin/signposted intent — the optional App.tsx would be a speculative file with no shell logic in Phase 1"
  - "Code-split markers chosen as BufferGeometry + WebGLRenderer (both required) — characteristic of the three engine being bundled, robust against false positives from a stray string"
  - "Extended eslint.config.js with a node-globals block for scripts/*.mjs rather than disabling no-undef — keeps the lint gate genuinely green for build tooling"

patterns-established:
  - "Lazy 3D route is the code-split boundary: any future heavy 3D/viewer code belongs behind the /result lazy import, never in the eager / route"
  - "scripts/check-code-split.mjs is the durable build gate that future phases must keep passing as the viewer grows"

requirements-completed: []

# Metrics
duration: ~12min
completed: 2026-06-03
---

# Phase 1 Plan 02: App Shell + Routing + Lazy 3D Canvas Summary

**The thinnest real end-to-end client slice: react-router 7 SPA routing with an eager Configure page at `/` and a `React.lazy`-loaded Result page at `/result` hosting an empty react-three-fiber `<Canvas>`, plus the signposted directory skeleton — with a build-time assertion proving the heavy three/r3f/drei trio lands ONLY in the lazy `/result` chunk and stays out of the initial Configure bundle.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-03
- **Tasks:** 2 (both `type="auto"`, fully autonomous — no checkpoints)
- **Files:** 10 created, 1 modified

## Accomplishments
- **App entry wired** (`src/main.tsx`): `createRoot` from `react-dom/client` + `<RouterProvider>` inside `<StrictMode>`, importing `@/styles.css` (exercises the path-alias + styling seams from Plan 01)
- **react-router 7 SPA routing** (`src/router.tsx`): `createBrowserRouter` imported from `react-router` (the v7 merged package — never `react-router-dom`); `/` → eager `<ConfigurePage>`, `/result` → `lazy(() => import('@/routes/ResultPage'))` behind `<Suspense>` (D-03)
- **Empty r3f Canvas on the lazy route** (`src/routes/ResultPage.tsx`): `<Canvas data-testid="r3f-canvas">` with a single `<ambientLight>` inside a `100dvh` wrapper (SC-2 build path; Plan 03's Playwright smoke asserts the live mount)
- **Code-split proven** (`scripts/check-code-split.mjs`): `npm run build` emits two chunks — `index-*.js` (285 kB entry, three-free) and `ResultPage-*.js` (879 kB lazy, contains three/r3f/drei); the script exits 0, confirming three is absent from the entry chunk (D-04 / threat T-1-03 mitigated)
- **Signposted directory skeleton** (`src/components|features|lib|api|types`): `.gitkeep` only, no speculative logic files (D-01/D-02)
- **All quality gates green:** `npm run typecheck` exit 0, `npm run lint` exit 0, `npm run build` exit 0, code-split assertion exit 0

## Verification Evidence

| Criterion | Result |
|-----------|--------|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (1 expected react-refresh warning on router.tsx; 0 errors) |
| `npm run build` | exit 0 — two chunks emitted |
| `node scripts/check-code-split.mjs` | exit 0 — entry chunk `index-BY8pcgTv.js` three-free; three in lazy `ResultPage-DS0Gw-wq.js` |
| react-router import surface | `from 'react-router'`; `! grep react-router-dom` clean (D-03) |
| ResultPage statically imported? | No — only via `lazy(() => import(...))` (verified `! grep '^import .*ResultPage' src/router.tsx`) |
| Signposted dirs | `.gitkeep` in all 5; no stray logic files (D-01/D-02) |

## Task Commits

1. **Task 1: Signposted dir skeleton + react-router 7 SPA shell** — `eee0940` (feat)
2. **Task 2: Lazy /result r3f Canvas + build-time code-split assertion** — `e4af9ee` (feat)

## Decisions Made
- **No separate `src/App.tsx`:** the plan listed it as optional ("or fold into router"). Folding the shell into `router.tsx` honors D-01's thin/signposted intent — a standalone App.tsx with no shell logic in Phase 1 would be a speculative file (the same principle as D-02's "no placeholder logic files").
- **Code-split markers `BufferGeometry` + `WebGLRenderer` (both required):** characteristic of the three engine actually being bundled into a chunk; requiring both avoids false positives from an incidental substring.
- **ESLint config extended (not rule-disabled):** the new `.mjs` script uses Node globals (`process`, `console`) that the browser-globals block didn't cover. Added a dedicated `globals.node` block for `scripts/**` + root config files rather than sprinkling `no-undef` disables — the lint gate stays genuinely green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint flat config lacked Node globals for the new build script**
- **Found during:** Task 2 (after adding `scripts/check-code-split.mjs`)
- **Issue:** The flat ESLint config (from Plan 01) only declared `globals.browser` for `**/*.{ts,tsx}`. The new Node `.mjs` script tripped 6 `no-undef` errors (`process`, `console`), turning the `npm run lint` gate red — a blocking issue caused directly by this task's file.
- **Fix:** Added a dedicated config block in `eslint.config.js` setting `languageOptions.globals = globals.node` for `scripts/**/*.{js,mjs,cjs}` and root `*.{js,mjs,cjs}` files, placed before the `prettier` config (which must remain last).
- **Files modified:** `eslint.config.js`
- **Commit:** `e4af9ee` (committed with Task 2)

## Known Stubs
- `src/routes/ConfigurePage.tsx` is an intentional eager placeholder (heading only) — the real Configure form lands in Phase 4 (per D-01). It must NOT import three (keeps the entry chunk three-free); this is a deliberate, documented stub, not incomplete work.
- `src/routes/ResultPage.tsx` renders an empty `<Canvas>` (single light, no content) by design — Phase 6 adds the real 3D viewer content. This is the Phase 1 walking-skeleton tracer, not a stub blocking the plan goal.

## Notes for Next Plans
- **Plan 03 (test infra):** the `data-testid="r3f-canvas"` attribute and the `/result` route are ready for the Playwright smoke test (`e2e/smoke.spec.ts`) that asserts the live Canvas mount with no WebGL console errors (SC-2 / SC-3b). Do NOT unit-test the Canvas in jsdom (no WebGL).
- **Plan 04 (nginx/Docker):** the `/` vs `/result` client-route boundary established here is exactly what the nginx `try_files … /index.html` SPA fallback (D-05) must handle on deep-link refresh.
- **`scripts/check-code-split.mjs` is a durable build gate:** keep it passing as the viewer grows — any heavy 3D code must stay behind the `/result` lazy import.
- The Vite log note "vite-tsconfig-paths is detected … Vite now supports resolve.tsconfigPaths natively" is informational only (plugin still works); migrating to the native option is an optional future cleanup, not a Phase 1 concern.

## Self-Check: PASSED

**Created files verified present:**
- src/main.tsx, src/router.tsx, src/routes/ConfigurePage.tsx, src/routes/ResultPage.tsx — FOUND
- src/components/.gitkeep, src/features/.gitkeep, src/lib/.gitkeep, src/api/.gitkeep, src/types/.gitkeep — FOUND
- scripts/check-code-split.mjs — FOUND

**Commits verified present in git log:**
- eee0940 (Task 1), e4af9ee (Task 2) — FOUND

**Gates re-verified this session:** typecheck 0, lint 0, build 0, code-split assertion 0.

---
*Phase: 01-scaffolding-version-lock*
*Completed: 2026-06-03*
