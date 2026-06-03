<!-- GSD:project-start source:PROJECT.md -->

## Project

**Palletize**

A free, open-source, self-hostable web tool for pallet packing. A user describes a pallet and a catalog of boxes, the app submits the job to an existing packing API, and returns an explorable 3D plan showing exactly where every box goes — fill rate, weight, centre-of-gravity, and stacking stability included. No login, no accounts, no stored history. Just the tool.

**Core Value:** A user can describe their pallet and boxes and get back a correct, explorable 3D packing plan in seconds — with zero signup and nothing to install beyond a single Docker container.

### Constraints

- **Tech stack**: React + Vite + TypeScript, with react-three-fiber (+ drei) wrapping the Three.js 3D viewer — chosen for the dynamic box-catalog UI, a type-safe API contract, and a broad contributor pool.
- **API integration**: must use the async submit-then-poll flow; the frontend never blocks on a synchronous response.
- **API base URL**: configurable via build-time env var (`VITE_API_URL`). Consequence — the API must allow CORS for the serving origin, and changing the backend requires a rebuild. A dev proxy will be provided for local development.
- **Deployment**: a single Docker image, optimized for easy self-hosting (static build served by a lightweight web server).
- **No backend of our own**: stateless client; all persistence is client-side (localStorage) only.
- **Units**: millimetres for dimensions (integers), kilograms for weight — matching the API and mockups.
- **Licensing**: open-source, GitHub-published.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR — The Prescriptive Stack

