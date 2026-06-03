# Phase 1: Scaffolding & Version Lock - Research

**Researched:** 2026-06-03
**Domain:** Frontend project scaffolding — Vite 8 + React 19 + TypeScript SPA with the r3f/drei/three 3D quartet, Tailwind v4, react-router 7 (SPA), Vitest 4 + Playwright, husky/lint-staged, GitHub Actions CI, multi-stage non-root nginx Docker.
**Confidence:** HIGH

## Summary

Every package version and the peer-dependency matrix in `CLAUDE.md` were re-verified against the live npm registry on 2026-06-03 — all 24 versions match exactly, and the high-risk peer manifests (r3f 9, drei 10, plugin-react 6, vitest 4, testing-library 16) were read directly from the registry, not training data. The version lock is solid; **the risk in this phase is wiring, not version selection.** A planner can still get the integration wrong in ~8 specific places: the optional React-Compiler peers on `@vitejs/plugin-react@6`, the missing `@testing-library/dom@^10` explicit peer, Tailwind v4's CSS-first config (no `tailwind.config.js`), react-router 7's import surface (`react-router`, not `react-router-dom`) and lazy-route Suspense placement, the jsdom-has-no-WebGL boundary that forces Canvas testing into Playwright, the Vite dev-proxy vs. build-time-env split being two distinct mechanisms, `vite-tsconfig-paths` needing to be registered in **both** Vite and Vitest, and the husky v9 hook format (no `husky.sh` source line).

The walking skeleton is concretely buildable: `/` renders an eager `ConfigurePage`, `/result` lazy-loads a `ResultPage` containing an empty r3f `<Canvas>` (so three/r3f/drei land only in the `/result` chunk), a Vitest sample test passes in jsdom (never importing the Canvas), a Playwright smoke test navigates to `/result` and asserts the `<canvas>` element mounts, and a multi-stage Docker image serves the static `dist/` from `nginxinc/nginx-unprivileged:alpine` on port 8080 with the mandatory SPA fallback.

**Primary recommendation:** Scaffold by hand (not `npm create vite`) so every version is pinned deliberately; wire the eight integration seams below exactly as specified; treat the empty `<Canvas>` as a Playwright-only assertion.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Routing (`/`, `/result`) | Browser / Client | — | SPA library mode; all routing is client-side, deep-links handled by nginx fallback |
| Code-split 3D chunk | Browser / Client | CDN / Static | `React.lazy` produces a separate chunk nginx serves as a static asset |
| Empty `<Canvas>` render | Browser / Client | — | WebGL runs in the browser; cannot render in jsdom |
| `VITE_API_URL` injection | CDN / Static (build) | — | Baked at build time into static JS; not a runtime tier |
| `/api` dev proxy | Frontend Server (dev only) | — | Vite dev server proxies; **does not exist in production** (nginx serves static only) |
| Static asset serving | CDN / Static | — | nginx serves `dist/`; no app server in the image |
| Unit test logic | Browser / Client (jsdom) | — | Pure logic + component DOM, no WebGL |
| E2E smoke | Browser / Client (real Chromium) | — | Real WebGL context for Canvas assertion |

## Standard Stack

The full prescriptive stack lives in `CLAUDE.md` (single source of truth) and is **not duplicated here**. Below are only the version corrections / additions surfaced during this session's registry verification, plus the supporting packages CLAUDE.md mentions in prose but does not pin in the TL;DR table.

### Registry verification result (2026-06-03)

All CLAUDE.md TL;DR versions confirmed exact on npm: `react@19.2.7`, `react-dom@19.2.7`, `vite@8.0.16`, `@vitejs/plugin-react@6.0.2`, `typescript@6.0.3`, `three@0.184.0`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, `@types/three@0.184.1`, `react-router@7.16.0`, `nanoid@5.1.11`, `tailwindcss@4.3.0`, `@tailwindcss/vite@4.3.0`, `vitest@4.1.8`, `@testing-library/react@16.3.2`, `@playwright/test@1.60.0`, `eslint@10.4.1`, `typescript-eslint@8.60.1`, `prettier@3.8.3`, `eslint-config-prettier@10.1.8`, `vite-tsconfig-paths@6.1.1`. `[VERIFIED: npm registry]`

### Supporting packages to add (CLAUDE.md names in prose; pin these)

