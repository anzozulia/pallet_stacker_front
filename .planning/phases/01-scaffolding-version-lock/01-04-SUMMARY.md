---
phase: 01-scaffolding-version-lock
plan: 04
subsystem: infra
tags: [docker, nginx, github-actions, ci, husky, lint-staged, spa-fallback, vite, license]

# Dependency graph
requires:
  - phase: 01-03-scaffolding-version-lock
    provides: Vitest jsdom unit harness + Playwright preview-build e2e smoke (test:e2e script), package.json scripts (typecheck/lint/test/build)
provides:
  - Multi-stage Docker image (node:22-alpine build → nginxinc/nginx-unprivileged:alpine serve on UID 101 / port 8080)
  - nginx SPA deep-link fallback (try_files $uri $uri/ /index.html) — /result refresh returns 200
  - Build-time VITE_API_URL bake seam (ARG/ENV before npm run build) — SC-5 deploy half
  - GitHub Actions CI pipeline (build-and-test job + Playwright e2e job)
  - husky v9 + lint-staged pre-commit (lint-staged on staged files only)
  - MIT LICENSE
affects: [phase-05-api-client, phase-07-deploy-self-host]

# Tech tracking
tech-stack:
  added:
    - 'nginxinc/nginx-unprivileged:alpine (serve image, non-root UID 101 / 8080)'
    - 'node:22-alpine (Docker build stage)'
    - 'GitHub Actions (CI)'
    - 'husky v9 + lint-staged (pre-commit, configured in Plan 01)'
  patterns:
    - 'Multi-stage Docker: build stage runs npm ci + npm run build, serve stage copies dist/ to nginx, .git/secrets excluded via .dockerignore'
    - 'Build-time env bake: ARG VITE_API_URL + ENV set BEFORE npm run build (NOT runtime-configurable, D-16 / Pitfall 6)'
    - 'nginx SPA fallback: try_files $uri $uri/ /index.html is mandatory for client-routed deep-links (D-05 / Pitfall 3)'
    - 'CI lockfile-authoritative: npm ci (never npm install); Playwright browsers installed via npx playwright install --with-deps chromium (Pitfall 5)'
    - 'Light pre-commit: lint-staged only (eslint --fix + prettier --write on staged files); heavy test/build stay in CI (D-10)'

key-files:
  created:
    - 'Dockerfile — multi-stage build (node:22-alpine) → serve (nginx-unprivileged), ARG VITE_API_URL baked at build, EXPOSE 8080'
    - 'nginx.conf — listen 8080, try_files SPA fallback, long-cache /assets/'
    - '.dockerignore — excludes node_modules, dist, .git, playwright-report, coverage, e2e, *.md'
    - '.github/workflows/ci.yml — build-and-test (ci/typecheck/lint/test/build) + e2e (playwright chromium + test:e2e) jobs'
    - '.husky/pre-commit — plain-shell npx lint-staged (husky v9, no husky.sh)'
    - 'LICENSE — MIT (2026)'
  modified: []

key-decisions:
  - 'Docker serve image is nginxinc/nginx-unprivileged:alpine on 8080 (UID 101) — no USER root, no port 80, so it runs on rootless Docker / Kubernetes runAsNonRoot (D-14, T-1-09)'
  - 'VITE_API_URL baked at build time via --build-arg (ARG/ENV before npm run build) — reconfiguring the backend requires a rebuild; runtime envsubst override deferred to Phase 7 if needed (D-16, SC-5)'
  - 'try_files $uri $uri/ /index.html SPA fallback exercised in Phase 1 (not discovered in Phase 7) — the #1 self-host gotcha (D-05, Pitfall 3)'
  - 'Live GitHub Actions green-run DEFERRED — no git remote configured yet; the human-verify checkpoint was approved on local CI-proxy evidence; the Actions run confirms on first push (Phase 7)'

patterns-established:
  - 'Multi-stage Docker image with build-time VITE_API_URL bake and non-root nginx SPA serve'
  - 'GitHub Actions CI split into build-and-test + e2e jobs, both on npm ci against the committed lockfile'
  - 'Light husky v9 / lint-staged pre-commit (staged files only); full gates live in CI'

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-06-03
---

# Phase 01 Plan 04: Docker + CI + Hooks + LICENSE Summary

**Multi-stage Docker image serving the SPA from non-root nginx (UID 101 / 8080) with the mandatory try_files deep-link fallback, build-time VITE_API_URL bake, a two-job GitHub Actions CI pipeline, a husky/lint-staged pre-commit, and the MIT LICENSE.**

## Performance

- **Duration:** ~10 min (implementation by prior executor; this session finalized after human approval)
- **Started:** 2026-06-03 (Tasks 1–2)
- **Completed:** 2026-06-03
- **Tasks:** 3 (2 auto implementation + 1 blocking human-verify checkpoint)
- **Files modified:** 6 created

## Accomplishments

- Multi-stage Dockerfile: node:22-alpine build stage (npm ci → ARG/ENV VITE_API_URL → npm run build) and nginxinc/nginx-unprivileged:alpine serve stage on UID 101 / port 8080 (SC-4, D-14, D-16)
- nginx.conf with the mandatory `try_files $uri $uri/ /index.html` SPA fallback plus a long-cache `/assets/` block — `curl /` and `curl /result` both return 200 (D-05, Pitfall 3)
- .dockerignore excluding `.git`, `*.md`, coverage, e2e, dist, node_modules — keeps history/secrets out of the image (T-1-08)
- GitHub Actions CI: a `build-and-test` job (npm ci → typecheck → lint → test → build) plus a separate Playwright `e2e` job (chromium install → test:e2e) (D-09, Pitfall 5)
- husky v9 plain-shell pre-commit running `npx lint-staged` only — heavy checks stay in CI (D-10)
- MIT LICENSE shipped in Phase 1 (D-12)

