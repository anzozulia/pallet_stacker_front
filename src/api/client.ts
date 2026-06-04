// The thin fetch client (D-11 / C-04): the ONLY place the app talks to the packing API.
// Two calls — `submitPackJob` (POST /pack) and `fetchJobState` (GET /jobs/{id}) — both
// AbortSignal-aware (Pattern 2 / SC-3) and both validating the response at the zod
// boundary (C-02). It does NOT catch: throws propagate so the hooks/UI can classify them
// via classifyFetchError (Pattern 3). Imports nothing runtime beyond zod-schemas/errors
// and fetch — no three/React, stays outside the lazy /result chunk.
//
// Base-URL resolution (D-16, the two-seam model): in DEV the base is '' so requests hit
// the relative `/api/...` path that the Vite dev proxy forwards CORS-free; in a PROD build
// the base is the build-time-baked VITE_API_URL ORIGIN (Open Question 1 — the env var is
// the origin only; THIS client owns the `/api/v1` path prefix).
import { jobAcceptedSchema, jobStateSchema, type JobState } from '@/api/pack-schema';
import { PackError } from '@/api/errors';
import type { PackRequest } from '@/types/pack-contract';

/**
 * The resolved API origin. Empty in dev (relative path → Vite proxy, no CORS); the baked
 * VITE_API_URL origin in a production build. Resolved ONCE at module load.
 */
export const API_BASE: string = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;

/** POST endpoint path — this client owns the `/api/v1` prefix (the env var is origin-only). */
export const PACK_PATH = '/api/v1/pack';

/** Build the GET poll path for a given job id. */
export function jobPath(jobId: string): string {
  return `/api/v1/jobs/${jobId}`;
}

/**
 * Submit a pack job: POST the request JSON, forwarding the AbortSignal. Throws
 * PackError('unreachable') on a non-2xx (never reads a status off a thrown fetch — that
 * is classifyFetchError's job). Validates the 202 body at the zod boundary.
 */
export async function submitPackJob(request: PackRequest, signal: AbortSignal) {
  const res = await fetch(`${API_BASE}${PACK_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok) {
    throw new PackError('unreachable', `HTTP ${res.status}`);
  }
  return jobAcceptedSchema.parse(await res.json());
}

/**
 * Poll one job state: GET /jobs/{id}, forwarding the AbortSignal. Throws PackError on a
 * non-2xx; otherwise validates the envelope at the zod boundary (C-02) so a malformed/
 * changed body becomes a handled ZodError → contract-drift, never a render crash.
 */
export async function fetchJobState(jobId: string, signal: AbortSignal): Promise<JobState> {
  const res = await fetch(`${API_BASE}${jobPath(jobId)}`, { signal });
  if (!res.ok) {
    throw new PackError('unreachable', `HTTP ${res.status}`);
  }
  return jobStateSchema.parse(await res.json());
}
