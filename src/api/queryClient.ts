// The single app-wide QueryClient (C-01 / D-05): mounted ONCE at module scope and handed to
// the `<QueryClientProvider>` in main.tsx. This is the PRODUCTION client — its cache is the
// in-memory carrier that survives the /loading → /result hand-off (the poll query keeps the
// `done` payload with gcTime:Infinity, see usePollJob.ts). Tests do NOT use this instance:
// they create a fresh isolated client per render (renderWithClient / makeWrapper) so cached
// state never leaks between tests.
//
// Code-split gate (C-05): imports ONLY react-query — no three/r3f/drei, no IO. Safe in the
// initial Configure-screen chunk.
import { QueryClient } from '@tanstack/react-query';

/**
 * The app-wide react-query client. Defaults: `retry: false` (a failing POST/poll is surfaced
 * as the unreachable bucket for the user's explicit Retry, never silently re-fired — T-5-05 /
 * D-07), and a generous `staleTime` for the few non-poll reads. The poll query overrides its
 * own per-query options (`refetchInterval`, `gcTime: Infinity`) at the `usePollJob` call site.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
