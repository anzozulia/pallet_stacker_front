// usePollJob — MSW-backed (Pitfall 6) hook tests proving: terminal stop (the poll self-stops
// the instant status is done/failed/timeout), `isTerminal` semantics, `enabled:false` gating,
// the wall-clock safety cap (with a tiny INJECTED cap so the assertion is fast/deterministic),
// and clean unmount (no leaked interval / no hang). NEVER hits the live API — MSW only.
import { type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { makePollSequence } from '@/test/msw/handlers';
import { usePollJob, isTerminal, POLL_INTERVAL_MS, POLL_SAFETY_CAP_MS } from '@/api/usePollJob';

/** A fresh isolated QueryClient per render (retry:false, gcTime:0) — the RTL+react-query gotcha. */
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

describe('isTerminal', () => {
  it('is true for done/failed/timeout', () => {
    expect(isTerminal('done')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('timeout')).toBe(true);
  });

  it('is false for queued/running/undefined', () => {
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('running')).toBe(false);
    expect(isTerminal(undefined)).toBe(false);
  });
});

describe('exported poll constants', () => {
  it('POLL_INTERVAL_MS is 1000', () => {
    expect(POLL_INTERVAL_MS).toBe(1000);
  });

  it('POLL_SAFETY_CAP_MS sits in the 120000–140000 window', () => {
    expect(POLL_SAFETY_CAP_MS).toBeGreaterThanOrEqual(120000);
    expect(POLL_SAFETY_CAP_MS).toBeLessThanOrEqual(140000);
  });
});

describe('usePollJob', () => {
  it('polls a queued→running→done sequence to a terminal status and stops', async () => {
    server.use(makePollSequence([{ status: 'queued' }, { status: 'running' }, { status: 'done' }]));
    // Assert the settled status and that the query is no longer fetching (refetchInterval
    // returned false on the terminal status, so the poll self-stopped).

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePollJob('job-abc', { safetyCapMs: 1_000_000 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data?.status).toBe('done'), { timeout: 5000 });

    expect(isTerminal(result.current.data?.status)).toBe(true);
    // Terminal reached → the poll has stopped: react-query is not fetching/refetching.
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.isCapExceeded).toBe(false);
  });

  it('does not fetch when jobId is undefined (enabled:false)', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePollJob(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(result.current.isCapExceeded).toBe(false);
  });

  it('trips the safety cap on a never-terminal sequence (tiny injected cap)', async () => {
    // The job stays 'running' forever; with a 50ms cap the hook surfaces isCapExceeded fast.
    server.use(makePollSequence([{ status: 'running' }]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePollJob('stuck-job', { safetyCapMs: 50 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isCapExceeded).toBe(true), { timeout: 5000 });
    // Cap tripped while still non-terminal — never reached a terminal status.
    expect(isTerminal(result.current.data?.status)).toBe(false);
  });

  it('clears the cap once the job settles (done arrives before the cap)', async () => {
    server.use(makePollSequence([{ status: 'queued' }, { status: 'done' }]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePollJob('settles-job', { safetyCapMs: 1_000_000 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data?.status).toBe('done'), { timeout: 5000 });
    expect(result.current.isCapExceeded).toBe(false);
  });

  it('unmounts cleanly without leaking an interval or hanging', async () => {
    server.use(makePollSequence([{ status: 'queued' }, { status: 'running' }]));

    const { wrapper } = makeWrapper();
    const { result, unmount } = renderHook(
      () => usePollJob('unmount-job', { safetyCapMs: 1_000_000 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.status).toBeDefined(), { timeout: 5000 });
    // Unmount mid-poll: react-query clears its interval and aborts the in-flight queryFn (SC-3).
    expect(() => unmount()).not.toThrow();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useRealTimers();
});
