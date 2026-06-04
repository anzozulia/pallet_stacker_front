// The poll hook (C-01 / PACK-04): the submit-then-poll engine's QUERY half. A `useQuery`
// over the Wave-1 `fetchJobState` whose `refetchInterval` returns `false` the instant the
// job status is terminal — react-query owns the poll loop, the interval timer, cancellation,
// and the in-flight AbortSignal (no hand-rolled `setInterval`, C-01; threat T-5-04). Layered
// on top is a client wall-clock SAFETY CAP (PACK-05 / T-5-05): a server that never returns a
// terminal status is bounded so the UI surfaces an error rather than spinning forever.
//
// The `done` payload is kept cached with `gcTime: Infinity` (Pitfall 4 / D-05) so the Wave-3
// /result hand-off can read the settled job off the react-query cache.
//
// Code-split gate (C-05): imports ONLY react-query, React, and the three-free Wave-1 fetch
// client — never three/r3f/drei or any viewer module. Stays outside the lazy /result chunk.
import { useEffect, useRef, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchJobState } from '@/api/client';
import type { JobState } from '@/api/pack-schema';

/**
 * Poll cadence (D-09): one `GET /jobs/{id}` per ~1s while the job is non-terminal. Single
 * tunable named constant, mirroring the named-constant convention in src/lib/config-tally.ts.
 */
export const POLL_INTERVAL_MS = 1000;

/**
 * Client wall-clock safety cap (Pitfall 1 / PACK-05 / T-5-05). Set in the ~120-140s window,
 * ABOVE the server's ~120s hard kill, so the server's own `timeout` terminal almost always
 * wins first; this cap is only a backstop for a server that never returns a terminal status.
 * A tunable named constant — adjust against observed latency. Tests inject a tiny cap via the
 * `usePollJob` options arg for fast, deterministic assertions.
 */
export const POLL_SAFETY_CAP_MS = 120000;

/** The closed terminal-status set: a job in one of these states has settled, so polling stops. */
const TERMINAL = new Set(['done', 'failed', 'timeout']);

/** True for done/failed/timeout; false for queued/running/undefined. The poll's stop predicate. */
export function isTerminal(status?: string): boolean {
  return !!status && TERMINAL.has(status);
}

/** Tunables for `usePollJob` — chiefly an injectable safety cap so tests run fast. */
export interface UsePollJobOptions {
  /** Override the wall-clock safety cap (ms). Defaults to `POLL_SAFETY_CAP_MS`. */
  safetyCapMs?: number;
}

/**
 * The poll result: the underlying react-query result (a discriminated union, so this is an
 * INTERSECTION not an interface-extends — UseQueryResult cannot be `extends`-ed) plus the
 * derived cap-exceeded flag.
 *
 * `isCapExceeded` is true once the wall-clock cap elapses while the job is STILL non-terminal —
 * the UI treats this as the timeout/unreachable bucket (do NOT auto-retry). It is false once a
 * terminal status arrives first (the normal path), AND false for any job whose id differs from
 * the one that tripped the cap (so a Retry's fresh job_id never inherits a stale trip — CR-01).
 */
export type UsePollJobResult = UseQueryResult<JobState> & {
  isCapExceeded: boolean;
};

/**
 * Poll one job to a terminal status. While `jobId` is truthy the query fetches every
 * `POLL_INTERVAL_MS`; `refetchInterval` returns `false` the instant `query.state.data.status`
 * is terminal, so react-query clears its own interval and the poll self-stops (T-5-04). On
 * disable/unmount react-query aborts the in-flight `queryFn` via its AbortSignal (SC-3) — no
 * leaked interval. The `done` entry survives in cache (`gcTime: Infinity`) for the /result
 * hand-off (D-05). A job that never settles trips `isCapExceeded` at the wall-clock cap (T-5-05).
 *
 * The safety cap latches the IDENTITY of the job that tripped it (`trippedJobId`), not a bare
 * boolean. This kills two bugs at once:
 *  - CR-01 (Retry broken): after Retry, `jobId` is a NEW job_id, so `capExceeded` (which requires
 *    `trippedJobId === jobId`) is false — the spinner returns, not a spurious timeout card. No
 *    synchronous setState-in-effect is needed to clear the latch, so the
 *    `react-hooks/set-state-in-effect` lint rule stays satisfied.
 *  - CR-02 (unbounded network loop): the same `capExceeded` predicate gates BOTH `enabled` and
 *    `refetchInterval`, so once the cap fires react-query disables the query — it aborts the
 *    in-flight GET and stops the interval (covers the backgrounded-tab case too, WR-06).
 */
