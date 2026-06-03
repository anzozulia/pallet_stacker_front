---
phase: 01-scaffolding-version-lock
plan: 01
subsystem: infra
tags: [vite, react19, typescript, three, react-three-fiber, drei, tailwind4, eslint, prettier, version-lock, npm]

# Dependency graph
requires: []
provides:
  - Version-locked package.json + committed package-lock.json resolving the React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / three 0.184.0 quartet with zero peer conflicts
  - TypeScript project-references config (tsconfig solution + app + node) with the @/* -> src/* path alias
  - vite.config.ts wiring react() + tailwindcss() + tsconfigPaths() plugins and the /api dev proxy to https://packerapi.anzozulia.xyz
  - Typed build-time VITE_API_URL seam via src/vite-env.d.ts (declared, not yet consumed)
  - Tailwind v4 CSS-first styling with self-hosted Inter + JetBrains Mono fonts and the #4f46e5 accent token
  - Flat ESLint (eslint 10 / typescript-eslint 8) + Prettier quality gate (typecheck + lint both exit 0)
affects: [02-app-shell-routing, all-later-phases]

# Tech tracking
tech-stack:
  added:
    - react@19.2.7 / react-dom@19.2.7
    - three@0.184.0 (exact, no caret)
    - "@react-three/fiber@9.6.1"
    - "@react-three/drei@10.7.7"
    - vite@8 + "@vitejs/plugin-react@6"
    - typescript@~6
    - tailwindcss@4 + "@tailwindcss/vite@4"
    - eslint@10 + typescript-eslint@8 + prettier@3
    - vite-tsconfig-paths
  patterns:
    - "Hand-built package.json with EXACT pins (no npm create vite) to honor the r3f 9 react <19.3 peer cap and pin three without caret"
    - "TypeScript project references (solution tsconfig -> app + node) with bundler moduleResolution and noEmit"
    - "Two distinct API seams kept separate: dev-only /api proxy (npm run dev) vs build-time baked VITE_API_URL (import.meta.env)"
    - "Tailwind v4 CSS-first: @import tailwindcss + @theme tokens in CSS, no tailwind.config.js / postcss.config.js"
    - "Self-hosted fonts via @font-face absolute /fonts/*.woff2 URLs (no Google Fonts link)"
    - "Flat ESLint config with eslint-config-prettier LAST to disable conflicting stylistic rules"

key-files:
  created:
    - package.json
    - package-lock.json
    - .gitignore
    - index.html
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.node.json
    - vite.config.ts
    - src/vite-env.d.ts
    - src/styles.css
    - public/fonts/Inter.woff2
    - public/fonts/JetBrainsMono.woff2
    - eslint.config.js
    - .prettierrc
    - .prettierignore
  modified: []

key-decisions:
  - "Hand-authored package.json instead of npm create vite to avoid ^latest pulling react >=19.3 (violates r3f 9 peer cap)"
  - "three pinned to exactly 0.184.0 (no caret) since three ships breaking changes on minor 0.x bumps"
  - "VITE_API_URL typed but NOT consumed in Phase 1 (no API client until Phase 5) — only the type seam is established"
  - "Tailwind v4 @theme limited to fonts + #4f46e5 accent only; full mockup palette deferred to Phases 4/6 (D-07)"
  - "Optional react-compiler peers (babel-plugin-react-compiler, @rolldown/plugin-babel) deliberately NOT installed"

patterns-established:
  - "Version quartet (React 19.2.x / r3f 9 / drei 10 / three 0.184.0 exact) treated as a single locked unit, never auto-upgraded"
  - "package-lock.json is the authoritative supply-chain pin; CI uses npm ci against it (never npm install)"
  - "@/ path alias resolves in both Vite (tsconfigPaths plugin) and TypeScript (tsconfig.app.json paths)"

requirements-completed: []

# Metrics
duration: ~35min (across original + continuation session)
completed: 2026-06-03
---

# Phase 1 Plan 01: Scaffolding + Version Lock Summary

**Version-locked toolchain foundation: hand-built package.json pinning the React 19.2.7 / r3f 9.6.1 / drei 10.7.7 / three 0.184.0 quartet (three exact, no caret) with a clean lockfile, TS project references, Vite config (/api proxy + build-time env seam + Tailwind v4 + @/ aliases), self-hosted-font CSS-first styling, and a flat ESLint + Prettier quality gate.**

## Performance

- **Duration:** ~35 min (original implementation + continuation finalization)
- **Completed:** 2026-06-03
- **Tasks:** 4 (3 implementation + 1 blocking human-verify checkpoint)
- **Files modified:** 15 created

## Accomplishments
- Hand-built `package.json` + committed `package-lock.json` resolving the full version quartet plus supporting libs with **zero peer-dependency conflicts** (SC-1)
- TypeScript project references (solution + app + node) with the `@/* -> src/*` alias; `npm run typecheck` exits 0
- `vite.config.ts` registers `react()` + `tailwindcss()` + `tsconfigPaths()` and proxies `/api` to `https://packerapi.anzozulia.xyz` (`changeOrigin: true`, `secure: true`) (SC-5)
- Build-time `VITE_API_URL` seam typed on `ImportMetaEnv` via `src/vite-env.d.ts` (declared, not yet consumed — D-16)
- Tailwind v4 CSS-first styling: `@import "tailwindcss"` + two `@font-face` blocks for self-hosted Inter / JetBrains Mono + minimal `@theme` (fonts + `#4f46e5` accent only) — no `tailwind.config.js`, no `postcss.config.js`, no Google Fonts link (D-06/D-07/D-08)
- Flat ESLint (eslint 10 / typescript-eslint 8) with `eslint-config-prettier` last; `npm run lint` exits 0

## Version Quartet Pins (the locked unit)

| Package | Pinned version | Caret? |
|---------|----------------|--------|
| react / react-dom | `19.2.7` | no (capped <19.3 for r3f peer) |
| three | `0.184.0` | **no caret (exact)** |
| @react-three/fiber | `9.6.1` | — |
| @react-three/drei | `10.7.7` | — |

## Task Commits

Each implementation task was committed atomically:

1. **Task 1: Hand-build package.json with exact pins + clean install** - `1ad3d8a` (feat)
2. **Task 2: Wire TS project refs, Vite config (proxy + env + Tailwind + aliases), env-type seam** - `c71c575` (feat)
3. **Task 3: Tailwind v4 CSS-first styling, self-hosted fonts, flat ESLint + Prettier** - `000b1a3` (feat)

**Task 4 (checkpoint:human-verify, gate=blocking-human):** Confirm clean lockfile resolution + correct quartet pinning — **RESOLVED: human-approved** (supply-chain T-1-SC gate). User confirmed clean `npm ci`, correct quartet pins, no peer warnings.

## Files Created/Modified
- `package.json` - Exact-pinned deps + scripts (dev/build/preview/typecheck/lint/format/test/test:e2e/prepare) + lint-staged block
- `package-lock.json` - Authoritative committed lockfile (supply-chain pin)
- `.gitignore` - node_modules, dist, coverage, playwright-report, .DS_Store
- `index.html` - Root `#root` div + module script entry
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` - Project references; app config has `@/* -> src/*`
- `vite.config.ts` - react + tailwindcss + tsconfigPaths plugins; `/api` -> HTTPS API proxy
- `src/vite-env.d.ts` - Typed `VITE_API_URL` on `ImportMetaEnv` (build-time seam)
- `src/styles.css` - Tailwind import + `@theme` tokens + self-hosted `@font-face`
- `public/fonts/Inter.woff2`, `public/fonts/JetBrainsMono.woff2` - Self-hosted variable fonts
- `eslint.config.js` - Flat config, prettier last
- `.prettierrc`, `.prettierignore` - Formatting defaults + ignore list

## Decisions Made
- Hand-authored `package.json` (no `npm create vite`) to prevent `^latest` pulling `react >=19.3`, which would break the r3f 9 `<19.3` peer cap
- `three` pinned exactly (`0.184.0`, no caret) since three ships breaking changes on minor `0.x` bumps
- `VITE_API_URL` typed but not consumed in Phase 1 (no API client until Phase 5) — only the type seam established (D-16)
- `@theme` kept minimal (fonts + accent); full mockup palette deferred to Phases 4/6 (D-07)
- Optional react-compiler peers (`babel-plugin-react-compiler`, `@rolldown/plugin-babel`) deliberately omitted (plugin-react 6 marks them optional)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The blocking human-verify checkpoint (T-1-SC supply-chain gate) was reached as designed; the human approved a clean lockfile resolution, allowing the plan to finalize.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scaffold is healthy: `npm ci && npm run typecheck && npm run lint` all pass cleanly
- Path aliases, dev `/api` proxy, build-time env seam, Tailwind v4 styling, and the flat ESLint quality gate are all wired
- Ready for Plan 02 (app shell + routing): `src/main.tsx`, root component, and the Configure -> Result routes. The `index.html` already references `/src/main.tsx`, which Plan 02 creates.

## Self-Check: PASSED

**Created files verified present:**
- package.json, package-lock.json, vite.config.ts, src/vite-env.d.ts, src/styles.css, eslint.config.js, tsconfig.app.json, public/fonts/Inter.woff2, public/fonts/JetBrainsMono.woff2 — all FOUND

**Commits verified present in git log:**
- 1ad3d8a (Task 1), c71c575 (Task 2), 000b1a3 (Task 3) — all FOUND

**Quality gate:** `npm run typecheck` exit 0, `npm run lint` exit 0 (re-verified this session).

---
*Phase: 01-scaffolding-version-lock*
*Completed: 2026-06-03*
