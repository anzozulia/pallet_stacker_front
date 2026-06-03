# Phase 1: Scaffolding & Version Lock - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A version-locked **Vite + React 19.2.x + TypeScript** SPA skeleton with **@react-three/fiber 9 / @react-three/drei 10 / three 0.184.0** (three pinned exactly, no caret) that:
- installs with no peer-dependency conflicts,
- runs in dev rendering an empty r3f `<Canvas>` with no WebGL errors,
- runs a passing Vitest sample and a passing Playwright smoke test,
- builds to static assets served from a multi-stage **non-root nginx** Docker image, and
- reads `VITE_API_URL` at build time with a CORS-free Vite dev proxy.

This is **foundational scaffolding only** — by design no v1 requirement is fully delivered here. It is the foundation every later phase (2–7) builds on. The version quartet is treated as a single locked unit, never auto-upgraded.

**Scope guardrail:** Decisions here clarify *how* to scaffold, not *what features* to add. No config form, no API client, no real 3D content, no transforms — those are Phases 3–6.

</domain>

<decisions>
## Implementation Decisions

### Skeleton scope (directory architecture)
- **D-01:** **Thin, signposted** structure. Create the top-level directories the roadmap already names, near-empty (one stub or `.gitkeep` each) — signals intent to contributors without speculative files. Final shape:
  ```
  src/
    components/   # shared UI (one sample component)
    features/     # empty (.gitkeep) — populated Phases 4/6
    lib/          # pure transforms land here (Phases 2/3)
    api/          # typed client lands here (Phase 5)
    types/        # zod-derived API contract types
    routes/       # page components (ConfigurePage, ResultPage)
    App.tsx
    main.tsx
  ```
- **D-02:** Do **not** scaffold placeholder logic files (no empty client, no stub transform modules). Folders are signposts; real files arrive when their phase needs them. This honors the inside-out roadmap (lib → api → features) without premature churn.

### Routing & 3D code-split
- **D-03:** Wire **`createBrowserRouter` (react-router 7, SPA/library mode)** with two routes from Phase 1:
  - `/` → `ConfigurePage` (placeholder)
  - `/result` → **`React.lazy`-loaded** `ResultPage`