export function usePollJob(
  jobId: string | undefined,
  options?: UsePollJobOptions,
): UsePollJobResult {
  const safetyCapMs = options?.safetyCapMs ?? POLL_SAFETY_CAP_MS;

  // The safety cap, layered ON TOP without a hand-rolled poll: record the wall-clock start the
  // moment `jobId` first becomes truthy, then arm a SINGLE timer that latches the id of the job
  // that tripped. We only ever `setState` from the timer callback (never synchronously in the
  // effect body — react-hooks/set-state-in-effect): the reset case (no job / settled / a new
  // job_id) is expressed by clearing the start ref and deriving `capExceeded` against the CURRENT
  // jobId, so a stale trip can never leak into a fresh Retry job (CR-01).
  const startRef = useRef<number | null>(null);
  // The job id the wall-clock start in `startRef` belongs to. When `jobId` changes (a Retry mints
  // a new job_id), the clock must re-arm from zero rather than carry the prior job's elapsed time —
  // otherwise a fresh job would inherit a long-elapsed start and trip the cap immediately (CR-01).
  const armedJobIdRef = useRef<string | undefined>(undefined);
  const [trippedJobId, setTrippedJobId] = useState<string | null>(null);

  // The cap counts as exceeded only when the trip is keyed to the CURRENTLY-polled job (CR-01),
  // and that job is truthy. Derived BEFORE the query so it can gate `enabled`/`refetchInterval`
  // and actually stop the poll loop (CR-02 / WR-06) — not just paint a UI overlay.
  const capExceeded = !!jobId && trippedJobId === jobId;

  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: ({ signal }) => fetchJobState(jobId!, signal),
    // Gate on `!capExceeded` so a tripped cap DISABLES the query — react-query aborts the
    // in-flight GET and stops the interval (CR-02), including a backgrounded tab (WR-06).
    enabled: !!jobId && !capExceeded,
    // v5 single-arg signature: return false on terminal status OR a tripped cap to STOP the
    // poll (C-01 / CR-02).
    refetchInterval: (q) =>
      isTerminal(q.state.data?.status) || capExceeded ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    gcTime: Infinity,
    staleTime: 0,
    retry: false,
  });

  const terminal = isTerminal(query.data?.status);

  useEffect(() => {
    // No active job, or it already settled → there is no cap to enforce. Clear the start ref so
    // a fresh job re-arms from a fresh wall-clock zero. `capExceeded` is derived false above.
    if (!jobId || terminal) {
      startRef.current = null;
      armedJobIdRef.current = jobId;
      return;
    }
    // Re-arm the wall-clock from zero on a fresh job (first arm OR a new job_id from Retry) so a
    // new job never inherits the prior job's elapsed time and trips the cap on arrival (CR-01).
    if (startRef.current === null || armedJobIdRef.current !== jobId) {
      startRef.current = Date.now();
      armedJobIdRef.current = jobId;
    }
    const remaining = safetyCapMs - (Date.now() - startRef.current);
    // Latch THIS job's id when the cap elapses. A later Retry polls a different id, so
    // `capExceeded` (trippedJobId === jobId) is false for it — no stale trip leaks (CR-01).
    const timer = setTimeout(() => setTrippedJobId(jobId), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [jobId, terminal, safetyCapMs, query.dataUpdatedAt]);

  return { ...query, isCapExceeded: capExceeded };
}
