// The submit hook (C-01 / PACK-01): the submit-then-poll engine's MUTATION half. A thin
// `useMutation` over the Wave-1 `submitPackJob` that POSTs the pack request and resolves the
// 202 `{ job_id, status, links }`. The Wave-3 LoadingPage chains the returned `job_id` into
// `usePollJob`. Kept deliberately thin: it surfaces the thrown error AS-IS (a PackError /
// raw throw) so the page can `classifyFetchError` it into the SC-4 transport buckets (T-5-06)
// — this hook never swallows or rewrites the error.
//
// The mutation forwards an AbortSignal to `submitPackJob` (SC-3) so a cancel/unmount aborts
// the in-flight POST rather than leaking it.
//
// Code-split gate (C-05): imports ONLY react-query and the three-free Wave-1 fetch client —
// no three/r3f/drei, no viewer module. Stays outside the lazy /result chunk.
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { submitPackJob } from '@/api/client';
import type { PackRequest } from '@/types/pack-contract';

/** The accepted 202 body resolved by a successful submit (job_id + queued status + links map). */
export type SubmitJobData = Awaited<ReturnType<typeof submitPackJob>>;

/** The mutation variables: the pack request plus the react-query-provided AbortSignal. */
export interface SubmitJobVariables {
  request: PackRequest;
  signal: AbortSignal;
}

/**
 * Wrap `submitPackJob` in a `useMutation`. `mutate({ request, signal })` POSTs the request,
 * forwarding the AbortSignal to the fetch client (SC-3); on success the result is the parsed
 * 202 `{ job_id, ... }`. The error is surfaced unmodified for the page to classify (T-5-06).
 */
export function useSubmitJob(): UseMutationResult<SubmitJobData, unknown, SubmitJobVariables> {
  return useMutation({
    mutationFn: ({ request, signal }: SubmitJobVariables) => submitPackJob(request, signal),
  });
}
