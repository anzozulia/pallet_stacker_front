// RTL + react-query isolation helper (the standard test gotcha): every test gets a FRESH
// QueryClient so cached query state never leaks between tests, with retry DISABLED (so a
// handler that returns an error settles immediately instead of retrying for ~seconds) and
// gcTime:0 (no lingering cache). Wraps `ui` in a QueryClientProvider and returns the RTL
// result plus the client (so a test can inspect/await the cache directly).
import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';

export interface RenderWithClientResult extends RenderResult {
  client: QueryClient;
}

export function renderWithClient(ui: ReactElement): RenderWithClientResult {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...result, client };
}