| Package | Version | Purpose | Provenance |
|---------|---------|---------|-----------|
| `@testing-library/dom` | `10.4.1` | **Required peer** of `@testing-library/react@16` — NOT bundled, install explicitly | `[VERIFIED: npm registry]` peer manifest |
| `@testing-library/jest-dom` | `6.9.1` | `toBeInTheDocument` etc. matchers | `[VERIFIED: npm registry]` |
| `@testing-library/user-event` | `14.6.1` | Interaction in component tests | `[VERIFIED: npm registry]` |
| `@types/react` | `19.2.16` | React 19 types | `[VERIFIED: npm registry]` |
| `@types/react-dom` | `19.2.3` | React DOM 19 types | `[VERIFIED: npm registry]` |
| `eslint-plugin-react-hooks` | `7.1.1` | Hooks lint rules (flat-config compatible) | `[VERIFIED: npm registry]` |
| `eslint-plugin-react-refresh` | `0.5.2` | Fast-refresh lint rule | `[VERIFIED: npm registry]` |
| `@eslint/js` | `10.0.1` | `js.configs.recommended` base for flat config | `[VERIFIED: npm registry]` |
| `globals` | `17.6.0` | `globals.browser` for flat-config `languageOptions` | `[VERIFIED: npm registry]` |
| `jsdom` | `^26` (latest in line `26.1.0`) | Vitest DOM env | `[VERIFIED: npm registry]` — see note |
| `clsx` | `2.1.1` | Optional, per CLAUDE.md | `[CITED: CLAUDE.md]` |

**jsdom version note `[VERIFIED: npm registry]`:** CLAUDE.md pins `jsdom ~26`, but the current jsdom `latest` is `29.1.1`. jsdom `26.1.0` is a real, valid release and satisfies Vitest 4's `jsdom: '*'` peer. Either works for an empty unit test. **Recommendation:** honor CLAUDE.md and use `~26` (the locked decision authority), but the planner should flag this as a deliberate-lag choice in case a contributor questions the stale version. This is the only place a CLAUDE.md pin lags the registry. `[ASSUMED]` that `~26` is intentional rather than an oversight — confirm with user if it matters.

**`lint-staged` version note:** CLAUDE.md does not pin `lint-staged`. Latest is `17.0.7` `[VERIFIED: npm registry]`. Pin `lint-staged@^17`.

**`@vitejs/plugin-react@6.0.2` peer trap `[VERIFIED: npm registry]`:** its peer list includes `@rolldown/plugin-babel` and `babel-plugin-react-compiler`, but `peerDependenciesMeta` marks **both as `optional: true`**. They are the opt-in React Compiler path. **Do not install them** — npm will not error or warn about missing optional peers. If a planner sees these in the peer list and installs them reflexively, it adds dead weight.

### Installation (single deliberate install set, exact pins)

```bash
# Runtime + build
npm i react@19.2.7 react-dom@19.2.7 react-router@7.16.0 nanoid@5.1.11 clsx@2.1.1

# 3D quartet — three pinned EXACTLY (no caret); types in lockstep
npm i three@0.184.0 @react-three/fiber@9.6.1 @react-three/drei@10.7.7

# Dev: build toolchain
npm i -D vite@8.0.16 @vitejs/plugin-react@6.0.2 typescript@6.0.3 \
  @types/react@19.2.16 @types/react-dom@19.2.3 @types/three@0.184.1 \
  vite-tsconfig-paths@6.1.1

# Dev: styling (Tailwind v4 — CSS-first, no postcss/autoprefixer)
npm i -D tailwindcss@4.3.0 @tailwindcss/vite@4.3.0

# Dev: unit/component tests
npm i -D vitest@4.1.8 jsdom@^26 \
  @testing-library/react@16.3.2 @testing-library/dom@10.4.1 \
  @testing-library/jest-dom@6.9.1 @testing-library/user-event@14.6.1

# Dev: E2E
npm i -D @playwright/test@1.60.0
npx playwright install --with-deps chromium   # browsers are a separate download

# Dev: lint / format
npm i -D eslint@10.4.1 typescript-eslint@8.60.1 @eslint/js@10.0.1 globals@17.6.0 \
  eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.2 \
  prettier@3.8.3 eslint-config-prettier@10.1.8

# Dev: git hooks
npm i -D husky@9.1.7 lint-staged@^17
```

> **Pin `three` exactly** (`three@0.184.0`, no `^`). three ships breaking changes on minor `0.x` bumps; a caret silently pulls an incompatible scene API and breaks the r3f peer link.

**Do NOT use `npm create vite`** — it scaffolds *unpinned* `^latest` versions and may pull React past `19.3` (which violates the r3f 9 `<19.3` peer cap). Build `package.json` from the install set above so every version is locked and the committed lockfile is authoritative. `[CITED: CLAUDE.md "What NOT to Use" — react@>=19.3 caps r3f]`

### Alternatives Considered

CLAUDE.md already adjudicated all alternatives (SWC vs Babel plugin, CSS Modules vs Tailwind, etc.). The locked decisions D-06/D-13/D-14/D-15/D-16 close these — no further exploration needed.

## Package Legitimacy Audit

