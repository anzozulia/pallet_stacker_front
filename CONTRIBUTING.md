# Contributing to Pallet Packer

Thanks for helping improve Pallet Packer! This guide covers the local setup, the full
gate to run before opening a PR, and the project conventions.

## Prerequisites

- **Node 22**
- Install dependencies with the committed lockfile:

  ```sh
  npm ci
  ```

## Dev loop

```sh
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the public packing
API, so you need no CORS setup and no `VITE_API_URL` locally.

## Run the full gate before a PR

Run the complete gate locally and make sure every step passes before opening a pull
request:

```sh
npm run typecheck && npm run lint && npm run test && npm run build && node scripts/check-code-split.mjs && npm run test:e2e
```

This mirrors CI: type-check, lint, unit/component tests, production build, the code-split
gate, then the Playwright e2e suite.

> Playwright needs its browser binaries once: `npx playwright install --with-deps chromium`.

## The code-split rule

The 3D engine (`three` / `@react-three/fiber` / `@react-three/drei`) and any viewer
module must live **only** in the lazy-loaded `/result` chunk — never in the Configure /
entry chunk.

- **Do not** import `three`, `@react-three/*`, or any viewer module from config or other
  non-viewer code.
- `scripts/check-code-split.mjs` enforces this after `npm run build` and exits non-zero
  (failing the build gate) if `three` leaks into the entry chunk.

## Commit & style conventions

- Use **conventional-commit-style** messages, e.g. `feat: ...`, `fix: ...`,
  `docs: ...`, `chore: ...`, `refactor: ...`, `test: ...`.
- **husky + lint-staged** run automatically on commit: staged `*.{ts,tsx}` files get
  `eslint --fix` then `prettier --write`, and staged `*.{css,json,md}` files get
  `prettier --write` (see the `lint-staged` config in `package.json`). Let these run —
  don't bypass the hooks.
- Keep formatting to Prettier; don't hand-format.

## License

By contributing you agree your contributions are licensed under the project's
[MIT License](./LICENSE).
