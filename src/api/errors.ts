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
  /**
   * The HTTP status that produced this error, when one was read (WR-02). Present on a non-2xx
   * response throw; absent for an opaque-CORS/network throw (where no status is readable). Lets a
   * consumer distinguish a 4xx (the server DID reach us and rejected the request — a re-POST of
   * the identical body will be re-rejected, so blind Retry has no value) from a 5xx/network blip.
   */
  readonly status?: number;
  /**
   * The (untrusted) response-body text the server attached to a non-2xx, when readable (WR-02).
   * Carried so a future failed-style card can surface the server's explanation instead of a
   * generic "couldn't reach" line. Rendered, if ever shown, as escaped React text.
   */
  readonly detail?: string;

  constructor(
    kind: PackErrorKind,
    message?: string,
    options?: { status?: number; detail?: string },
  ) {
    super(message ?? kind);
    this.name = 'PackError';
    this.kind = kind;
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

/** True for a 4xx status: the server reached us and rejected the request (no blind-Retry value). */
export function isClientRejection(e: unknown): boolean {
  return (
    e instanceof PackError && typeof e.status === 'number' && e.status >= 400 && e.status < 500
  );
}

/**
 * Map any thrown value into a transport bucket. Order matters: a PackError already knows
 * its kind; an AbortError is a no-op; a ZodError is contract-drift; everything else (a raw
 * fetch TypeError from opaque-CORS/failed-to-fetch, or any unknown throw) falls back to the
 * safe 'unreachable' default — we never read a status off such a throw (Pitfall 2). The
 * `instanceof TypeError` branch is folded into that default since it returns the same bucket.
 */
export function classifyFetchError(e: unknown): PackErrorKind {
  if (e instanceof PackError) return e.kind;
  if (e instanceof DOMException && e.name === 'AbortError') return 'aborted';
  if (e instanceof ZodError) return 'contract-drift';
  return 'unreachable';
}