> slopcheck was **not available** in this environment (`pip install slopcheck` not run / binary absent). Per protocol, legitimacy was established via the alternative authoritative path: every package was (a) named in CLAUDE.md's prescriptive stack which was itself verified against the live registry on 2026-06-03, AND (b) re-verified this session via `npm view <pkg> version` + peer-manifest reads. All are mainstream, multi-year, high-download packages with known source repos. No `postinstall` network-call risk identified in the core set. Because slopcheck could not run, the planner SHOULD still treat any package install as routine (these are not novel/obscure packages) but may add a single `checkpoint:human-verify` after `npm install` to confirm the lockfile resolves cleanly.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| react / react-dom | npm | 12+ yrs | github.com/facebook/react | n/a (unavailable) | Approved (registry + official docs) |
| vite / @vitejs/plugin-react | npm | 5+ yrs | github.com/vitejs/vite | n/a | Approved |
| three | npm | 12+ yrs | github.com/mrdoob/three.js | n/a | Approved |
| @react-three/fiber / drei | npm | 6+ yrs | github.com/pmndrs/react-three-fiber, /drei | n/a | Approved |
| react-router | npm | 10+ yrs | github.com/remix-run/react-router | n/a | Approved |
| tailwindcss / @tailwindcss/vite | npm | 5+ yrs | github.com/tailwindlabs/tailwindcss | n/a | Approved |
| vitest | npm | 4+ yrs | github.com/vitest-dev/vitest | n/a | Approved |
| @testing-library/* | npm | 6+ yrs | github.com/testing-library | n/a | Approved |
| @playwright/test | npm | 6+ yrs | github.com/microsoft/playwright | n/a | Approved |
| eslint / typescript-eslint | npm | 10+ / 6+ yrs | github.com/eslint, /typescript-eslint | n/a | Approved |
| husky / lint-staged | npm | 8+ / 9+ yrs | github.com/typicode/husky, /lint-staged | n/a | Approved |
| nanoid / clsx | npm | 6+ yrs | github.com/ai/nanoid, /lukeed/clsx | n/a | Approved |
| vite-tsconfig-paths | npm | 5+ yrs | github.com/aleclarson/vite-tsconfig-paths | n/a | Approved |

**Packages removed due to [SLOP]:** none.
**Packages flagged [SUS]:** none. (`@rolldown/plugin-babel` and `babel-plugin-react-compiler` are legitimate optional peers — simply **not installed**, not flagged.)

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────── DEV (npm run dev) ───────────────────┐
                       │                                                          │
  Browser ──HTTP──▶ Vite dev server (5173)                                        │
                       │   ├─ serves React app (HMR)                              │
                       │   └─ server.proxy:  /api/* ──▶ https://packerapi...xyz   │  (CORS-free)
                       └──────────────────────────────────────────────────────────┘

                       ┌──────────────── BUILD (npm run build) ──────────────────┐
  --build-arg VITE_API_URL ──▶ import.meta.env.VITE_API_URL  (BAKED into JS)      │
                       │   vite build ──▶ dist/  (index.html + hashed chunks:      │
                       │                          main chunk = Configure;          │
                       │                          lazy chunk = Result+three/r3f)   │
                       └──────────────────────────────────────────────────────────┘

                       ┌──────────────── PROD (Docker image) ────────────────────┐
  Browser ──HTTP:8080─▶ nginx-unprivileged (non-root)                             │
                       │   try_files $uri /index.html   (SPA deep-link fallback)   │
                       │   serves static dist/  —  NO app server, NO /api proxy    │
                       │   browser calls baked VITE_API_URL directly (CORS req'd)  │
                       └──────────────────────────────────────────────────────────┘

  App routing (client-side, all environments):
    /        ──▶ <ConfigurePage>   (eager, in main chunk)
    /result  ──▶ React.lazy(<ResultPage>) ──▶ <Canvas/> (three/r3f/drei, lazy chunk)
                  └─ <Suspense fallback> wraps the lazy element
```

### Recommended Project Structure (D-01 thin/signposted)

```
.
├── public/
│   └── fonts/                 # self-hosted Inter + JetBrains Mono (woff2) — D-08
├── src/
│   ├── components/            # shared UI — one sample component for the unit test
│   ├── features/              # .gitkeep — populated Phases 4/6
│   ├── lib/                   # .gitkeep — pure transforms Phases 2/3
│   ├── api/                   # .gitkeep — typed client Phase 5
│   ├── types/                 # .gitkeep — zod-derived contract types
│   ├── routes/
│   │   ├── ConfigurePage.tsx  # eager placeholder
│   │   └── ResultPage.tsx     # lazy; hosts empty <Canvas>
│   ├── styles.css             # @import "tailwindcss"; @theme {...}; @font-face
│   ├── router.tsx             # createBrowserRouter
│   ├── App.tsx                # (optional shell) — or fold into router
│   └── main.tsx               # createRoot + <RouterProvider>
├── e2e/
│   └── smoke.spec.ts          # navigates to /result, asserts canvas mounts
├── index.html
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vitest.config.ts           # OR test block inside vite.config.ts
├── playwright.config.ts
├── eslint.config.js           # flat config
├── .prettierrc / .prettierignore
├── Dockerfile
├── nginx.conf
├── .dockerignore
├── .github/workflows/ci.yml
├── .husky/pre-commit
├── LICENSE                    # MIT — D-12
└── package.json
```

D-02: **do not** create placeholder `.ts` logic files in `lib/`/`api/`/`types/` — `.gitkeep` only.

### Pattern 1: react-router 7 SPA mode + lazy 3D route (D-03/D-04)

**What:** `createBrowserRouter` + `RouterProvider`. Import from `react-router` (the v7 merged package — **NOT** `react-router-dom`). `[CITED: reactrouter.com/start/library, CLAUDE.md]`
**Why this exact shape:** the `<Suspense>` must wrap the **lazy element in the route definition** so three/r3f/drei resolve only when `/result` is visited, keeping them out of the Configure (main) chunk and exercising the nginx fallback on deep-link refresh (D-05).

```tsx
// src/router.tsx
import { createBrowserRouter } from 'react-router';
import { lazy, Suspense } from 'react';
import ConfigurePage from '@/routes/ConfigurePage';      // eager — main chunk

const ResultPage = lazy(() => import('@/routes/ResultPage'));  // lazy — separate chunk

export const router = createBrowserRouter([
  { path: '/', element: <ConfigurePage /> },
  {
    path: '/result',
    element: (
      <Suspense fallback={<div>Loading viewer…</div>}>
        <ResultPage />
      </Suspense>
    ),
  },
]);
```

```tsx
// src/main.tsx — React 19 createRoot import path
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from '@/router';
import '@/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

> **Verify the split worked:** after `npm run build`, confirm `dist/assets/` contains a separate hashed chunk importing `three` (run `npx vite build && grep -rl "three" dist/assets/*.js` or inspect the rollup output). If three appears in the main/Configure chunk, the lazy boundary is misplaced.

### Pattern 2: Empty r3f Canvas on the lazy route

**What:** the absolute-minimum Canvas that renders without WebGL errors.

```tsx
// src/routes/ResultPage.tsx
import { Canvas } from '@react-three/fiber';

export default function ResultPage() {
  return (
    <div style={{ width: '100%', height: '100dvh' }}>
      <Canvas data-testid="r3f-canvas">
        {/* empty scene — Phase 6 adds content. A single light keeps it valid. */}
        <ambientLight intensity={0.5} />
      </Canvas>
    </div>
  );
}
```

> r3f renders a real `<canvas>` DOM element. **A parent with explicit height is required** — `<Canvas>` fills its parent; a zero-height parent yields a 0×0 canvas and confusing "nothing renders" reports. Use `100dvh` (or a fixed px) on the wrapper.

### Pattern 3: Tailwind v4 CSS-first wiring (D-06/D-07/D-08)

`[CITED: tailwindcss.com/docs/installation/using-vite]` — v4 uses the Vite plugin + `@import "tailwindcss"`. **No `tailwind.config.js`, no `postcss.config.js`, no autoprefixer.**

```ts
// vite.config.ts (plugins excerpt)
import tailwindcss from '@tailwindcss/vite';
// ...plugins: [react(), tailwindcss(), tsconfigPaths()]
```

```css
/* src/styles.css */
@import "tailwindcss";

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.woff2') format('woff2');
  font-weight: 100 900;        /* variable font range if using the var version */
  font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono.woff2') format('woff2');
  font-weight: 100 800;
  font-display: swap;
}

