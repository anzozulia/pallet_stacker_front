---
phase: 01-scaffolding-version-lock
reviewed: 2026-06-03T00:00:00Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - package.json
  - index.html
  - vite.config.ts
  - vitest.config.ts
  - tsconfig.json
  - tsconfig.app.json
  - tsconfig.node.json
  - eslint.config.js
  - .prettierrc
  - .prettierignore
  - .gitignore
  - .dockerignore
  - src/main.tsx
  - src/router.tsx
  - src/routes/ConfigurePage.tsx
  - src/routes/ResultPage.tsx
  - src/components/Hello.tsx
  - src/components/Hello.test.tsx
  - src/test/setup.ts
  - src/vite-env.d.ts
  - src/styles.css
  - e2e/smoke.spec.ts
  - playwright.config.ts
  - scripts/check-code-split.mjs
  - Dockerfile
  - nginx.conf
  - .github/workflows/ci.yml
  - .husky/pre-commit
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This is foundational scaffolding for the Palletize SPA. Version pins are correct and match CLAUDE.md exactly: React `19.2.7`, `@react-three/fiber 9.6.1`, `@react-three/drei 10.7.7`, `three 0.184.0` pinned exactly with no caret, `@types/three 0.184.1` in lockstep. The 3D trio is correctly held to React 19 ranges. No hardcoded secrets, no dangerous functions, no injection surface (this is config + an empty app shell). The dev-proxy / build-time-env seam separation is clean, nginx has the mandatory `try_files` SPA fallback, and the image correctly uses `nginx-unprivileged` on 8080.

However, the central deliverable of this phase's deployment rung — the **code-split guarantee that `three`/r3f/drei never leak into the entry chunk** — has its verification script (`scripts/check-code-split.mjs`) written but wired into _nothing_: no npm script, no CI step, no Playwright hook. The guarantee is therefore unenforced and will silently regress. Additionally, several config-consistency gaps mean parts of the toolchain (vitest/playwright config, the check script itself) are never type-checked, and CI never exercises the Docker/nginx path the phase establishes.

## Critical Issues

### CR-01: Code-split assertion script is dead — D-04 guarantee is never enforced

**File:** `scripts/check-code-split.mjs` (entire file); absence in `package.json:6-16` and `.github/workflows/ci.yml`
**Issue:** `check-code-split.mjs` is the only mechanism that enforces the phase's stated goal: keep `three`/r3f/drei out of the entry (Configure) chunk and confine them to the lazy `/result` chunk. A repo-wide grep confirms the script is referenced by **no** npm script and **no** CI job. It is never executed. The build (`tsc -b && vite build`) succeeds and CI passes green even if a future import pulls `three` into the entry bundle — exactly the regression the script exists to catch. A guard that never runs provides zero protection; the lazy-load architecture (`src/router.tsx:7`) can be defeated by an accidental top-level import with no signal.
**Fix:** Wire the check into the build/CI gate so it runs after every `vite build`. For example, add a script and call it in CI after the build step:

```json
// package.json scripts
"build": "tsc -b && vite build && node scripts/check-code-split.mjs",
```

or, to keep `build` pure, add a dedicated CI step:

```yaml
# .github/workflows/ci.yml, after `- run: npm run build`
- run: node scripts/check-code-split.mjs
```

Confirm it actually fails the job when `three` is in `index-*.js` (e.g., by temporarily importing `ResultPage` eagerly in `router.tsx` and watching CI go red).

## Warnings

### WR-01: `vitest.config.ts`, `playwright.config.ts`, and `scripts/*.mjs` are not type-checked

**File:** `tsconfig.node.json:23`, `tsconfig.app.json:31`
**Issue:** `tsconfig.app.json` includes only `src`; `tsconfig.node.json` includes only `["vite.config.ts"]`. Nothing in the project references `vitest.config.ts`, `playwright.config.ts`, or `scripts/check-code-split.mjs`. Therefore `tsc -b` (the `typecheck` and `build` gate) never type-checks them. A type error in the test runner config, the e2e config, or the build-gate script will not be caught by `npm run typecheck` or CI's `tsc -b` step — it surfaces only at runtime when the tool happens to run. For a phase whose whole job is a trustworthy toolchain, the toolchain config files are outside the type net.
**Fix:** Extend the node-project include set to cover all build/test tooling TS files:

```jsonc
// tsconfig.node.json
"include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
```

(`.mjs` is JS, not type-checked by `tsc` regardless; if you want it checked, add `// @ts-check` at the top of `check-code-split.mjs`.)

### WR-02: CI never builds the Docker image nor exercises the nginx SPA fallback / `VITE_API_URL` seam

**File:** `.github/workflows/ci.yml:9-35`
**Issue:** This phase delivers the Docker + nginx deployment rung (`Dockerfile`, `nginx.conf`), and CLAUDE.md flags `try_files … /index.html` as "the #1 self-host gotcha." Yet CI builds only the static bundle (`npm run build`) and runs Playwright against `vite preview`, never against nginx. The `Dockerfile`/`nginx.conf`/`VITE_API_URL` build-arg coherence is never validated in CI, so a broken `nginx.conf` (e.g., a future edit dropping the `try_files` fallback) or a Dockerfile build failure ships undetected. Note also the e2e smoke (`e2e/smoke.spec.ts`) deep-links `/result` against `vite preview`, which has its own SPA fallback — so it does **not** actually prove the nginx fallback works, despite the comment claiming it "pre-validates the route Plan 04's nginx SPA fallback must serve."
**Fix:** Add a CI job that builds the image and smoke-tests the served route through nginx, e.g.:

