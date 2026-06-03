# Walking Skeleton — Palletize

**Phase:** 1
**Generated:** 2026-06-03

## Capability Proven End-to-End

A developer can `npm run dev` (or run the Docker image), load `/` (Configure page, eager), navigate to `/result`, and see an empty react-three-fiber `<Canvas>` mount with no WebGL errors — and the same static build serves that deep-link `/result` route with a 200 from the production non-root nginx container.

This is the thinnest meaningful slice that exercises the full client stack for a **stateless, backend-free SPA**: version-locked install → routing → code-split lazy 3D route → real WebGL canvas mount → production static build → containerized serve with SPA deep-link fallback, all guarded by a passing unit test, a passing E2E smoke, and green CI.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework / runtime | React 19.2.7 + React DOM 19.2.7 (SPA, no SSR) | Mandated by the r3f 9 / drei 10 peer ranges (react >=19 <19.3); the dynamic box-catalog UI + type-safe API contract suit React; capped below 19.3 (never auto-upgrade past 19.2.x). |
| Build tool | Vite 8.0.16 + @vitejs/plugin-react 6.0.2 (Babel) | Native ESM dev server, `import.meta.env` for the build-time `VITE_API_URL`, built-in `server.proxy` for CORS-free local dev, clean static `dist/`. Babel plugin (D-13); SWC unnecessary at this size. |
| Language | TypeScript ~6.0.3, strict, project references | Type-safe API contract is an explicit project goal. Pinned `~` (patch-only). |
| 3D stack | three 0.184.0 (exact, no caret) + @react-three/fiber 9.6.1 + @react-three/drei 10.7.7 | The locked quartet treated as a single unit. three pinned exactly (breaking changes on minor bumps); `@types/three` 0.184.x in lockstep. |
| Routing | react-router 7.16.0, `createBrowserRouter` SPA/library mode | Two real routes (`/` Configure, `/result` Result). Import from `react-router` (v7 merged), NOT `react-router-dom`. Library mode (not framework/SSR) — this is a static SPA. (D-03) |
| Code-split | `React.lazy(() => import('@/routes/ResultPage'))` behind `<Suspense>` | three/r3f/drei (the heaviest deps) land ONLY in the `/result` chunk, out of the initial Configure bundle. Build-time assertion fails if three leaks into the entry chunk. (D-04) |
| Data layer | **None — stateless client, no backend, no database** | Project mandate (CLAUDE.md): no backend of our own; all persistence is client-side localStorage, which arrives in Phase 4. The packing API is the only external service; the frontend never computes or stores placements. |
| Styling | Tailwind CSS v4.3.0 via `@tailwindcss/vite` (CSS-first) | No `tailwind.config.js`, no PostCSS/autoprefixer. Tokens live in `@theme` (Phase 1: fonts + `#4f46e5` accent only; full palette ported per-phase). (D-06/D-07) |
| Fonts | Self-hosted Inter + JetBrains Mono (`public/fonts/*.woff2`, `@font-face`) | Removes the only external network dependency — directly serves the offline / single-container self-host story. No Google Fonts `<link>`. (D-08) |
| API seam | Build-time `VITE_API_URL` via `import.meta.env` + dev `server.proxy` `/api` → `https://packerapi.anzozulia.xyz` | Two distinct seams: dev proxy (dev-only, CORS-free) and baked build-time URL (production; API must allow CORS for the serving origin). Phase 1 wires the proxy + types the env; no client until Phase 5. (D-16) |
| Path aliases | `@/*` → `src/*` via `vite-tsconfig-paths` (registered in BOTH vite + vitest configs) | Single source (tsconfig `paths`), pairs with the signposted directory layout; registered in vitest too to avoid the alias-breaks-in-tests gotcha. (D-15) |
| Test stack | Vitest 4.1.8 (jsdom) + @testing-library/react 16 + jest-dom; @playwright/test 1.60.0 (Chromium) | Unit tests cover pure logic / DOM in jsdom; the WebGL Canvas is asserted ONLY in Playwright against the real `vite preview` build (jsdom has no WebGL). |
| CI / quality gates | GitHub Actions (`npm ci` → typecheck → lint → test → build + e2e job); husky v9 + lint-staged pre-commit; flat ESLint config | Green-on-PR from commit #1. Pre-commit stays light (eslint --fix + prettier --write on staged files only); heavy checks live in CI. (D-09/D-10) |
| Deployment target | Single multi-stage Docker image: `node:22-alpine` build → `nginxinc/nginx-unprivileged:alpine` serve (UID 101, port 8080) | Optimized for easy self-hosting. Static `dist/` only — no app server in the image. Mandatory `try_files … /index.html` SPA fallback for deep-link refresh. (D-05/D-14) |
| License | MIT (`LICENSE` in Phase 1) | Permissive, conventional default for JS/React tooling; maximizes adoption/contribution for a free self-hostable tool. (D-12) |
| Directory layout | Thin, signposted: `src/{components,features,lib,api,types,routes}` with `.gitkeep` placeholders | Signals the inside-out architecture (lib → api → features) to contributors without speculative logic files. Real files arrive when their phase needs them. (D-01/D-02) |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — hand-built version-locked `package.json` + committed lockfile (Plan 01)
- [x] Routing — two real routes: `/` (eager Configure) + `/result` (lazy, code-split) (Plan 02)
- [ ] ~~Database — one real read AND one real write~~ → **N/A: Palletize is a stateless client with NO backend and NO database** (CLAUDE.md mandate). The equivalent rung is proven instead by **one real UI interaction**: navigating to `/result` mounts a real WebGL `<Canvas>` with no errors and three is verifiably code-split into the lazy chunk (Plan 02). Client-side localStorage persistence is a Phase 4 concern, not part of the skeleton.
- [x] UI — one interactive element wired through the stack: the lazy `/result` route loads three/r3f/drei on demand and mounts an empty `<Canvas>` (Plan 02), asserted live in Playwright (Plan 03)
- [x] Deployment — running on dev (`npm run dev`) AND a production-equivalent full-stack run: the multi-stage Docker image serves the static build from non-root nginx on 8080 with deep-link SPA fallback (Plan 04)