## Task Commits

Each implementation task was committed atomically:

1. **Task 1: Multi-stage Dockerfile + non-root nginx SPA fallback + .dockerignore** — `6ca4dae` (feat)
2. **Task 2: GitHub Actions CI + husky/lint-staged pre-commit + MIT LICENSE** — `eb354bd` (feat)
3. **Task 3 (checkpoint:human-verify, gate=blocking): Confirm Docker serve + SPA deep-link fallback + green CI** — RESOLVED, human approved ("approved")

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `Dockerfile` — Multi-stage: node:22-alpine build (npm ci, ARG/ENV VITE_API_URL before npm run build), nginx-unprivileged serve stage, EXPOSE 8080, no USER root
- `nginx.conf` — listen 8080, root /usr/share/nginx/html, `try_files $uri $uri/ /index.html` SPA fallback, long-cache /assets/
- `.dockerignore` — excludes node_modules, dist, .git, playwright-report, coverage, e2e, \*.md
- `.github/workflows/ci.yml` — build-and-test + e2e jobs, npm ci (lockfile-authoritative), Playwright chromium install
- `.husky/pre-commit` — plain-shell `npx lint-staged` (husky v9, no husky.sh source line)
- `LICENSE` — standard MIT text, 2026

## Live Verification Evidence

Gathered out-of-band (Docker daemon, per 01-VALIDATION.md the Docker smoke is manual-only):

- **Docker build** with `--build-arg VITE_API_URL=https://packerapi.anzozulia.xyz` completed (exit 0).
- **SPA deep-link fallback:** `curl http://localhost:8080/` → HTTP 200 AND `curl http://localhost:8080/result` → HTTP 200 (try_files resolves the deep-link refresh — the #1 self-host gotcha, D-05 confirmed).
- **Non-root:** container runs as UID 101 (nginx-unprivileged on 8080, no root — D-14 / T-1-09 confirmed).
- **CI validated locally as a proxy:** typecheck, lint, test, build, and test:e2e all green; the husky pre-commit hook fired live on a real staged commit.

Re-confirmed in this finalization session: `npm run typecheck` exit 0, `npm run lint` exit 0 (1 pre-existing react-refresh warning in src/router.tsx, 0 errors), `try_files ... /index.html` directive present in nginx.conf.

## Decisions Made

- nginx-unprivileged:alpine on 8080 (UID 101) rather than nginx:alpine on 80 — friendlier to rootless Docker / Kubernetes runAsNonRoot (D-14).
- VITE_API_URL baked at build time (ARG/ENV before npm run build); reconfiguring the backend means a rebuild. A runtime envsubst `/config.js` override is explicitly out of scope for v1 and deferred to Phase 7 if rebuild-to-reconfigure proves painful (D-16, SC-5).
- The SPA deep-link fallback was exercised now (Phase 1) rather than discovered during Phase 7 deploy (D-05).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None during implementation. One honesty caveat is recorded as a deferred item (below).

## Deferred Items

| Item                          | Reason                                                                                                                                                                                                                                                                                                                                | Resolves At                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Live GitHub Actions green-run | No git remote is configured yet; nothing has been pushed. The blocking human-verify checkpoint was approved on the strength of local CI-proxy evidence (typecheck/lint/test/build/test:e2e all green locally) plus the live Docker/SPA-fallback smoke. The actual GitHub Actions run (both jobs) will be confirmed on the first push. | Phase 7 (deploy / self-host), on first push to the GitHub remote |

## Checkpoint Resolution

**Task 3 — checkpoint:human-verify (gate=blocking):** Confirm Docker serve + SPA deep-link fallback + green CI.
**Resolution:** Human responded **"approved"** after reviewing: both curls returning 200 (SPA fallback works), the container running non-root (UID 101), and the local CI-proxy run all green. The live GitHub Actions confirmation remains deferred (see Deferred Items) because no remote is configured — the approval was given knowingly on local evidence.

## User Setup Required

None — no external service configuration required for this plan. (Build-time `VITE_API_URL` for self-hosters is documented in CLAUDE.md; the CORS allowlist on `packerapi.anzozulia.xyz` is already tracked as a Phase 7 blocker in STATE.md.)

## Next Phase Readiness

- The walking skeleton is now a real, shippable, self-hostable container: static build → non-root nginx on 8080 with the SPA deep-link fallback proven.
- CI + pre-commit hooks + MIT LICENSE are in place as foundation for every later phase.
- Phase 1 (scaffolding-version-lock) implementation work is complete pending orchestrator phase-level verification.
- Carry-forward: confirm the live GitHub Actions green-run on first push (Phase 7); CORS allowlist for the production serving origin (already a Phase 7 blocker).

## Self-Check: PASSED

Files verified present on disk:

- Dockerfile — FOUND
- nginx.conf — FOUND (try_files $uri $uri/ /index.html present)
- .dockerignore — FOUND
- .github/workflows/ci.yml — FOUND
- .husky/pre-commit — FOUND
- LICENSE — FOUND

Commits verified present in git log:

- 6ca4dae (Task 1: multi-stage Docker + non-root nginx SPA fallback) — FOUND
- eb354bd (Task 2: GitHub Actions CI + husky lint-staged + MIT LICENSE) — FOUND

Health re-check: `npm run typecheck` exit 0; `npm run lint` exit 0 (0 errors); try_files directive intact.

---

_Phase: 01-scaffolding-version-lock_
_Completed: 2026-06-03_
