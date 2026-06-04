import { defineConfig } from '@playwright/test';

// The smoke test must run against the REAL static production build (the same
// `dist/` Docker serves), NOT the dev server — so `webServer` builds and then
// boots `vite preview` on 4173. `reuseExistingServer` reuses a server already
// running locally (fast inner loop) but forces a fresh one in CI.
//
// VITE_API_URL is baked at build time to the preview ORIGIN (http://localhost:4173).
// This is REQUIRED since WR-01: a production build with no VITE_API_URL now throws at
// module load (fail-loud guard in src/api/client.ts), which would crash the app before
// any test could run. The value is the same-origin preview host, so every request
// resolves to http://localhost:4173/api/v1/... — and EVERY one of those is still
// stubbed via page.route('**/api/v1/**') in the specs. The build is NEVER pointed at,
// and the tests NEVER hit, a live packing API (CLAUDE.md).
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'VITE_API_URL=http://localhost:4173 npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    // Generous timeout: the first run pays for `tsc -b && vite build` (the lazy
    // three/r3f/drei chunk is large) before preview comes up.
    timeout: 120_000,
  },
});