## Out of Scope (Deferred to Later Slices)

Explicitly NOT in the skeleton — this list prevents later phases from re-litigating Phase 1's minimalism:

- **Any real 3D content / API↔Three.js coordinate mapping** → Phase 2 (the highest-risk piece; needs a captured real `done` response and golden tests first).
- **Pure transform core** (request-builder qty expansion + rotation mapping, result-mapper) → Phase 3.
- **Config form, box catalog, validation, live unit count, localStorage persistence** → Phase 4.
- **API client, submit-then-poll lifecycle, loading screen, cancel, terminal-state handling** → Phase 5.
- **Result viewer, summary rail, multi-pallet switcher, placement list, unpacked panel, CoG + support diagnostics** → Phase 6.
- **Failure screens, JSON + printable export, README/self-host docs + nginx reverse-proxy recipe + GitHub publish (HOST-03)** → Phase 7.
- **Full mockup token palette** (surfaces, the dark `--d-bg` 3D-overlay group, state colors) → ported per-phase as UI lands (Phase 4 / Phase 6), NOT Phase 1.
- **Runtime `VITE_API_URL` override** (nginx `envsubst` on a `/config.js` shim) → explicitly out of scope for v1; the architecture does not preclude it.
- **No DB / no server-side persistence / no accounts** → permanent v1 boundary (stateless client over the API).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton WITHOUT altering its architectural decisions (the locked quartet, SPA routing, Tailwind CSS-first tokens, the build-time-env/dev-proxy seam, the non-root Docker serve):

- **Phase 2:** Capture a real `done` response; lock the API↔Three.js coordinate mapping with golden tests; render a static fixture scene matching `design/result.html` with orbit/zoom/pan + ISO/TOP/FRONT presets.
- **Phase 3:** Pure, IO-free transform core — request-builder (qty expansion → unique `TYPE#index` IDs, 3-mode rotation mapping) and result-mapper (group by type/pallet, surface CoG + support-ratio), fully unit-tested.
- **Phase 4:** Validated config form (pallet + dynamic box catalog), live running total, `max_pallets`, and localStorage persistence that survives refresh — no API yet.
- **Phase 5:** Typed API client, submit-then-poll job lifecycle, loading screen, cancel, all four terminal states handled without crashing.
- **Phase 6:** Full vertical — real result → mapper → persistent viewer + summary rail, multi-pallet switcher, placement list with hover↔mesh highlight, unpacked panel, CoG marker + support-ratio tinting.
- **Phase 7:** Graceful failure screens, JSON + printable (print-CSS) export, hardened single Docker image with verified CORS, and GitHub README/docs sufficient to self-host in minutes.
