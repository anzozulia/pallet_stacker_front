import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// tsconfigPaths() MUST be registered here too — Vitest does NOT inherit the
// plugin list from vite.config.ts when the test config lives in its own file.
// Without it, `@/`-aliased imports resolve under `npm run dev` but break under
// `npm run test` (the #1 alias-breaks-in-tests gotcha; 01-RESEARCH Pitfall 4).
// The Tailwind plugin is intentionally absent — tests don't need CSS processing.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Exclude the Playwright specs so Vitest never tries to run them — they live
    // in their own runner and import the WebGL Canvas (jsdom has no WebGL).
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
