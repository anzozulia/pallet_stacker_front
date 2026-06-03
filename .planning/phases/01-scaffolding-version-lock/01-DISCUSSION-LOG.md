# Phase 1: Scaffolding & Version Lock - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 1-Scaffolding & Version Lock
**Areas discussed:** Skeleton scope, Routing & 3D split, Styling setup, CI & quality gates (incl. license, fonts)

---

## Area selection

User selected **all four** offered gray areas to discuss: Skeleton scope, Routing & 3D split, Styling setup, CI & quality gates. (Most of the stack was pre-locked by CLAUDE.md; unpicked items would have used CLAUDE.md defaults.)

---

## Skeleton scope (directory architecture)

| Option | Description | Selected |
|--------|-------------|----------|
| Thin, signposted | Name the roadmap's top-level dirs (lib/api/components/features/types/routes), near-empty stubs | ✓ |
| Bare minimum | Only what Phase 1 criteria need; later phases create their own folders | |
| Full skeleton | Stub every folder AND placeholder logic files | |

**User's choice:** Thin, signposted
**Notes:** Matches the inside-out roadmap (lib → api → features) without premature/speculative logic files. Researched 2026 consensus: feature-based is standard but YAGNI on upfront folders — the well-mapped roadmap is the case where thin signposting pays off.

---

## Routing & 3D split

| Option | Description | Selected |
|--------|-------------|----------|
| Both routes + lazy 3D | createBrowserRouter; `/` Configure placeholder + `/result` lazy ResultPage holding the empty Canvas; three/r3f out of initial chunk | ✓ |
| Single page, Canvas inline | One placeholder page renders Canvas, no router; defer routing to Phase 4/6 | |
| Both routes, Canvas eager | Wire both routes but no lazy-split (three in main chunk) | |

**User's choice:** Both routes + lazy 3D
**Notes:** Proves the SPA-fallback (deep-link refresh) + bundle-split foundation in Phase 1. CLAUDE.md already recommends lazy-loading the 3D viewer route "regardless." Playwright smoke test targets `/result`.

---

## Styling setup

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind v4, minimal setup | @tailwindcss/vite + base @theme (fonts + accent); port full palette per-phase | ✓ |
| Tailwind v4, port tokens now | Transcribe the full mockup token system into @theme up front | |
| CSS Modules instead | Port mockup CSS verbatim, scoped per component (documented fallback) | |

**User's choice:** Tailwind v4, minimal setup
**Notes:** PROJECT.md states design is subject to change, so avoid transcribing the full palette before screens exist. Tailwind v4 makes every @theme token a CSS variable (usable from utilities + raw CSS) — good fit for later r3f overlay tokens.

---

## CI & quality gates

| Option | Description | Selected |
|--------|-------------|----------|
| CI + light hooks now | GitHub Actions (typecheck/lint/test/build + Playwright) AND husky + lint-staged (staged-only) | ✓ |
| CI only, no hooks | GitHub Actions but skip local pre-commit hooks | |
| Defer all to Phase 7 | Local npm scripts only; add CI + hooks at GitHub publish | |

**User's choice:** CI + light hooks now
**Notes:** Treated as Phase-1 foundation guarding every later phase, distinct from the Phase-7 GitHub publish/docs deliverable (HOST-03). Pre-commit kept light (lint/format on staged files); heavy checks live in CI.

---

## License

| Option | Description | Selected |
|--------|-------------|----------|
| MIT | Permissive, shortest, conventional JS/React default | ✓ |
| Apache-2.0 | Permissive + explicit patent grant / NOTICE | |
| Decide in Phase 7 | Add LICENSE at GitHub publish | |

**User's choice:** MIT

---

## Fonts

| Option | Description | Selected |
|--------|-------------|----------|
| Self-host now | Inter + JetBrains Mono in public/, via @font-face/@theme from Phase 1 | ✓ |
| Google Fonts link for now | Keep mockups' <link>; self-host later | |

**User's choice:** Self-host now
**Notes:** Removes the only external network dependency — serves the offline / single-container self-host story (a core project value).

---

## Claude's Discretion

Locked to CLAUDE.md defaults (planner may proceed without re-asking):
- Vite React plugin: `@vitejs/plugin-react` (Babel) over SWC.
- Build base image `node:22-alpine`; serve via `nginxinc/nginx-unprivileged:alpine` (port 8080, non-root).
- `vite-tsconfig-paths` for `@/` aliases (pairs with signposted dirs).
- Dev proxy `/api → https://packerapi.anzozulia.xyz`; `VITE_API_URL` baked at build via `import.meta.env`.

## Deferred Ideas

- Full mockup token palette → ported per-phase (Phases 4/6).
- README / self-host docs / nginx reverse-proxy recipe / GitHub publish → Phase 7 (HOST-03).
- Runtime `VITE_API_URL` override (nginx envsubst `/config.js` shim) → out of scope for v1; architecture must not preclude it.
- v2 requirements (pallet presets, CSV import, share-via-URL) → future milestone.