@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --color-accent: #4f46e5;
}
```

> **Order matters:** `@import "tailwindcss"` must come first; `@theme` and `@font-face` follow. Tailwind v4 turns each `@theme` token into a real CSS custom property usable from utilities (`font-sans`, `text-accent`, `bg-accent`) **and** raw CSS — which is why D-07 minimal-now / port-palette-per-phase works cleanly.
> **Fonts (D-08):** drop `Inter.woff2` + `JetBrainsMono.woff2` into `public/fonts/`. Reference with **absolute** `/fonts/...` URLs (served from web root). Do NOT use the Google Fonts `<link>` — removing it is the whole point (offline self-host story). `[CITED: CLAUDE.md]`

### Pattern 4: Vite config — proxy + env + tsconfig paths (D-15/D-16)

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    proxy: {
      '/api': {
        target: 'https://packerapi.anzozulia.xyz',
        changeOrigin: true,        // sets Host header to target — required for the proxy + TLS SNI
        secure: true,              // target is HTTPS with a valid cert
        // rewrite: keep path as-is unless the API expects /api stripped — verify against the API
      },
    },
  },
});
```

> **Two distinct seams — do not conflate (D-16):**
> 1. **Dev proxy** (`server.proxy`): exists ONLY in `npm run dev`. Lets local code `fetch('/api/...')` with no CORS and no baked URL. **Absent in production** (nginx serves static only).
> 2. **Build-time env** (`import.meta.env.VITE_API_URL`): read by the API client (Phase 5) and **baked into the JS at `npm run build`**. In production the browser calls this absolute URL directly → the API must allow CORS for the serving origin.
> Phase 1 wires the proxy and documents the env seam; it does not yet read `VITE_API_URL` in code (no client until Phase 5). Add a typed declaration so the seam is ready:

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_API_URL: string }
interface ImportMeta { readonly env: ImportMetaEnv }
```

### Pattern 5: Path aliases in BOTH Vite and Vitest (D-15)

`vite-tsconfig-paths` reads `paths` from `tsconfig`. Because Vitest uses the **same Vite config** (when the test block lives in `vite.config.ts`), the alias resolves in tests automatically. **If you split into a separate `vitest.config.ts`, you must add `tsconfigPaths()` there too** — this is the #1 alias-breaks-in-tests gotcha.

```json
// tsconfig.app.json (paths excerpt)
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
```

### Anti-Patterns to Avoid

- **`npm create vite` for a version-locked repo:** pulls unpinned `^latest`, risks `react@>=19.3` breaking the r3f peer. Build `package.json` by hand.
- **Importing `<Canvas>` (or `ResultPage`) into a jsdom unit test:** jsdom has no WebGL context → the test throws or hangs. Keep Canvas in Playwright only.
- **Putting three/r3f in the eager `/` route:** defeats the code-split; three is the heaviest dep.
- **`react-router-dom` import:** wrong package for v7 — import from `react-router`.
- **Creating `tailwind.config.js` / `postcss.config.js`:** unnecessary and misleading in v4 CSS-first; tokens go in `@theme`.
- **Installing `babel-plugin-react-compiler` / `@rolldown/plugin-babel`:** optional peers of plugin-react 6; not needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Boot a server before E2E | Custom `start-server-and-test` script | Playwright `webServer` block | Built-in readiness polling, `reuseExistingServer`, CI-safe teardown |
| Pre-commit running tools on staged files | Manual `git diff` shell parsing | `lint-staged` | Handles partial-stage, glob routing, re-stage |
| Path aliases | Manual Vite `resolve.alias` + duplicate Vitest alias | `vite-tsconfig-paths` | Single source (`tsconfig.paths`), no drift |
| CSS reset/utilities/tokens | Hand-written CSS | Tailwind v4 `@theme` | Tokens become real custom props for free |
| OrbitControls / camera (later) | Manual three controls | drei `<OrbitControls>` (Phase 2+) | Not Phase 1, but signpost: don't port mockup's manual controls |

**Key insight:** This phase is almost entirely "wire the standard tools correctly." The only place custom code is appropriate is the trivial sample component + sample test.

## Common Pitfalls

### Pitfall 1: React auto-upgraded past 19.3 breaks r3f
**What goes wrong:** `npm install react@latest` or an unpinned create-tool pulls `react@>=19.3`; r3f 9.6.1 peer is `react >=19 <19.3` → peer conflict / runtime mismatch.
**Why:** r3f 9 explicitly caps below 19.3 (verified peer manifest this session).
**Avoid:** pin `react`/`react-dom` to `19.2.7` exactly; commit the lockfile; CI runs `npm ci` (not `npm install`) so the lockfile is authoritative. `[VERIFIED: npm registry peer manifest]`
**Warning sign:** `npm ls react` shows two versions, or r3f emits a hooks/renderer mismatch error.

### Pitfall 2: Canvas tested in jsdom
**What goes wrong:** a unit test imports `ResultPage`/`<Canvas>`; jsdom has no WebGL → throw or 0×0 canvas, flaky/failing test.
**Why:** jsdom implements no WebGL context.
**Avoid:** unit tests cover pure logic + simple DOM components only; the Canvas-mounts assertion lives in Playwright (real Chromium). `[CITED: CLAUDE.md "Testing WebGL output in jsdom"]`
**Warning sign:** errors mentioning `WebGLRenderingContext`/`getContext('webgl')` in Vitest output.

### Pitfall 3: nginx 404 on deep-link refresh
**What goes wrong:** refreshing `/result` in the container returns nginx 404 because no `/result` file exists.
**Why:** client-side routing; nginx must fall back to `index.html`.
**Avoid:** `try_files $uri $uri/ /index.html;` in `nginx.conf`. This is the #1 self-host gotcha and D-05 deliberately exercises it now. `[CITED: CLAUDE.md]`
**Warning sign:** Playwright deep-link nav works in dev but the Docker smoke check 404s.

### Pitfall 4: Alias resolves in app, breaks in tests
**What goes wrong:** `@/...` imports work in `npm run dev` but `npm run test` fails to resolve.
**Why:** a separate `vitest.config.ts` doesn't inherit the Vite plugin list.
**Avoid:** either keep the `test` block inside `vite.config.ts`, or add `tsconfigPaths()` to `vitest.config.ts` too.

### Pitfall 5: Playwright browsers not installed in CI
**What goes wrong:** `test:e2e` passes locally, fails in CI with "browserType.launch: Executable doesn't exist".
**Why:** Playwright browser binaries are a separate download from the npm package.
**Avoid:** CI step `npx playwright install --with-deps chromium` before running E2E. `[CITED: playwright.dev]`

### Pitfall 6: Build-time env mistaken for runtime config
**What goes wrong:** someone expects to change the API URL by setting an env var on the running container.
**Why:** `VITE_API_URL` is baked into JS at build time (`import.meta.env`), not read at runtime.
**Avoid:** document `docker build --build-arg VITE_API_URL=...`; reconfiguring requires rebuild (accepted per project decision; runtime override deferred). `[CITED: CLAUDE.md]`

## Code Examples

### Vitest config (jsdom env, jest-dom setup)
```ts
// vitest.config.ts  (or merge `test` into vite.config.ts)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],   // tailwind plugin not needed for tests
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // exclude e2e specs so vitest never runs Playwright tests
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
```
```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```
```tsx
// src/components/Hello.test.tsx  — trivial passing sample (no Canvas)
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

