// usePollJob — MSW-backed (Pitfall 6) hook tests proving: terminal stop (the poll self-stops
// the instant status is done/failed/timeout), `isTerminal` semantics, `enabled:false` gating,
// the wall-clock safety cap (with a tiny INJECTED cap so the assertion is fast/deterministic),
// and clean unmount (no leaked interval / no hang). NEVER hits the live API — MSW only.
import { type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { makePollSequence } from '@/test/msw/handlers';
import { usePollJob, isTerminal, POLL_INTERVAL_MS, POLL_SAFETY_CAP_MS } from '@/api/usePollJob';

/**
 * A never-terminal GET /jobs/:id handler that counts how many times it is hit, so a test can
 * assert the poll loop actually STOPS firing GETs once the cap trips (CR-02). Always returns
 * `running`, so without the cap-gate the loop would run forever.
 */
function makeCountingRunningHandler() {
  const counter = { calls: 0 };
  const handler = http.get('*/api/v1/jobs/:id', ({ params }) => {
    counter.calls += 1;
    return HttpResponse.json({ job_id: String(params.id), status: 'running' }, { status: 200 });
  });
  return { counter, handler };
}

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

  it('STOPS firing GET /jobs/{id} once the cap trips on a never-terminal job (CR-02 regression)', async () => {
    // Drive a job that stays 'running' forever past a tiny injected cap, then assert the GET
    // call count stops increasing — the cap must disable the query (abort the in-flight GET +
    // clear the interval), not merely paint a UI overlay. On the OLD code this count kept
    // climbing at 1 Hz indefinitely.
    const { counter, handler } = makeCountingRunningHandler();
    server.use(handler);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePollJob('stuck-loop-job', { safetyCapMs: 50 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isCapExceeded).toBe(true), { timeout: 5000 });

    // Capture the count the moment the cap trips, then wait well past several poll intervals.
    const callsAtTrip = counter.calls;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 3));

    // The loop is stopped: at most one more in-flight GET may have been already dispatched at
    // the trip instant, but no further polling occurs.
    expect(counter.calls).toBeLessThanOrEqual(callsAtTrip + 1);
    expect(result.current.isCapExceeded).toBe(true);
  });

  it('does NOT inherit a stale cap trip when re-armed with a NEW jobId — Retry recovers (CR-01 regression)', async () => {
    // Trip the cap on a stuck job, then re-arm the SAME hook instance with a new job_id (the
    // Retry path: LoadingPage keeps one usePollJob instance and feeds it a fresh job_id). On the
    // OLD boolean-latch code isCapExceeded stayed true and the timeout card showed instantly on
    // the new job; with the tripped-job-identity latch it must be false for the new job.
    server.use(makePollSequence([{ status: 'running' }]));

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string }) => usePollJob(jobId, { safetyCapMs: 50 }),
      { wrapper, initialProps: { jobId: 'stuck-job-1' } },
    );

    // First job trips the cap.
    await waitFor(() => expect(result.current.isCapExceeded).toBe(true), { timeout: 5000 });

    // Retry: the same hook instance now polls a BRAND NEW job that settles to done on its first
    // poll (so it never reaches the tiny 50ms cap on its own).
    server.use(makePollSequence([{ status: 'done' }]));
    rerender({ jobId: 'fresh-retry-job-2' });

    // CR-01 core proof: the instant the hook is re-armed with the new job_id, the stale trip is
    // NOT inherited — isCapExceeded is false (the spinner returns, not the timeout card). On the
    // old boolean-latch code this was true because capTripped was never reset.
    expect(result.current.isCapExceeded).toBe(false);

    // And the fresh job polls through to a real terminal state, never re-tripping the cap.
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