- **D-04:** The empty `<Canvas>` (Phase 1's "renders r3f Canvas without WebGL errors" criterion) lives on the **lazy `/result` route**, so `three` / r3f / drei land in the `/result` chunk and stay **out of the initial Configure-screen bundle**. (three is the heaviest dependency; route-level split is recommended regardless.)
- **D-05:** This also exercises the **nginx SPA fallback** (`try_files … /index.html`) for deep-link refresh early — the #1 self-host gotcha — rather than discovering it in Phase 7.
- The Playwright smoke test should navigate to `/result` to assert the Canvas mounts.

### Styling
- **D-06:** **Tailwind v4** via `@tailwindcss/vite` (CSS-first, no `tailwind.config.js`, no PostCSS wiring). Confirmed over the CSS-Modules fallback.
- **D-07:** **Minimal `@theme` in Phase 1** — fonts + accent only:
  ```css
  @import "tailwindcss";
  @theme {
    --font-sans: 'Inter', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --color-accent: #4f46e5;
  }
  ```
  The full mockup palette (surfaces, the `--d-bg:#0c0f17` dark 3D-overlay token group, etc.) is ported **per-phase** as real UI lands (Phase 4 form, Phase 6 result). Rationale: PROJECT.md says the design is explicitly subject to change — avoid transcribing tokens before screens exist.

### Fonts
- **D-08:** **Self-host Inter + JetBrains Mono from Phase 1** — font files in `public/`, referenced via `@font-face` and exposed through `@theme`. Removes the only external network dependency, directly serving the offline / single-container self-host story (a core project value). Do **not** use the Google Fonts `<link>` the mockups use.

### CI & quality gates
- **D-09:** **GitHub Actions CI now** — pipeline runs `npm ci` → typecheck → lint → unit test → build, plus a Playwright smoke job. Green-on-PR from commit #1.
- **D-10:** **husky + lint-staged pre-commit, kept light** — `eslint --fix` + `prettier --write` on **staged files only**. Heavy checks (full test/build) stay in CI, not the hook. Flat ESLint config (`eslint.config.js`).
- **D-11:** These are treated as Phase-1 foundation (not Phase-7 scope creep): they guard quality for every later phase. The GitHub *publish + README/docs* deliverable (HOST-03) remains Phase 7.

### Licensing
- **D-12:** **MIT license.** Permissive, shortest, the conventional default for JS/React tooling — maximizes adoption/contribution for a free self-hostable tool. `LICENSE` file ships in Phase 1.

### Claude's Discretion (locked defaults per CLAUDE.md; planner may proceed)
- **D-13:** Vite React plugin: **`@vitejs/plugin-react` (Babel)** — standard default; SWC unnecessary at this app size.
- **D-14:** Build-stage base image: **`node:22-alpine`** (LTS). Serve stage: **`nginxinc/nginx-unprivileged:alpine`** (port 8080, non-root) per CLAUDE.md.
- **D-15:** **`vite-tsconfig-paths`** enabled for `@/` path aliases — pairs naturally with the signposted directory layout (`@/lib`, `@/api`, `@/types`).
- **D-16:** Dev proxy: Vite `server.proxy` forwards `/api` → `https://packerapi.anzozulia.xyz` (CORS-free local dev), per CLAUDE.md. `VITE_API_URL` baked at build time via `import.meta.env`; documented for `docker build --build-arg`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked tech stack & build/deploy recipe
- `CLAUDE.md` — **the prescriptive stack and version-compatibility matrix** (verified 2026-06-03): exact versions for the React 19.2.x / r3f 9 / drei 10 / three 0.184.0 quartet and all supporting libs; peer-dependency constraints; Tailwind v4 CSS-first setup; the multi-stage Docker / nginx-unprivileged recipe; the SPA-fallback gotcha; the build-time `VITE_API_URL` + dev-proxy guidance; and the "What NOT to Use" list. **This is the single source of truth for Phase 1 — read it fully before planning.**

### Visual / design north star (token + font source)
- `design/config.html` — Configure screen mockup; source of the accent `#4f46e5`, the CSS-variable token system, Inter + JetBrains Mono.
- `design/loading.html` — async loading-screen mockup (relevant later, but defines shared tokens).
- `design/result.html` — Result screen + 3D viewer mockup; the dark overlay tokens (`--d-bg:#0c0f17`, etc.) and Three.js `0.160`-via-CDN reference. **Design is explicitly subject to change** (per PROJECT.md) — treat as visual intent, not a CSS spec to port verbatim.

### Project constraints & scope
- `.planning/PROJECT.md` — constraints (build-time `VITE_API_URL`, static single-image deploy, localStorage-only, mm/kg units, no backend), Key Decisions table, and Out-of-Scope boundaries.
- `.planning/ROADMAP.md` §"Phase 1" — the goal and the 5 success criteria this phase is measured against.
- `.planning/REQUIREMENTS.md` — full v1 requirement IDs (none fully delivered in Phase 1, but the foundation must not preclude any).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **No application source exists yet** — this is a greenfield repo (`.claude/`, `.planning/`, `CLAUDE.md`, `design/` only; no `package.json`). Phase 1 creates the project from scratch.
- `design/*.html` — high-fidelity vanilla HTML/CSS/JS + Three.js mockups. Reusable as the **visual reference and token source**, not as importable code (the CDN-importmap Three.js approach is explicitly rejected for the bundled SPA — see CLAUDE.md "What NOT to Use").

### Established Patterns
- **None in code yet** — Phase 1 *establishes* the patterns (folder layout, route shell, Tailwind token convention, test layout) that later phases follow. The roadmap's inside-out ordering (`lib/` pure transforms → `api/` client → `features/` UI) is the architectural pattern to signpost.

### Integration Points
- **Vite dev proxy** `/api` → `https://packerapi.anzozulia.xyz` is the only external integration touched in Phase 1 (just proxy wiring + a reachability check; no real client yet).
- **`VITE_API_URL`** build-time env is the seam every later API-calling phase reads through `import.meta.env`.

</code_context>

<specifics>
## Specific Ideas

- The empty `<Canvas>` must render **without WebGL errors** — for the Playwright smoke test, mount it on `/result` and assert the canvas element exists (jsdom has no WebGL, so unit tests must not try to render the Canvas — verify in Playwright).
- Keep pre-commit hooks deliberately **fast/light** so contributors aren't punished on every commit; CI is the heavy gate.
- Tailwind v4 makes every `@theme` token a real CSS custom property — usable from utilities *and* raw CSS/inline styles, which will matter for the r3f dark-overlay tokens added in Phase 6.

</specifics>

<deferred>
## Deferred Ideas

- **Full mockup token palette** (surfaces, dark 3D-overlay group, state colors) → ported per-phase as UI lands (Phase 4 config form, Phase 6 result viewer). Not Phase 1.
- **README / self-host docs + nginx reverse-proxy recipe + GitHub publish** → **Phase 7** (HOST-03). Phase 1 ships CI + LICENSE only, not the docs site.
- **Runtime `VITE_API_URL` override** (nginx `envsubst` on a `/config.js` `window.__CONFIG__` shim) → explicitly out of scope for v1; flagged in CLAUDE.md so the architecture doesn't preclude it. Revisit only if rebuild-to-reconfigure proves painful.
- **Standard pallet presets / CSV import / share-via-URL** (v2 requirements) → future milestone.

None of the above are scope creep into Phase 1 — they are correctly-placed later work.

</deferred>

---

*Phase: 1-Scaffolding & Version Lock*
*Context gathered: 2026-06-03*