function Hello() { return <h1>Palletize</h1>; }

test('renders heading', () => {
  render(<Hello />);
  expect(screen.getByRole('heading', { name: 'Palletize' })).toBeInTheDocument();
});
```

### Playwright config + smoke spec
`[CITED: playwright.dev/docs/test-webserver]` — `webServer` boots the app deterministically; `reuseExistingServer: !process.env.CI` reuses a local server but forces a fresh one in CI.
```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',   // test the REAL static build
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```
> Use `vite preview` (port 4173) to exercise the production build, not the dev server — closer to what Docker serves. Ensure `package.json` has `"preview": "vite preview --port 4173"`.
```ts
// e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('result route mounts an r3f canvas without WebGL errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/result');
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});
```

### Flat ESLint config (eslint 10 / typescript-eslint 8)
```js
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  prettier,   // MUST be last — disables stylistic rules that conflict with prettier
);
```
> **Ordering:** `eslint-config-prettier` (`prettier`) goes **last** so it turns off conflicting stylistic rules from the configs above it. `[CITED: eslint-config-prettier README]`

### husky v9 + lint-staged (D-10)
`[CITED: typicode.github.io/husky/get-started]` — v9 init creates the hook + adds the `prepare` script. The v9 hook file is a **plain shell command** — no `#!/usr/bin/env sh` / `. "$(dirname -- "$0")/_/husky.sh"` source line (that was v8).
```bash
npx husky init            # creates .husky/pre-commit + adds "prepare": "husky" to package.json
```
```sh
# .husky/pre-commit   (overwrite the init default with this single line)
npx lint-staged
```
```json
// package.json (excerpt)
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 4173",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,json,md}": ["prettier --write"]
  }
}
```
> Keep the hook light (D-10): `lint-staged` only. No full test/build in the hook — CI is the heavy gate.

