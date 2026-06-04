// MSW 2 request handlers — the deterministic test transport for the async submit-then-poll
// flow (Wave-0 infra / Pitfall 6). `http`/`HttpResponse` are the MSW 2 API (NOT the v1
// `rest`). Two endpoints:
//  - POST */api/v1/pack → 202 { job_id, status:'queued', links:{ self } }
//  - GET  */api/v1/jobs/:id → driven by `makePollSequence`, returning successive states
//    across calls so a test can script queued→running→done (or →failed / →timeout / throw).
// Wildcard-prefixed paths (`*/api/v1/...`) match regardless of API_BASE (dev '' vs a baked
// absolute origin), so the same handlers intercept both base resolutions.
import { http, HttpResponse } from 'msw';
import packDoneResponse from '@/lib/__fixtures__/pack-done-response.json';

/** A scripted poll state: the JSON body returned on the Nth GET /jobs/{id} call. */
export interface PollState {
  status: 'queued' | 'running' | 'done' | 'failed' | 'timeout';
  result?: unknown;
  error?: { code: string; message?: string };
}

/**
 * Build a GET /jobs/:id handler that walks the supplied state list across successive
 * calls, sticking on the LAST entry once exhausted (a poll naturally settles on a terminal
 * state). The `done` shorthand returns the real pack-done-response corpus. Pass
 * `'throw'` as a state to simulate a network failure (opaque CORS / unreachable).
 */
export function makePollSequence(states: Array<PollState | 'throw'>) {
  let call = 0;
  return http.get('*/api/v1/jobs/:id', ({ params }) => {
    const state = states[Math.min(call, states.length - 1)];
    call += 1;
    if (state === 'throw') {
      return HttpResponse.error();
    }
    const body: Record<string, unknown> = {
      job_id: String(params.id),
      status: state.status,
    };
    if (state.status === 'done') {
      body.result = state.result ?? packDoneResponse.result;
    }
    if (state.error) {
      body.error = state.error;
    }
    return HttpResponse.json(body, { status: 200 });
  });
}

/**
 * The default happy-path handler set: a POST that accepts a job, plus a GET poll sequence
 * that goes queued → running → done. Individual tests override via `server.use(...)`.
 */
export const handlers = [
  http.post('*/api/v1/pack', () =>
    HttpResponse.json(
      { job_id: 'test-job-1', status: 'queued', links: { self: '/api/v1/jobs/test-job-1' } },
      { status: 202 },
    ),
  ),
  makePollSequence([{ status: 'queued' }, { status: 'running' }, { status: 'done' }]),
];
