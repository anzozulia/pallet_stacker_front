---
phase: quick-260618-eg4
plan: 01
subsystem: docs-and-deploy-config
tags: [docs, branding, docker, ci, self-host]
requires: []
provides:
  - README.md (open-source front door)
  - .env.example (build-time VITE_API_URL doc)
  - CONTRIBUTING.md (dev loop + full pre-PR gate)
  - docker-compose.yml (build-from-source 8080:8080)
  - public/favicon.svg (brand glyph)
  - CI code-split gate after build
affects:
  - index.html
  - LICENSE
  - package.json
  - .dockerignore
  - .github/workflows/ci.yml
tech-stack:
  added: []
  patterns:
    - "Brand string 'Palletize' retained ONLY in localStorage STORAGE_KEY + its test + e2e localStorage usage + frozen design/*.html"
key-files:
  created:
    - README.md
    - .env.example
    - CONTRIBUTING.md
    - docker-compose.yml
    - public/favicon.svg
  modified:
    - index.html
    - LICENSE
    - package.json
    - .dockerignore
    - .github/workflows/ci.yml
decisions:
  - "No README badges — no git remote configured (STATE.md Deferred Items), so badges would point at nonexistent services."
  - "package-lock.json 'name' fields left as 'palletize' (non-brand-facing build metadata; no npm install run, lockfile untouched)."
  - "Docker smoke image tagged pallet-stacker:eg4-check (throwaway) then removed; tag name immaterial for the build-still-works check."
metrics:
  duration: ~9min
  completed: 2026-06-18
---

# Phase quick-260618-eg4 Plan 01: Demo Deploy Readiness (Open-Source / Self-Host) Summary

Made Pallet Packer demo-deploy ready as an open-source, self-hostable project: added the
missing front-door docs (README, .env.example, CONTRIBUTING, docker-compose), branded the
favicon + head meta, rebranded LICENSE/package.json to "Pallet Packer", and hardened the
build context (.dockerignore) and CI (code-split gate after build) — DOCS + CONFIG only,
no runtime/src/Dockerfile/nginx/dependency changes.

## What Was Built

### Task 1 — Open-source docs (commit 1992610)
- **README.md** — all 15 sections in order: title/tagline, what-it-is (frontend that
  needs an external packing API), demo presets, features, Docker quick start (exact
  build/run commands), docker compose quick start, configuration (build-time VITE_API_URL,
  fail-loud guard, CORS, origin-only + submit-then-poll contract), local dev, scripts
  table, testing, tech stack, project structure, deployment (SPA fallback mandatory,
  non-root 8080, immutable hashed assets, rebuild-to-reconfigure), contributing, license.
  No badges.
- **.env.example** — documents VITE_API_URL as build-time only, required for prod, not
  needed for `npm run dev`; example line `VITE_API_URL=https://packerapi.anzozulia.xyz`.
- **CONTRIBUTING.md** — prereqs (Node 22, npm ci), dev loop, the full pre-PR gate as a
  single fenced command, the code-split rule (config/non-viewer must never import
  three/r3f/drei), conventional commits, husky + lint-staged.
- **docker-compose.yml** — single build-from-source service, `build.args.VITE_API_URL:
  ${VITE_API_URL:-https://packerapi.anzozulia.xyz}`, maps `8080:8080`, restart
  unless-stopped, no obsolete `version:` key.

### Task 2 — Favicon + head meta + rebrand (commit 4f0c8c4)
- **public/favicon.svg** — hand-authored, dependency-free SVG mirroring the ConfigForm
  header glyph: 32×32 rounded square with a `#6d63f5`→`#4f46e5` linearGradient (top-left
  to bottom-right ≈150°) and a white (90% opacity) inset rounded border.
- **index.html** — added favicon link, description meta, theme-color (`#4f46e5`); kept
  charset/viewport/title ("Pallet Packer").
- **LICENSE** — "Palletize contributors" → "Pallet Packer contributors"; MIT body intact.
- **package.json** — name `palletize` → `pallet-packer`; added description + license
  "MIT". Dependencies/devDependencies/scripts/version/lint-staged untouched; no npm install.