### Multi-stage Dockerfile (D-14) + nginx.conf
```dockerfile
# Dockerfile
# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL                 # baked at THIS step (build time)
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build                # -> /app/dist

# ---- serve stage (non-root) ----
FROM nginxinc/nginx-unprivileged:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080                      # unprivileged image listens on 8080, runs as non-root
# CMD inherited from base image (nginx -g 'daemon off;')
```
```nginx
# nginx.conf
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # MANDATORY SPA fallback (D-05)
    }

    # long-cache hashed assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```
```
# .dockerignore
node_modules
dist
.git
playwright-report
coverage
e2e
*.md
```
**Build + run:**
```bash
docker build --build-arg VITE_API_URL=https://packerapi.anzozulia.xyz -t palletize .
docker run --rm -p 8080:8080 palletize
curl -fsS http://localhost:8080/        # 200 + index.html
curl -fsS http://localhost:8080/result  # 200 via SPA fallback (deep-link works)
```
> The `nginxinc/nginx-unprivileged` image already runs as UID 101 (non-root) and listens on 8080 — do **not** add `USER root` or change the port to 80. `[CITED: CLAUDE.md]`

### GitHub Actions CI (D-09)
```yaml
# .github/workflows/ci.yml
name: CI
on: { pull_request: {}, push: { branches: [master] } }
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test          # vitest run (jsdom, no Canvas)
      - run: npm run build
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium   # browsers are separate
      - run: npm run test:e2e
```
> Use Node 22 in CI (`node:22-alpine` is the build image; engines allow >=20.19/22.13/>=24). `npm ci` (not `install`) enforces the committed lockfile — the supply-chain pin.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + PostCSS + autoprefixer | `@tailwindcss/vite` plugin + `@theme` in CSS | Tailwind v4 (2025) | No JS config / PostCSS files; tokens are CSS vars |
| `react-router-dom` | `react-router` (merged) | v7 (2024) | Single package; import everything from `react-router` |
| `.eslintrc.json` | flat `eslint.config.js` | eslint 9+ (default in 10) | New config shape; plugins as objects |
| husky v8 `husky.sh` source line | plain shell hook + `prepare: husky` | husky v9 (2024) | Simpler hook files; no boilerplate header |
| `ReactDOM.render` | `createRoot` from `react-dom/client` | React 18+/19 | Concurrent root; required for r3f 9 |

**Deprecated/outdated:** CDN importmap three (mockups) — rejected for bundled SPA; React 18 + r3f 8 legacy line — not this stack.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CLAUDE.md `jsdom ~26` pin (vs registry latest 29) is intentional, not stale oversight | Standard Stack | Low — both work for an empty unit test; if unintended, bump to `^29` |
| A2 | The `/api` proxy path is forwarded as-is (no `rewrite` stripping `/api`) | Pattern 4 | Low — Phase 1 only smoke-checks reachability; Phase 5 confirms against real endpoints. Verify against the API's actual route prefix when the client lands |
| A3 | Self-hosted font files are obtainable as `.woff2` (Inter + JetBrains Mono are OFL-licensed and freely downloadable) | Pattern 3 | Low — both are open-licensed; planner must source the actual `.woff2` files |

