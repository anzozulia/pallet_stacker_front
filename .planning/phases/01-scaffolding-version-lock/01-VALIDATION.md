---
phase: 1
slug: scaffolding-version-lock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` → "Validation Architecture". This phase delivers no v1
> REQ-IDs (foundational scaffolding); criteria are anchored to the ROADMAP Success Criteria
> (SC-1…SC-5) plus the code-split and quality-gate assertions.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (jsdom env) + @testing-library/react 16 + jest-dom; @playwright/test 1.60.0 (Chromium) for E2E |
| **Config file** | `vitest.config.ts` (or `test` block in `vite.config.ts`) + `playwright.config.ts` — none — Wave 0 installs |
| **Quick run command** | `npm run test` (vitest run) |
| **Full suite command** | `npm run typecheck && npm run lint && npm run test && npm run test:e2e && npm run build` |
| **Estimated runtime** | ~60–90 seconds (unit ~5s; e2e ~15s; build ~20s; docker smoke manual) |

---

## Sampling Rate

- **After every task commit:** `lint-staged` (eslint --fix + prettier --write on staged files) via husky pre-commit (D-10); run `npm run test` for logic-bearing tasks.
- **After every plan wave:** `npm run typecheck && npm run lint && npm run test && npm run build`.
- **Before `/gsd-verify-work`:** Full CI green (build-and-test + e2e jobs) AND a manual `docker build` + `curl /` + `curl /result` deep-link check.
- **Max feedback latency:** 90 seconds (quick unit loop < 10s).

---

## Per-Task Verification Map

> Populated during planning/execution once the planner assigns task IDs. Each task must map to
> one criterion below and carry an `<automated>` verify command (or a Wave 0 dependency).

| Task ID | Plan | Wave | Criterion | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-----------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-XX-XX | XX | 0/1 | SC-1…SC-5 | T-1-XX / — | see criterion map | unit/e2e/build | see criterion map | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Success-Criterion → Verification Map (authority for the table above)

| Criterion | Behavior | Test Type | Automated Command |
|-----------|----------|-----------|-------------------|
| SC-1 | Install resolves quartet, no peer conflict (react <19.3, three pinned exact) | install check | `npm ci && npm ls react three @react-three/fiber @react-three/drei` |
| SC-2 | Dev/preview renders empty `<Canvas>`, no WebGL errors | E2E smoke | `npm run test:e2e` (canvas visible + no webgl console errors) |
| SC-3a | Vitest sample passes (no Canvas in jsdom) | unit | `npm run test` |
| SC-3b | Playwright smoke passes (navigates `/result`) | E2E | `npm run test:e2e` |
| SC-4 | Static build serves from non-root nginx on 8080 | docker smoke | `docker build --build-arg VITE_API_URL=… -t palletize . && docker run -d -p 8080:8080 palletize && curl -fsS localhost:8080/ && curl -fsS localhost:8080/result` |
| SC-5 | `VITE_API_URL` baked at build; dev proxy `/api`→API, CORS-free | build-grep + dev smoke | grep built JS for baked URL; `curl` `/api/...` through `vite dev` proxy |
| Code-split | three/r3f/drei only in `/result` chunk | build assertion | after `vite build`: confirm `three` absent from main chunk, present in lazy chunk |
| Quality | typecheck + lint clean | CI | `npm run typecheck && npm run lint` |

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` (or `test` block in `vite.config.ts`) — jsdom env, `setupFiles`, exclude `e2e/**`
- [ ] `src/test/setup.ts` — imports `@testing-library/jest-dom/vitest`
- [ ] `src/components/Hello.test.tsx` — sample passing unit test (no Canvas)
- [ ] `playwright.config.ts` — `webServer` boots `vite preview`, baseURL `http://localhost:4173`
- [ ] `e2e/smoke.spec.ts` — `/result` canvas mount + no-WebGL-error assertion
- [ ] `.github/workflows/ci.yml` — build-and-test + e2e jobs (Playwright browser install step)
- [ ] Docker smoke (manual/CI-optional): `docker build` + `curl /` + `curl /result`

---

## Manual-Only Verifications

| Behavior | Criterion | Why Manual | Test Instructions |
|----------|-----------|------------|-------------------|
| Docker image builds + serves from non-root nginx on 8080 with SPA deep-link fallback | SC-4 | Requires a Docker daemon; runs out-of-band from the unit/E2E harness (kept CI-optional to avoid coupling PR speed to image builds) | `docker build --build-arg VITE_API_URL=https://packerapi.anzozulia.xyz -t palletize . && docker run --rm -d -p 8080:8080 palletize && curl -fsS localhost:8080/ && curl -fsS localhost:8080/result` (both 200) |
| Dev proxy routes `/api` without CORS error | SC-5 | Depends on the live packing API being reachable; not deterministic in CI | `npm run dev`, then `curl -i localhost:5173/api/...` returns a non-CORS response proxied to the API |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
