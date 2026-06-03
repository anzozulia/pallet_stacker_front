import { defineConfig } from '@playwright/test';

// The smoke test must run against the REAL static production build (the same
// `dist/` Docker serves), NOT the dev server — so `webServer` builds and then
// boots `vite preview` on 4173. `reuseExistingServer` reuses a server already
// running locally (fast inner loop) but forces a fresh one in CI.
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    // Generous timeout: the first run pays for `tsc -b && vite build` (the lazy
    // three/r3f/drei chunk is large) before preview comes up.
    timeout: 120_000,
  },
});