## Open Questions

1. **Does the packing API expose routes under `/api/...` or a different prefix?**
   - Known: dev proxy targets `https://packerapi.anzozulia.xyz`; CLAUDE.md uses `/api`.
   - Unclear: whether the real endpoints live under `/api/v1/...` (CLAUDE.md prose mentions `/api/v1/pack`) and whether the proxy should rewrite.
   - Recommendation: Phase 1 only needs the proxy to forward + a reachability smoke (e.g. `curl` through the dev server). Leave `rewrite` unset; resolve precisely in Phase 5. Not a Phase-1 blocker.

2. **Which Inter/JetBrains Mono font files (static weights vs variable)?**
   - Recommendation: use the variable `.woff2` for each (one file, full weight range) to keep `public/fonts/` minimal. Planner sources the files; `@font-face` ranges shown in Pattern 3.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build / dev / CI | ✓ | v24.3.0 (local); CI uses 22 | — |
| npm | install / scripts | ✓ | 11.4.2 | — |
| docker | image build + serve criterion | ✓ | 28.2.2 | — |
| Playwright Chromium | E2E smoke | ✗ (binary not yet installed) | — | `npx playwright install --with-deps chromium` (one-time) |
| slopcheck | package legitimacy audit | ✗ | — | Registry + official-docs cross-check (used this session) |
| ctx7 | docs lookup | ✗ | — | WebFetch on official docs (used this session) |

**Missing with no fallback:** none.
**Missing with fallback:** Playwright browsers (install step, already in the install set + CI); slopcheck (covered by registry verification); ctx7 (covered by WebFetch).

## Validation Architecture

