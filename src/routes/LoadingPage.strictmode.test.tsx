// Regression test for the dev-only StrictMode submit-abort hang (loading-post-strictmode-abort).
//
// In dev `main.tsx` wraps the app in <StrictMode>, which intentionally double-invokes effects on the
// SAME component instance (mount① → cleanup① → mount②) — so the component's `useRef`s PERSIST across
// the cleanup. LoadingPage's submit-on-mount effect sets a once-only `firedRef` guard, fires the
// POST (minting a per-attempt AbortController), and its cleanup aborts that controller (SC-3).
//
// The BUG: mount① fired the POST and set `firedRef = true`; cleanup① aborted that in-flight POST;
// mount② then saw `firedRef === true` and early-returned WITHOUT re-firing. The sole POST was
// aborted before it left the browser and never retried → jobId never set → poll never started → the
// page hung forever on "Submitting…" (not even the safety-cap timeout card, which only arms once a
// jobId exists). The FIX resets `firedRef` in the cleanup so mount② re-fires a fresh, un-aborted POST.
//
// Why the e2e cannot catch it: playwright.config.ts runs a PRODUCTION build (`build && preview`),
// where StrictMode does NOT double-invoke effects — the POST fires once and the happy-path passes.
// This component test is the only automated guard.
//
// Two harness details make the reproduction faithful AND reliable in jsdom:
//   1. <StrictMode> is the ROOT element handed to `render` (with the QueryClientProvider INSIDE it).
//      RTL only replays the StrictMode mount→cleanup→mount effect double-invoke when StrictMode is
//      the top-level container — nesting it under another provider silently suppresses the replay.
//   2. `useSubmitJob` is stubbed to (a) count every `mutate({ request, signal })` and (b) resolve a
//      job ONLY for a fire whose `signal` is NOT aborted by the cleanup — the browser-faithful
//      abort-before-response no-op for the attempt the StrictMode cleanup aborts.
//
// So under StrictMode:
//   - BUGGY  (cleanup does not reset firedRef): mutate fires ONCE; its signal is aborted by the
//            cleanup → it never resolves → no jobId → navigate('/result') is never called → FAILS.
//   - FIXED  (cleanup resets firedRef): mutate fires TWICE; the second fire's signal is NOT aborted
//            → it resolves → jobId set → poll → done → navigate('/result') → PASSES.
import { StrictMode, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { makePollSequence } from '@/test/msw/handlers';
import type { PackRequest } from '@/types/pack-contract';
import LoadingPage from '@/routes/LoadingPage';

// Spy useNavigate; keep the rest of react-router real (MemoryRouter + useLocation).
const navigateSpy = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateSpy };
});

// Stub useSubmitJob: count every mutate, and resolve a job ONLY for an un-aborted fire (the
// browser-faithful abort-before-response no-op for the attempt the StrictMode cleanup aborts).
const submitMutateSpy = vi.fn<(vars: { request: PackRequest; signal: AbortSignal }) => void>();
vi.mock('@/api/useSubmitJob', async () => {
  const { useState } = await vi.importActual<typeof import('react')>('react');
  return {
    useSubmitJob() {
      // Mirror the surface LoadingPage reads: { data, error, mutate, reset }.
      const [data, setData] = useState<{ job_id: string } | undefined>(undefined);
      const mutate = (vars: { request: PackRequest; signal: AbortSignal }) => {
        submitMutateSpy(vars);
        // Resolve asynchronously so the synchronous StrictMode cleanup can abort the first attempt
        // BEFORE it would have resolved — exactly the browser ordering. Only an un-aborted attempt
        // (the cleanup-enabled re-fire) sets a jobId.
        queueMicrotask(() => {
          if (!vars.signal.aborted) setData({ job_id: 'strictmode-job-1' });
        });
      };
      const reset = () => setData(undefined);
      return { data, error: null, mutate, reset, isPending: false } as unknown as ReturnType<
        typeof import('@/api/useSubmitJob').useSubmitJob
      >;
    },
  };
});

// The same minimal nav payload shape the happy-path suite uses.
function makeNavState(): {
  request: PackRequest;
  idToType: Map<string, string>;
  typeToLabel: Map<string, string>;
} {
  const request: PackRequest = {
    boxes: [
      { id: 'D-0', length: 400, width: 300, height: 200, weight: 4, rotations: 'all' },
      { id: 'D-1', length: 400, width: 300, height: 200, weight: 4, rotations: 'all' },
      { id: 'F-0', length: 500, width: 400, height: 300, weight: 9, rotations: 'all' },
    ],
    pallet: { length: 1200, width: 800, height: 1800, max_weight: 1000, max_overhang: 30 },
    options: { max_pallets: 1, time_budget_s: 25, seed: 7, support_ratio: 0.8 },
  };
  const idToType = new Map<string, string>([
    ['D-0', 'D'],
    ['D-1', 'D'],
    ['F-0', 'F'],
  ]);
  const typeToLabel = new Map<string, string>([
    ['D', 'Box type 1'],
    ['F', 'Box type 2'],
  ]);
  return { request, idToType, typeToLabel };
}

// Render with <StrictMode> as the ROOT element so RTL actually replays the effect double-invoke
// (see harness detail #1 above). The QueryClientProvider lives INSIDE StrictMode; each call gets a
// fresh client with retry off so nothing leaks between tests.
function renderStrict(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  navigateSpy.mockClear();
  submitMutateSpy.mockClear();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('LoadingPage — StrictMode dev double-invoke must not kill the submit (regression)', () => {
  function renderLoadingStrict(state = makeNavState()) {
    return renderStrict(
      <MemoryRouter initialEntries={[{ pathname: '/loading', state }]}>
        <LoadingPage />
      </MemoryRouter>,
    );
  }

  test('the StrictMode remount re-fires the submit (un-aborted) so the flow reaches /result', async () => {
    // The done poll lets the un-aborted submit drive the lifecycle through to the /result hand-off.
    server.use(makePollSequence([{ status: 'queued' }, { status: 'running' }, { status: 'done' }]));

    renderLoadingStrict();

    // The submit must fire TWICE under StrictMode: mount① + the cleanup-enabled re-fire on mount②.
    // Under the bug the guard blocks the re-fire → this stays at 1 forever.
    await waitFor(() => expect(submitMutateSpy.mock.calls.length).toBeGreaterThanOrEqual(2), {
      timeout: 5000,
    });

    // The first attempt's signal is aborted by the StrictMode cleanup; the re-fire's is not — proving
    // the cleanup both ran AND let a fresh, un-aborted submit through (the precise fix mechanism).
    const firstCall = submitMutateSpy.mock.calls[0];
    const lastCall = submitMutateSpy.mock.calls.at(-1)!;
    expect(firstCall[0].signal.aborted).toBe(true);
    expect(lastCall[0].signal.aborted).toBe(false);

    // …and the un-aborted re-fire resolves a jobId so the full lifecycle completes → /result. Under
    // the bug the lone aborted attempt never resolves a jobId, so this never fires.
    await waitFor(
      () =>
        expect(navigateSpy).toHaveBeenCalledWith(
          '/result',
          expect.objectContaining({
            replace: true,
            state: expect.objectContaining({
              jobId: expect.any(String),
              idToType: expect.any(Map),
            }),
          }),
        ),
      { timeout: 5000 },
    );

    // No error/timeout card was shown on the way — it is a clean success.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
