// useSubmitJob — MSW-backed (Pitfall 6) mutation tests: a valid request POSTs to /pack and
// resolves a job_id (the 202 shape); a non-2xx POST surfaces an error (PackError 'unreachable'
// bucket) without crashing the hook. NEVER hits the live API — MSW only.
import { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { useSubmitJob } from '@/api/useSubmitJob';
import { PackError } from '@/api/errors';
import type { PackRequest } from '@/types/pack-contract';

/** A minimal-but-valid pack request — only shape matters; the MSW handler ignores the body. */
const SAMPLE_REQUEST: PackRequest = {
  boxes: [{ id: 'b1', length: 100, width: 100, height: 100, weight: 1, rotations: 'all' }],
  pallet: { length: 1200, width: 800, height: 1500, max_weight: 1000, max_overhang: 0 },
  options: { max_pallets: 1, time_budget_s: 5, seed: 1, support_ratio: 0.5 },
};

/** A fresh isolated QueryClient per render (retry:false) — the RTL+react-query gotcha. */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useSubmitJob', () => {
  it('resolves a job_id from the MSW POST 202', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitJob(), { wrapper });

    const controller = new AbortController();
    result.current.mutate({ request: SAMPLE_REQUEST, signal: controller.signal });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
    expect(result.current.data?.job_id).toBe('test-job-1');
    expect(result.current.data?.status).toBe('queued');
  });

  it('surfaces an error (unreachable bucket) on a non-2xx POST', async () => {
    server.use(
      http.post('*/api/v1/pack', () => HttpResponse.json({ code: 'boom' }, { status: 500 })),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitJob(), { wrapper });

    const controller = new AbortController();
    result.current.mutate({ request: SAMPLE_REQUEST, signal: controller.signal });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    // The thrown value is surfaced AS-IS (a PackError) for the page to classify — not swallowed.
    expect(result.current.error).toBeInstanceOf(PackError);
    expect((result.current.error as PackError).kind).toBe('unreachable');
  });

  it('forwards the AbortSignal to submitPackJob', async () => {
    // Aborting before the POST resolves surfaces an error, proving the signal reaches fetch.
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitJob(), { wrapper });

    const controller = new AbortController();
    controller.abort();
    result.current.mutate({ request: SAMPLE_REQUEST, signal: controller.signal });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.error).toBeDefined();
  });
});
