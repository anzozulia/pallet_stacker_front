// The network-boundary contract (C-02): zod schemas that validate the UNTRUSTED JSON
// crossing from the packing API into the render tree. This is the trust boundary —
// `GET /jobs/{id}` and `POST /pack` bodies are parsed here so a malformed/changed
// response surfaces as a handled ZodError (→ contract-drift, see errors.ts), never an
// `as`-cast that crashes a render (threat T-5-01 / ASVS V5).
//
// Design rules:
//  - TIGHTEN only `status` to the verified closed union (jobStatusSchema). Everything
//    else (result, error, meta, nested objects) stays NON-strict — we do NOT call
//    `.strict()`, so a benign forward-compat field on a future API minor-bump is
//    tolerated rather than false-positiving as contract-drift (Pitfall 5).
//  - `result` is left as `z.unknown()` here: the heavy DoneResult shape is the consumer's
//    concern (the result page parses it), the poll boundary only needs the envelope.
//
// Imports nothing at runtime beyond zod; no three/React/IO — safe to import anywhere and
// stays outside the lazy /result chunk.
import { z } from 'zod';

/**
 * The closed job-status domain (VERIFIED from the API). Tightens the `status` field that
 * src/types/pack-contract.ts types loosely as `string` — an unknown status (e.g.
 * 'processing') is rejected as contract-drift instead of slipping through as a string.
 */
export const jobStatusSchema = z.enum(['queued', 'running', 'done', 'failed', 'timeout']);

/**
 * The structured error body the API returns on a `failed`/`timeout` job. All fields past
 * `code` are nullish so a sparse error body still parses (non-strict / forward-compat).
 */
export const errorBodySchema = z.object({
  code: z.string(),
  message: z.string().nullish(),
  problems: z.array(z.string()).nullish(),
});

/**
 * The `GET /jobs/{id}` envelope — the poll boundary. NON-strict (no `.strict()`): only
 * `job_id` and `status` are required+tightened; `result` is opaque `unknown` (the result
 * page owns its shape), `error`/`meta` are nullish. Extra unknown keys are tolerated.
 */
export const jobStateSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  result: z.unknown().nullish(),
  error: errorBodySchema.nullish(),
  meta: z.record(z.string(), z.unknown()).nullish(),
});

/**
 * The `POST /pack` 202 body: a job_id, a (defaulted) queued status, and an OPTIONAL links map.
 * `links` is `.nullish()` (WR-03): the app never reads it — the poll path is built client-side
 * from `job_id` — so an accepted job whose 202 omits/renames `links` must not false-positive as
 * contract-drift. Forward-compat / non-strict, matching the rest of the boundary's design.
 */
export const jobAcceptedSchema = z.object({
  job_id: z.string(),
  status: z.literal('queued').default('queued'),
  links: z.record(z.string(), z.string()).nullish(),
});

/** The validated poll-state shape consumed by the poll hook / result page. */
export type JobState = z.infer<typeof jobStateSchema>;

/** The closed job-status union. */
export type JobStatus = z.infer<typeof jobStatusSchema>;
