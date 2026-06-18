# Pallet Packer

A free, open-source, self-hostable web tool for pallet packing.

## What it is

Pallet Packer lets you describe a pallet and a catalog of boxes, submit the job to an
**existing external packing API**, and get back an explorable 3D plan showing exactly
where every box goes — with fill rate, total weight, centre-of-gravity, and per-box
stacking-support stability. No login, no accounts, no stored history. Just the tool.

This repository is a **frontend only**. It is a static single-page app that talks to a
separate packing API over HTTP. It does not include or bundle a solver — you must point
it at a running packing API (see [Configuration](#configuration)). A public reference
API is available at `https://packerapi.anzozulia.xyz`.

## Try it / Demo

The Configure page has one-click **"Try a demo"** presets. Each preset prefills a fixed
pallet and a hand-tuned box catalog, so you can run a real packing job and explore the
3D result immediately — no data entry required. Pick a preset, hit **Run**, and explore.

## Features

- **Dynamic box catalog** — add/remove typed box rows (dimensions, weight, quantity,
  fragile, rotation mode) with live validation.
- **Millimetres / kilograms** — integer mm dimensions, kg weights, matching the API.
- **Async submit-then-poll** — the frontend submits the job and polls for completion;
  it never blocks on a synchronous response.
- **Explorable 3D viewer** — orbit, zoom, and pan with one-click **ISO / TOP / FRONT**
  camera presets.
- **Centre-of-gravity marker** — visualises the computed CoG of the loaded pallet.
- **Support heatmap** — per-box stacking-support colouring for stability inspection.
- **localStorage draft persistence** — your in-progress configuration is auto-saved
  locally and restored on reload (no server, no account).
- **Single static Docker image** — a tiny nginx-served static build for easy self-hosting.

## Quick start (Docker)

`VITE_API_URL` is **required** and is **baked in at build time** (it cannot be changed
at container-run time). Build the image, pointing it at your packing API:

```sh
docker build --build-arg VITE_API_URL=https://packerapi.anzozulia.xyz -t pallet-packer .
docker run --rm -p 8080:8080 pallet-packer
```

Then open <http://localhost:8080>.

The image is a static build served by `nginx-unprivileged` — it runs as a **non-root**
user and listens on **port 8080**, which is friendly to rootless Docker and Kubernetes
`runAsNonRoot` policies.

## Quick start (docker compose)

```sh
docker compose up --build
```

`VITE_API_URL` is read from your shell environment (or the default in
[`docker-compose.yml`](./docker-compose.yml)) and passed as a build arg. To target a
different backend:

```sh
VITE_API_URL=https://my-packer.example.com docker compose up --build
```

Because the URL is baked at build time, changing it requires `--build` again.

## Configuration

| Setting        | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| `VITE_API_URL` | **Build-time only.** The origin of your packing API. **Required** for production builds. |

- **Build-time only.** `VITE_API_URL` is read via `import.meta.env` and baked into the
  static bundle. To change the backend, **rebuild** the image.
- **Fail-loud.** A production build with **no** `VITE_API_URL` throws at module load
  rather than silently shipping a broken/URL-less app.
- **CORS.** Because the static app calls the API directly from the browser, the API must
  send CORS headers allowing your serving origin.
- **Origin only.** The client owns the `/api/v1` path prefix — set `VITE_API_URL` to the
  API **origin** (e.g. `https://packerapi.anzozulia.xyz`), not a full path.

### API contract (submit-then-poll)

1. `POST /api/v1/pack` → `202 { "job_id": "..." }`
2. Poll `GET /api/v1/jobs/{job_id}` until `status` is `done`, `failed`, or `timeout`.
3. On `done`, the response carries the placement result the 3D viewer renders.

See [`.env.example`](./.env.example) for the documented env var.
Reference / public API: `https://packerapi.anzozulia.xyz`.

## Local development

Requires **Node 22**.

```sh
npm ci
npm run dev
```

Then open <http://localhost:5173>.

For local dev the Vite dev server proxies `/api` to the public packing API, so you need
**no CORS configuration** and **no `VITE_API_URL`** — the proxy handles it.

## Scripts

| Script              | Command                    | Purpose                                          |
| ------------------- | -------------------------- | ------------------------------------------------ |
| `npm run dev`       | `vite`                     | Start the dev server (port 5173) with API proxy. |
| `npm run build`     | `tsc -b && vite build`     | Type-check then produce the static `dist/`.      |
| `npm run preview`   | `vite preview --port 4173` | Serve the built `dist/` locally (port 4173).     |
| `npm run typecheck` | `tsc -b --noEmit`          | Type-check without emitting.                     |
| `npm run lint`      | `eslint .`                 | Lint the codebase.                               |
| `npm run format`    | `prettier --write .`       | Format the codebase.                             |
| `npm run test`      | `vitest run`               | Run unit/component tests.                        |
| `npm run test:e2e`  | `playwright test`          | Run Playwright end-to-end tests.                 |

## Testing

- **Unit / component** — Vitest in a jsdom environment. The WebGL canvas is **not**
  unit-tested (jsdom has no WebGL); 3D scene logic (coordinate mapping, box expansion,
  mesh-prop derivation) is tested as pure functions.
- **End-to-end** — Playwright drives the real Configure → Run → Result flow against the
  built `dist/` via `vite preview`, with the packing API intercepted/mocked so the
  submit-then-poll path is deterministic.
- **Code-split gate** — `node scripts/check-code-split.mjs` runs after `npm run build`
  and fails if `three` leaks into the entry (Configure) chunk; it must live only in the
  lazy `/result` chunk.

## Tech stack

| Concern             | Choice                                                    |
| ------------------- | --------------------------------------------------------- |
| Runtime             | React 19.2.7                                              |
| Build tool          | Vite 8                                                    |
| Language            | TypeScript 6                                              |
| 3D                  | three 0.184 · @react-three/fiber 9 · @react-three/drei 10 |
| Server state / poll | @tanstack/react-query                                     |
| Forms + validation  | react-hook-form · zod · @hookform/resolvers               |
| Styling             | Tailwind CSS v4                                           |
| Routing             | react-router 7 (SPA mode)                                 |
| ID generation       | nanoid                                                    |

## Project structure

```
src/
  api/        # packing API client (submit-then-poll), zod-at-boundary
  components/ # shared UI; 3D viewer + result-page building blocks
  features/
    config/   # Configure page — dynamic box catalog form
    loading/  # eager, three-free loading/poll route
  hooks/      # reusable hooks
  lib/        # pure logic: coordinate mapping, palette, persistence
  routes/     # route components (Configure, Result)
  types/      # shared TS types + the API contract
```

## Deployment

- **Single static Docker image.** A multi-stage build produces `dist/`, served by
  `nginx-unprivileged` (non-root, port 8080).
- **SPA fallback is mandatory.** The nginx config uses `try_files ... /index.html` so
  deep links like `/result` resolve on refresh instead of returning a 404. This is the
  #1 self-host gotcha for client-routed SPAs.
- **Long-cached assets.** Hashed asset files are served with
  `Cache-Control: max-age=31536000, immutable`.
- **Reconfigure = rebuild.** Runtime API-URL override is out of scope for v1; to change
  the backend, rebuild the image with a new `VITE_API_URL` build arg.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the dev loop, the full pre-PR gate, and the
code-split rule.

## License

[MIT](./LICENSE) © Pallet Packer contributors.