```yaml
docker:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: docker build --build-arg VITE_API_URL=http://example.test -t palletize .
    - run: docker run -d -p 8080:8080 --name palletize palletize
    - run: |
        sleep 3
        # deep-link refresh must 200 via try_files, not 404
        code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/result)
        test "$code" = "200"
```

### WR-03: No Node version pin file despite hardcoded `node 22` in Docker and CI

**File:** `Dockerfile:4`, `.github/workflows/ci.yml:15,29` (no `.nvmrc` / `.node-version` present)
**Issue:** Both the Dockerfile (`node:22-alpine`) and CI (`node-version: '22'`) hardcode Node 22, but there is no `.nvmrc` or `.node-version` and no `engines` field in `package.json`. Local contributors using `nvm`/`fnm`/Volta get whatever Node is active, which can diverge from the 22-LTS line that build/CI assume — a classic "works on CI, fails locally" (or vice-versa) source. `package.json:1-59` has no `"engines"` constraint either, so `npm ci` will not warn on a mismatched runtime.
**Fix:** Add an `.nvmrc` containing `22` (and optionally `"engines": { "node": ">=22 <23" }` in `package.json`), and point CI at it: `node-version-file: '.nvmrc'`.

### WR-04: `typecheck` passes `--noEmit` to `tsc -b`, which is a no-op/contradictory flag

**File:** `package.json:10`
**Issue:** `"typecheck": "tsc -b --noEmit"`. In build mode (`-b`), TypeScript controls emit via project settings and treats `--noEmit` on the command line inconsistently (it is already redundant because both `tsconfig.app.json:14` and `tsconfig.node.json` set `"noEmit": true`). Depending on the TS 6.x build, `tsc -b --noEmit` either ignores the flag or warns. Meanwhile `"build": "tsc -b && vite build"` relies on the same `noEmit: true` so `tsc -b` emits nothing and `vite build` does the actual bundling — fine, but it means `tsc -b` here is purely a type-check pass whose `.tsbuildinfo` caching can mask errors across runs. The redundant/ineffective `--noEmit` on the typecheck script is misleading about intent.
**Fix:** Drop the redundant flag since `noEmit` is already set in the project files: `"typecheck": "tsc -b"`. If you want to be explicit about not trusting stale build info in the gate, use `"typecheck": "tsc -b --force"`.

### WR-05: Playwright `reuseExistingServer` can smoke-test a stale `dist/`

**File:** `playwright.config.ts:10-17`
**Issue:** `webServer.command` is `npm run build && npm run preview` with `reuseExistingServer: !process.env.CI`. Locally, if a `vite preview` is already listening on 4173 (from a previous run), Playwright reuses it and **skips the rebuild entirely** — so `npm run test:e2e` can assert against a stale `dist/` that predates the change under test, producing false-green smoke runs. CI is unaffected (`reuseExistingServer` is false there), but the local inner loop is misleading.
**Fix:** Document the staleness caveat, or bind preview to an ephemeral/unique port, or drop `reuseExistingServer` so each run rebuilds. At minimum, ensure `npm run build` runs before reuse, e.g. split build out as a separate `globalSetup` rather than folding it into the reusable `webServer.command`.

## Info

### IN-01: Inconsistent `target`/`lib` between app and node tsconfigs

**File:** `tsconfig.app.json:3-5` (`ES2022`) vs `tsconfig.node.json:3-4` (`ES2023`)
**Issue:** The browser app targets `ES2022` while the node/build config targets `ES2023`. Not a bug (they compile different file sets for different runtimes), but the divergence is undocumented and easy to mistake for an oversight. Node 22 supports ES2023; the app intentionally stays at ES2022 for browser reach — worth a one-line comment so a future contributor doesn't "fix" the mismatch by aligning them.
**Fix:** Add a brief comment in each tsconfig noting the deliberate target split (browser vs node runtime), or align if there is no real reason to differ.

### IN-02: `react-refresh/only-export-components` warning will fire on `src/router.tsx`

**File:** `eslint.config.js:29`, `src/router.tsx:9`
**Issue:** The rule `react-refresh/only-export-components` (warn) flags modules that export non-component values alongside components. `src/router.tsx` exports `router` (a non-component object) and is matched by `**/*.{ts,tsx}`. With `allowConstantExport: true` a `const` export is permitted, so `export const router` is likely tolerated — but route/config modules that later export loaders or actions will trip warnings. Confirm `npm run lint` is clean on the current tree; if it warns, the lint gate noise starts here.
**Fix:** Verify `npm run lint` reports zero warnings on `router.tsx`. If it warns, scope the rule to `src/**/*.tsx` component files or disable it for `router.tsx`.

### IN-03: `.dockerignore` excludes `*.md` but not `.planning/` or `design/`

**File:** `.dockerignore:1-7`
**Issue:** The build stage does `COPY . .` then `npm run build`. `.dockerignore` excludes `node_modules`, `dist`, `e2e`, `*.md`, etc., but not the `.planning/` directory, `design/` mockups, `.claude/`, or `public/fonts` provenance — all copied into the build image layer. Harmless to the final `serve` stage (only `/app/dist` is copied forward), but it bloats the build context and build-stage layer, and ships planning/design artifacts into the intermediate image cache.
**Fix:** Add `.planning`, `design`, `.claude`, `.github`, `.husky` to `.dockerignore` to slim the build context.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
