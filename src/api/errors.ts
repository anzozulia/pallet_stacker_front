// The transport-failure taxonomy (D-07): a single `PackError` class plus the
// `classifyFetchError` bucketer that maps any thrown value from the fetch client into one
// of the SC-4 transport buckets the UI reacts to. This covers TRANSPORT failures only —
// a `failed`/`timeout` JOB is a successfully-parsed JobState (read off the poll boundary),
// NOT a PackError.
//
// The buckets and why they matter:
//  - 'unreachable'    — network down / DNS / opaque CORS. A cross-origin fetch that the
//                       browser blocks throws a bare `TypeError` with NO readable status
//                       (threat T-5-02); we MUST bucket it without ever reading res.status.
//  - 'aborted'        — an in-flight fetch cancelled via AbortSignal (unmount / new submit).
//                       Surfaces as a UI no-op, not an error (threat T-5-03 / Pitfall 3).
//  - 'contract-drift' — the response parsed to a ZodError at the zod boundary (T-5-01):
//                       the API shape changed / a malformed body. A handled error, not a crash.
//
// Imports nothing at runtime beyond zod (for the ZodError instanceof check); no three/IO.
import { ZodError } from 'zod';

/** The closed set of transport-failure buckets the UI reacts to (SC-4 transport half). */
export type PackErrorKind = 'unreachable' | 'contract-drift' | 'aborted';

/**
 * A transport-layer failure carrying its bucket. Thrown by the fetch client on a non-2xx
 * response (`new PackError('unreachable', 'HTTP ' + res.status)`); other throws (raw
 * fetch TypeErrors, AbortErrors, ZodErrors) are bucketed by `classifyFetchError` instead.
 */
export class PackError extends Error {
  readonly kind: PackErrorKind;

  constructor(kind: PackErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'PackError';
    this.kind = kind;
  }
}

/**
 * Map any thrown value into a transport bucket. Order matters: a PackError already knows
 * its kind; an AbortError is a no-op; a ZodError is contract-drift; ANY other TypeError is
 * opaque-CORS/unreachable (never read a status off it — Pitfall 2); everything else falls
 * back to the safe 'unreachable' default.
 */
export function classifyFetchError(e: unknown): PackErrorKind {
  if (e instanceof PackError) return e.kind;
  if (e instanceof DOMException && e.name === 'AbortError') return 'aborted';
  if (e instanceof ZodError) return 'contract-drift';
  if (e instanceof TypeError) return 'unreachable';
  return 'unreachable';
}
