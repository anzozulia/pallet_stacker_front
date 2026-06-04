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
 * Build a PackError for a non-2xx response, attaching the status and the (best-effort) response
 * body so a 4xx (server reached + rejected the request — see `isClientRejection`) is no longer
 * indistinguishable from an opaque-CORS/network blip (WR-02). The body read is best-effort: a
 * stream that fails to read just yields no detail rather than masking the real status.
 */
async function packErrorFromResponse(res: Response): Promise<PackError> {
  let detail: string | undefined;
  try {
    detail = (await res.text()) || undefined;
  } catch {
    detail = undefined;
  }
  return new PackError('unreachable', `HTTP ${res.status}`, { status: res.status, detail });
}

/**
 * The resolved API origin. Empty in dev (relative path → Vite proxy, no CORS); the baked
 * VITE_API_URL origin in a production build. Resolved ONCE at module load.
 *
 * Fail LOUD in a production build with no VITE_API_URL (WR-01): without this guard every fetch
 * URL would silently become `"undefined/api/v1/..."` (a broken request that looks like a generic
 * network error). Under dev/test `import.meta.env.DEV` is true (Vitest sets it), so the guard is
 * never tripped and the base is '' — the relative path the dev proxy / MSW intercept.
 */
const rawBase = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;
if (!import.meta.env.DEV && !rawBase) {
  throw new Error(
    'VITE_API_URL must be set at build time for production builds (docker build --build-arg VITE_API_URL=...).',
  );
}
export const API_BASE: string = rawBase ?? '';

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
    throw await packErrorFromResponse(res);
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
    throw await packErrorFromResponse(res);
  }
  return jobStateSchema.parse(await res.json());
}