| Concern | Pick | Version (verified 2026-06-03) |
|---------|------|------|
| Runtime | React + React DOM | `19.2.7` |
| Build tool | Vite + `@vitejs/plugin-react` | `8.0.16` / `6.0.2` |
| Language | TypeScript | `~6.0.3` |
| 3D core | three | `0.184.0` |
| 3D React renderer | @react-three/fiber | `9.6.1` |
| 3D helpers | @react-three/drei | `10.7.7` |
| three types | @types/three | `0.184.1` |
| Server state / polling | @tanstack/react-query | `5.101.0` |
| Forms | react-hook-form | `7.77.0` |
| Schema / contract validation | zod | `4.4.3` |
| RHF↔zod bridge | @hookform/resolvers | `5.4.0` |
| Styling | Tailwind CSS + `@tailwindcss/vite` | `4.3.0` |
| Routing | react-router | `7.16.0` |
| ID generation | nanoid | `5.1.11` |
| Unit/component tests | vitest + @testing-library/react + jsdom | `4.1.8` / `16.3.2` / `~26` |
| E2E tests | @playwright/test | `1.60.0` |
| Lint | eslint + typescript-eslint | `10.4.1` / `8.60.1` |
| Format | prettier + eslint-config-prettier | `3.8.3` / `10.1.8` |
| Build image | `node:22-alpine` (or `node:24-alpine`) | LTS |
| Serve image | `nginxinc/nginx-unprivileged:alpine` | latest stable |

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **React** | `19.2.7` | UI runtime | Mandated by the r3f 9 / drei 10 peer ranges (see matrix). React 19 is stable, is the only version current r3f supports, and brings the new JSX transform + improved Suspense that r3f 9 relies on. |
| **Vite** | `8.0.16` | Dev server + bundler | Fastest mainstream React build tool; native ESM dev server, first-class `import.meta.env` for the `VITE_API_URL` build-time var, built-in dev `server.proxy` for the CORS-free local dev path, and a clean static `dist/` for the nginx stage. |
| **@vitejs/plugin-react** | `6.0.2` | React Fast Refresh + JSX | Standard Vite React plugin (Babel-based). Use this unless you adopt SWC; either is fine for an app this size. |
| **TypeScript** | `~6.0.3` | Type safety | Type-safe API contract is an explicit project goal. Pin with `~` (patch-only) — TS minor bumps occasionally tighten checks. |
| **three** | `0.184.0` | 3D engine | The actual WebGL/scene engine. The mockup already targets Three.js (it used `0.160` via CDN). r3f 9 needs `three >=0.156`, so any recent `0.18x` is safe. Pin exactly — three ships breaking changes on minor bumps. |
| **@react-three/fiber** | `9.6.1` | Declarative React renderer for three | The chosen way to express the scene declaratively (`<mesh>`, `<boxGeometry>`) instead of imperative `scene.add()`. v9 is the React-19 line. |
| **@react-three/drei** | `10.7.7` | r3f helper components | Gives you `<OrbitControls>` (replaces the mockup's manual `OrbitControls`), `<Bounds>`/`<CameraControls>` for the ISO/TOP/FRONT presets, `<Grid>`, `<Environment>`, `<Edges>`, `<Html>` overlays, `<PerspectiveCamera>`. Drei 10 is the only line compatible with r3f 9. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@tanstack/react-query** | `5.101.0` | Server-state, polling, retries, caching | **Use it — do not hand-roll.** This is the cleanest fit for the async submit-then-poll model. `useMutation` for `POST /api/v1/pack`; on success take the `job_id` and drive a `useQuery` with `refetchInterval` that returns `false` once `status` is `done`/`failed`/`timeout`, stopping the poll. Gives you loading/error/retry/stale handling for free and maps directly onto the mockup's loading screen. |
| **react-hook-form** | `7.77.0` | Form state for the dynamic box catalog | The box catalog is a dynamic array of typed rows — exactly `useFieldArray`'s purpose (add/remove box types, per-row dimensions/weight/qty/fragile/rotation). Uncontrolled inputs keep re-renders cheap even with many box types. |
| **zod** | `4.4.3` | Schema validation + the API contract | Single source of truth for the API contract. Define request/response schemas once; `z.infer` gives you the TS types; validate `GET /jobs/{id}` responses at the boundary so a malformed/changed API surfaces as a clear error, not a render crash. Also validates the config form via the resolver. |
| **@hookform/resolvers** | `5.4.0` | Bridges zod → react-hook-form | `zodResolver(schema)` wires the zod config schema into RHF so form validation and the API contract share one schema. |
| **react-router** | `7.16.0` | Client routing | Two real routes (Configure → Result) plus loading state. v7 is the merged `react-router`/`react-router-dom` package — import from `react-router`. Use it in **SPA/`createBrowserRouter` (library) mode**, not framework/SSR mode — this is a static SPA. Requires the nginx SPA fallback (below). |
| **nanoid** | `5.1.11` | Unique box IDs | The project must expand per-type quantities into individual boxes with unique IDs for the API. `nanoid` is tiny and dependency-free. (A simple counter also works; nanoid avoids collision bookkeeping.) |
| **clsx** | `2.1.1` | Conditional class strings | Optional but ubiquitous with Tailwind for toggling `.on`/`.sel`/`.warn` states seen in the mockups. |

### Styling

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| **tailwindcss** | `4.3.0` | Utility-first CSS | **Recommended over CSS Modules / plain CSS.** Rationale below. |
| **@tailwindcss/vite** | `4.3.0` | Tailwind v4 Vite plugin | v4 uses a Vite plugin + CSS-first config (`@theme` in CSS, no `tailwind.config.js` required). No PostCSS/autoprefixer wiring needed. |

- **Fonts:** keep the Google Fonts `<link>` for `Inter` + `JetBrains Mono` (self-host later for the offline/self-host story), then expose them via `@theme { --font-sans: 'Inter', ...; --font-mono: 'JetBrains Mono', ...; }`.
- **The 3D viewer's dark overlay** (`--d-bg:#0c0f17`, etc.) lives in its own token group — easy as Tailwind theme extensions.
- **If the team strongly prefers it,** CSS Modules is a legitimate fallback (it preserves the mockup CSS nearly verbatim, scoped per component). Choose that only if nobody on the contributor pool wants Tailwind. Avoid CSS-in-JS runtime libraries (styled-components/emotion) — extra runtime weight for a tool that wants a tiny static bundle.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **vitest** `4.1.8` | Unit + component test runner | Vite-native, shares the Vite config/transform pipeline, Jest-compatible API. Use `environment: 'jsdom'`. |
| **@testing-library/react** `16.3.2` | Component testing | Standard for React 19. Pair with `@testing-library/jest-dom` `6.9.1` and `@testing-library/user-event` `14.6.1`. |
| **jsdom** `~26` | DOM for vitest | **Do not unit-test the WebGL canvas in jsdom** — jsdom has no WebGL. Test scene *logic* (coordinate math, box expansion, mesh-prop derivation) as pure functions; test the rendered canvas via Playwright or just smoke-mount with a mocked Canvas. |
| **@playwright/test** `1.60.0` | E2E | Drives the real Configure→Run→Result flow against a stubbed/mocked API (route interception) so the async poll path is tested deterministically. Can also visually assert the 3D canvas renders. |
| **eslint** `10.4.1` + **typescript-eslint** `8.60.1` | Lint | Flat config (`eslint.config.js`). Add `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`. |
| **prettier** `3.8.3` + **eslint-config-prettier** `10.1.8` | Format | Prettier owns formatting; `eslint-config-prettier` disables conflicting ESLint stylistic rules. |
| **vite-tsconfig-paths** `6.1.1` | Path aliases | Optional — lets `tsconfig` `paths` (e.g. `@/`) work in Vite + Vitest without duplicating alias config. |

## Installation

# Core runtime + build

# 3D (pin three exactly; r3f/drei majors are React-19-locked)

# Data fetching / forms / validation

# Routing + small utils

# Styling (Tailwind v4 — CSS-first, Vite plugin)

# Testing

# Lint / format

## Async Polling Pattern (TanStack Query)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TanStack Query for polling | Hand-rolled `setInterval` + `useEffect` | Almost never here. Only if you refuse a dependency — but you'd reimplement retries/cleanup/cancellation/stale handling worse. Query is the right tool for submit-then-poll. |
| TanStack Query | SWR | SWR is fine but Query's `useMutation` + `refetchInterval`-returning-`false` maps more directly onto the job lifecycle. Either works; Query is more featureful for this flow. |
| react-hook-form | Formik / TanStack Form | TanStack Form is promising and type-first; choose it only if the team already standardizes on it. RHF + `useFieldArray` is the proven, best-documented fit for a dynamic catalog. Avoid Formik (slower, heavier re-renders). |
| zod | valibot / arktype | valibot is lighter (better tree-shaking); switch only if bundle size becomes critical. zod's ecosystem (`@hookform/resolvers`, docs) makes it the safer default. |
| Tailwind v4 | CSS Modules | Use CSS Modules if the team prefers porting the mockup CSS verbatim with per-component scoping. Equally valid; lower learning curve, more boilerplate. |
| react-router | TanStack Router | TanStack Router has best-in-class type-safe routing; overkill for two routes. react-router is the lower-risk default. Wouter is a fine ultralight option too. |
| drei `<CameraControls>` | Port the mockup's manual `lerpVectors` camera animation | Only if drei's controls don't give the exact ISO/TOP/FRONT feel. Prefer drei first. |
| Vite `@vitejs/plugin-react` (Babel) | `@vitejs/plugin-react-swc` | Use SWC plugin if build/HMR speed ever matters at scale. For this app size, either is fine. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **React 18 with current r3f/drei** | r3f 9 peer is `react >=19 <19.3`; drei 10 peer is `react ^19`. Installing React 18 forces you onto r3f 8 + drei 9 (the legacy line) and you lose current fixes/features. | React 19 + r3f 9 + drei 10 (this stack). |
| **`react@>=19.3` / future React 19.3+** | r3f 9 explicitly caps at `<19.3`. Auto-upgrading React past that will break the r3f peer range until r3f publishes a new range. | Pin React to `19.2.x`; bump only when r3f's peer range widens. |
| **`three` with `^` caret** | three ships breaking changes on *minor* bumps (`0.x` semver). A caret will silently pull an incompatible scene API. | Pin three **exactly** (`0.184.0`) and bump deliberately alongside r3f/drei. |
| **Redux / Zustand for app state (initially)** | Stateless tool, no server persistence. TanStack Query owns server state; RHF owns form state; localStorage owns the saved draft. A global store is over-engineering. | TanStack Query + RHF + a thin `useLocalStorage`/context. Add Zustand only if cross-component UI state genuinely grows. |
| **A runtime backend / Node server in the image** | Project mandate: static build, single lightweight image, no backend of our own. | Multi-stage build → static `dist/` served by nginx. |
| **Runtime API-URL injection assumptions** | `VITE_API_URL` is baked at **build time** (`import.meta.env`). It is NOT changeable at container-run time without a rebuild or an entrypoint find/replace shim. | Document the build-time `--build-arg`/env. Optionally add an env-substitution entrypoint later (see Docker note). |
| **CSS-in-JS runtime (styled-components/emotion)** | Adds runtime weight to a bundle that should be tiny and static. | Tailwind v4 (zero runtime) or CSS Modules. |
| **Importing three from a CDN importmap (as the mockup does)** | Great for a mockup, wrong for a bundled SPA — breaks tree-shaking, versioning, and the r3f peer link. | `npm install three`; let Vite bundle it. |
| **Testing WebGL output in jsdom** | jsdom has no WebGL context; `<Canvas>` won't render. | Unit-test pure scene logic; verify rendered canvas in Playwright. |

## Stack Patterns by Variant

- Use `@react-three/fiber@8.18.0` + `@react-three/drei@9.122.0` (peers: `react ^18`, r3f `^8`).
- Three stays compatible (`three >=0.137` for that drei line).
- This is a *fallback only* — the current/standard 2026 stack is React 19. Do not choose this without a hard constraint.
- Swap zod → valibot; consider `@vitejs/plugin-react-swc`.
- Lazy-load the 3D viewer route (`React.lazy` + route-level code split) so three/r3f/drei aren't in the initial Configure-screen chunk. Recommended regardless — three is the heaviest dependency.
- Self-host the Inter + JetBrains Mono font files instead of the Google Fonts `<link>` (drop into `public/`, reference via `@font-face`/`@theme`). Removes the only external network dependency.

## Version Compatibility

| Package | Version | Peer requirement | Implication |
|---------|---------|------------------|-------------|
| `@react-three/fiber` | `9.6.1` | `react >=19 <19.3`, `react-dom >=19 <19.3`, `three >=0.156` | React 19 only; React capped below 19.3. |
| `@react-three/drei` | `10.7.7` | `react ^19`, `react-dom ^19`, `three >=0.159`, `@react-three/fiber ^9.0.0` | Locks the whole 3D trio to React 19 + r3f 9. |
| `three` | `0.184.0` | (none) | Satisfies both r3f `>=0.156` and drei `>=0.159`. Pin exactly. |
| `react` / `react-dom` | `19.2.7` | — | Latest 19.2.x; sits inside the `<19.3` cap. ✅ |
| Package | Version | Peer requirement |
|---------|---------|------------------|
| `@react-three/fiber` | `8.18.0` | `react >=18 <19`, `three >=0.133` |
| `@react-three/drei` | `9.122.0` | `react ^18`, `@react-three/fiber ^8`, `three >=0.137` |
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `vitest@4` | `vite@8` | Vitest 4 targets the Vite 6/7/8 line; shares your `vite.config.ts`. |
| `@tailwindcss/vite@4` | `vite@8` | Tailwind v4 is the Vite-plugin + CSS-first config era; no `tailwind.config.js` or `postcss.config.js` required. |
| `@testing-library/react@16` | `react@19` | v16 added React 19 support; required for this stack. |
| `react-router@7` | `react@19` | v7 merges `react-router` + `react-router-dom`; import from `react-router`. Use library (SPA) mode. |
| `@hookform/resolvers@5` | `react-hook-form@7` + `zod@4` | Resolver v5 supports zod v4. |
| `@types/three@0.184.1` | `three@0.184.0` | Keep `@types/three` minor in lockstep with `three`. |

## Docker / nginx Self-Host Recipe (Outline)

# ---- build stage ----

# VITE_API_URL is baked in at THIS step (build time).

# ---- serve stage ----

- **`try_files ... /index.html` (SPA fallback) is mandatory** — without it a refresh on `/result` returns nginx 404. This is the #1 self-host gotcha for client-routed SPAs.
- **Use `nginxinc/nginx-unprivileged`** (listens on 8080, runs as non-root) so the image is friendlier to restrictive self-host platforms (rootless Docker, Kubernetes `runAsNonRoot`). Plain `nginx:alpine` also works if root + port 80 is acceptable.
- **Build-time `VITE_API_URL`:** baked at `npm run build`. Self-hosters set it via `docker build --build-arg VITE_API_URL=...`. Per the project decision, reconfiguring the backend means a rebuild — accepted, and the API must allow CORS for the serving origin.
- **Optional runtime override (future):** if rebuild-to-reconfigure proves painful, add an nginx entrypoint that does `envsubst` on a small `/config.js` (`window.__CONFIG__`) read at app startup, instead of `import.meta.env`. Out of scope for v1 but worth flagging so the architecture doesn't preclude it.
- **Local dev:** use Vite `server.proxy` to forward `/api` to `https://packerapi.anzozulia.xyz`, sidestepping CORS during development without baking the URL.

## Sources

- npm registry (live, 2026-06-03) — exact published versions and **peer-dependency manifests** for: `@react-three/fiber@9.6.1` & `@8.18.0`, `@react-three/drei@10.7.7` & `@9.122.0`, `three@0.184.0`, `react@19.2.7`, `vite@8.0.16`, `@vitejs/plugin-react@6.0.2`, `@tanstack/react-query@5.101.0`, `react-hook-form@7.77.0`, `zod@4.4.3`, `@hookform/resolvers@5.4.0`, `tailwindcss@4.3.0`, `@tailwindcss/vite@4.3.0`, `react-router@7.16.0`, `nanoid@5.1.11`, `vitest@4.1.8`, `@testing-library/react@16.3.2`, `@playwright/test@1.60.0`, `eslint@10.4.1`, `typescript-eslint@8.60.1`, `prettier@3.8.3`, `eslint-config-prettier@10.1.8`, `typescript@6.0.3`, `@types/three@0.184.1`. — **HIGH confidence** (authoritative; constraints read from manifests, not training data).
- `design/config.html`, `design/result.html` — confirmed visual target: Inter + JetBrains Mono, accent `#4f46e5`, CSS-variable token system, Three.js `0.160` via CDN importmap with `OrbitControls`. Informs the Tailwind-token mapping recommendation. — **HIGH confidence**.
- `.planning/PROJECT.md` — constraints (build-time `VITE_API_URL`, async submit-then-poll, single static Docker image, localStorage-only, mm/kg units, no backend). — **HIGH confidence**.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