### Task 3 — Build context + CI hardening (commit d7d2156)
- **.dockerignore** — kept originals (node_modules, dist, .git, playwright-report,
  coverage, e2e, *.md); added `.planning`, `.claude`, `design`, `test-results`, `.husky`,
  `.github`, `*.tsbuildinfo`, `.DS_Store` (threat T-eg4-01: keep planning/tooling/CI
  context out of the build image).
- **.github/workflows/ci.yml** — added `- run: node scripts/check-code-split.mjs`
  immediately after `npm run build` in build-and-test (threat T-eg4-03); e2e job and all
  other config untouched.

## Full Gate Results

| Step | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | PASS (exit 0) |
| Lint | `npm run lint` | PASS — 0 errors, 1 pre-existing warning (`src/router.tsx` react-refresh; out of scope, unrelated to this plan) |
| Unit/component tests | `npm run test` | PASS — 224 passed (33 files), as expected |
| Build | `npm run build` | PASS — `dist/` emitted (the >500kB chunk warning is the expected ResultPage three chunk) |
| Code-split gate | `node scripts/check-code-split.mjs` | PASS — entry chunk three-free (`index-C14Oncwp.js`); three lives in lazy `ResultPage-*.js` |
| E2E | `npm run test:e2e` | PASS — 14 passed (Playwright chromium ran locally against the preview build) |
| Docker smoke | `docker build --build-arg VITE_API_URL=https://packerapi.anzozulia.xyz ...` | PASS — image built with new .dockerignore/files; tagged `pallet-stacker:eg4-check`, then removed via `docker rmi` |

### Brand consistency scan
`grep -rin palletize` (ts/tsx/html/json/md/yml/yaml, excluding node_modules/.planning/.git)
shows ONLY the expected hits — no brand-facing "Palletize" remains:
- `src/lib/config-persist.ts` + `src/lib/config-persist.test.ts` — STORAGE_KEY `'palletize:config:v1'` (intentionally retained)
- `e2e/api-poll.spec.ts`, `e2e/result-viewer.spec.ts`, `e2e/config-persist.spec.ts` — localStorage key usage
- `design/loading.html`, `design/result.html`, `design/config.html` — frozen mockups
- `package-lock.json` — non-brand-facing build metadata (out of scope; lockfile untouched)
- `CLAUDE.md` — project-instruction config (not a brand-facing deliverable; left as-is)

README/CONTRIBUTING/.env.example/docker-compose.yml/index.html/LICENSE/package.json all
say "Pallet Packer" / "pallet-packer".

## Deviations from Plan

None — plan executed exactly as written.

Note: husky/lint-staged ran Prettier on the staged Markdown/JSON during the Task 1 and
Task 2 commits (auto table-alignment in README, formatting of package.json). This is the
project's configured pre-commit behavior, not a content deviation.

## Constraints Honored

- src/ runtime code, Dockerfile, nginx.conf: UNCHANGED (only the 10 planned files committed).
- STORAGE_KEY `'palletize:config:v1'` and its test: UNCHANGED.
- design/*.html: UNTOUCHED.
- Dependency versions / package-lock.json: UNCHANGED (no npm install/ci run that rewrites the lockfile).
- No README badges (no git remote configured).

## Commits

- `1992610` docs(260618-eg4): add README, .env.example, CONTRIBUTING, docker-compose
- `4f0c8c4` feat(260618-eg4): brand favicon + head meta, rebrand LICENSE and package.json
- `d7d2156` chore(260618-eg4): harden build context + add CI code-split gate

## Self-Check: PASSED

- README.md, .env.example, CONTRIBUTING.md, docker-compose.yml, public/favicon.svg: FOUND
- index.html, LICENSE, package.json, .dockerignore, .github/workflows/ci.yml: FOUND (modified)
- Commits 1992610, 4f0c8c4, d7d2156: FOUND in git log