> Nyquist validation ENABLED (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Unit framework | Vitest 4.1.8 (jsdom env) + @testing-library/react 16 + jest-dom |
| E2E framework | @playwright/test 1.60.0 (Chromium) |
| Config files | `vitest.config.ts` (or `test` block in `vite.config.ts`); `playwright.config.ts` |
| Quick run | `npm run test` (vitest run) |
| E2E run | `npm run test:e2e` (playwright test, boots `vite preview`) |

### Phase Success Criterion → Verification Map
| Criterion | Behavior | Test Type | Automated Command | Exists? |
|-----------|----------|-----------|-------------------|---------|
| SC-1 | Install resolves quartet, no peer conflict, react <19.3, three exact | install check | `npm ci && npm ls react three @react-three/fiber @react-three/drei` (no dedupe/conflict) | ❌ Wave 0 |
| SC-2 | Dev server renders empty `<Canvas>`, no WebGL errors | E2E smoke (preview build) | `npm run test:e2e` (canvas visible + no webgl console errors) | ❌ Wave 0 (`e2e/smoke.spec.ts`) |
| SC-3a | Vitest sample passes | unit | `npm run test` | ❌ Wave 0 (`src/components/Hello.test.tsx`, `src/test/setup.ts`) |
| SC-3b | Playwright smoke passes | E2E | `npm run test:e2e` | ❌ Wave 0 |
| SC-4 | Static build serves from non-root nginx on 8080 | docker smoke | `docker build --build-arg VITE_API_URL=… -t palletize . && docker run -d -p 8080:8080 palletize && curl -fsS localhost:8080/ && curl -fsS localhost:8080/result` | ❌ Wave 0 (`Dockerfile`, `nginx.conf`) |
| SC-5 | `VITE_API_URL` baked at build; dev proxy `/api`→API, CORS-free | build-grep + dev smoke | grep built JS for baked URL; `curl` `/api/...` through `vite dev` proxy returns non-CORS response | ❌ Wave 0 |
| Code-split | three/r3f/drei only in `/result` chunk | build assertion | after `vite build`: confirm `three` absent from main chunk, present in lazy chunk | ❌ Wave 0 |
| Quality gates | typecheck + lint clean | CI | `npm run typecheck && npm run lint` | ❌ Wave 0 (`eslint.config.js`, tsconfigs) |

### Sampling Rate
- **Per task commit:** `lint-staged` (eslint --fix + prettier) via husky pre-commit (D-10).
- **Per wave merge:** `npm run typecheck && npm run lint && npm run test && npm run build`.
- **Phase gate:** full CI green (both jobs) + manual `docker build`/`curl` deep-link check before `/gsd-verify-work`.

### Wave 0 Gaps (test infra to create before/with implementation)
- [ ] `vitest.config.ts` (or `test` block) — jsdom env, setupFiles, exclude `e2e/**`
- [ ] `src/test/setup.ts` — `@testing-library/jest-dom/vitest`
- [ ] `src/components/Hello.test.tsx` — sample passing unit test (no Canvas)
- [ ] `playwright.config.ts` — `webServer` boots `vite preview`, baseURL 4173
- [ ] `e2e/smoke.spec.ts` — `/result` canvas mount + no-WebGL-error assertion
- [ ] `.github/workflows/ci.yml` — build-and-test + e2e jobs (Playwright install step)
- [ ] Docker smoke (manual/CI-optional): `docker build` + `curl /` + `curl /result`

## Security Domain

> `security_enforcement: true`, ASVS level 1, block-on: high.

### Applicable ASVS Categories (Phase 1 scope)
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V1 Architecture | yes | Stateless static SPA, no backend of our own, no server-side data |
| V2 Authentication | no | No auth in v1 (no accounts — out of scope) |
| V3 Session Management | no | No sessions / cookies |
| V4 Access Control | no | No protected resources |
| V5 Input Validation | not yet | No user input in Phase 1 (zod validation arrives Phase 4) |
| V6 Cryptography | no | No secrets handled; never hand-roll later |
| V10 Malicious Code / Supply Chain | **yes** | Exact version pins + committed lockfile + `npm ci` in CI |
| V12 Files/Resources | yes | Self-hosted fonts (no external CDN); static assets only |
| V14 Config | **yes** | Non-root container; no secrets in image; HTTPS dev-proxy target |

### Threat Patterns for this stack (Phase 1 surfaces)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dependency confusion / slopsquat | Tampering | Exact pins, committed `package-lock.json`, `npm ci`, registry-verified names (this doc) |
| Drifting transitive deps | Tampering | Lockfile authoritative; CI uses `npm ci` not `install` |
| Secret baked into image | Info Disclosure | `VITE_API_URL` is a public base URL, not a secret; nothing sensitive in build args; `.dockerignore` excludes `.git`/`.env` |
| Container running as root | Elevation of Privilege | `nginxinc/nginx-unprivileged` (UID 101, port 8080) — D-14 |
| MITM on dev proxy | Tampering / Info Disclosure | Proxy target is HTTPS (`secure: true`); `changeOrigin` for correct SNI |
| Insecure deep-link fallback exposing files | Info Disclosure | `try_files … /index.html` only serves SPA shell; no directory listing; root scoped to `dist` |

**Threat-model block for the planner:** Phase 1's security deliverables are (1) committed lockfile + exact pins + `npm ci` in CI (supply-chain), (2) non-root nginx on 8080, (3) `.dockerignore` excluding `.git`/secrets/`.env`, (4) HTTPS-only dev-proxy target. No `block-on: high` issues identified — all controls are standard config, no hand-rolled crypto/auth.

## Project Constraints (from CLAUDE.md)

- **Stack is prescriptive and version-locked** — use the exact versions; the quartet (React 19.2.x / r3f 9 / drei 10 / three 0.184.0 exact) is a single locked unit, never auto-upgraded.
- **three pinned exactly** (no caret); `@types/three` minor in lockstep with `three`.
- **React capped `<19.3`** by r3f 9 peer — do not bump past 19.2.x.
- **Tailwind v4 CSS-first** — no `tailwind.config.js`, no PostCSS/autoprefixer; tokens in `@theme`.
- **No runtime backend / Node server in the image** — multi-stage build → static `dist/` on nginx.
- **`VITE_API_URL` baked at build time** — not runtime-configurable (runtime override deferred).
- **No CSS-in-JS runtime**, no CDN importmap three, no React 18 + r3f 8 legacy line.
- **Do not unit-test the WebGL canvas in jsdom** — Playwright only.
- **Import from `react-router`** (v7 merged), SPA/library mode (`createBrowserRouter`), not framework/SSR.
- **localStorage-only persistence**, mm/kg units, MIT license, GitHub-published (docs in Phase 7).

## Sources

### Primary (HIGH confidence)
- npm registry (live, 2026-06-03) — exact versions + peer manifests for all 24 packages and supporting libs (re-verified this session via `npm view`).
- `CLAUDE.md` — prescriptive stack, version matrix, Docker/nginx recipe, "What NOT to Use" (single source of truth).
- tailwindcss.com/docs/installation/using-vite — Tailwind v4 `@tailwindcss/vite` + `@import "tailwindcss"` (no config files).
- reactrouter.com/start/library — react-router 7 `createBrowserRouter`/`RouterProvider`, import from `react-router`.
- playwright.dev/docs/test-webserver — `webServer` boot config, `reuseExistingServer`, `baseURL`.
- typicode.github.io/husky/get-started — husky v9 `npx husky init`, plain-shell hook, `prepare` script.
- `01-CONTEXT.md` D-01..D-16 — locked decisions.

### Secondary (MEDIUM confidence)
- eslint-config-prettier README convention (prettier config last) — standard, widely documented.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack / versions: HIGH — every version + peer manifest read from live registry this session.
- Architecture / wiring: HIGH — each integration seam confirmed against official docs (Tailwind, react-router, Playwright, husky).
- Pitfalls: HIGH — derived from verified peer constraints and CLAUDE.md's explicit "What NOT to Use".
- Security: HIGH — controls are standard config; no novel surfaces.

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable; re-verify versions if planning slips a month — three/r3f/React move on minor bumps)
