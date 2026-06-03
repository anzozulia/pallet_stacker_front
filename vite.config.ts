import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Two distinct seams (D-16), do not conflate:
//  1. Dev proxy (server.proxy below): exists ONLY in `npm run dev`. Lets local
//     code fetch('/api/...') with no CORS and no baked URL. Absent in production.
//  2. Build-time env (import.meta.env.VITE_API_URL): baked into JS at build time,
//     read by the API client in Phase 5. Typed in src/vite-env.d.ts, not consumed yet.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    proxy: {
      '/api': {
        target: 'https://packerapi.anzozulia.xyz',
        changeOrigin: true, // sets Host header to target — required for TLS SNI
        secure: true, // target is HTTPS with a valid cert
        // no rewrite: forward /api as-is (A2); Phase 5 resolves the exact prefix
      },
    },
  },
});
