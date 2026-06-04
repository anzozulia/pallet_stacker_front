// The /loading route (D-01/D-03/D-07/D-08): the three-free, EAGER `/loading` chunk (C-06). This
// page is the full submit→poll lifecycle: it reads the `{ request, idToType }` handed over via
// react-router navigation state, fires `useSubmitJob` on mount, chains the returned `job_id` into
// `usePollJob`, renders the comet spinner + a tally-derived job-summary card with an HONEST status
// sub-line (NO fake %, NO cycling mockup flavor text), and on `done` navigates to /result with
// `replace` so Back skips the spinner.
//
// Terminal-state distinction (D-07 / PACK-06): the four non-queued/running outcomes are each handled
// without crashing —
//   - done   (incl. `unpacked_items > 0`, which is SUCCESS) → navigate('/result', { replace }).
//   - failed (server terminal)                              → ErrorCard kind 'failed' (server message).
//   - timeout (server terminal) OR the client safety cap    → ErrorCard kind 'timeout'.
//   - a thrown POST/poll (network/opaque-CORS)              → classifyFetchError → ErrorCard 'unreachable'
//                                                             (an 'aborted' throw is a no-op, Pitfall 3).
//
// Cancel/Back/unmount (D-04/D-08/SC-3 / PACK-05): Cancel aborts the in-flight POST (the per-attempt
// AbortController) AND stops the poll (the query is disabled by dropping the jobId) then navigate('/');
// leaving via browser-Back or a route change unmounts the page so react-query auto-cancels the poll —
// no leaked interval/request. No confirmation dialog (D-08). Retry re-fires the SAME already-built
// request from nav state (no bounce through the form), resetting the lifecycle.
//
// Code-split gate (C-06 / threat T-5-13): imports ONLY React, react-router, the three-free Wave-2
// hooks, the Wave-1 error classifier, the pure `tallyCatalog`, and the three-free local `ErrorCard` —
// NEVER three/r3f/drei, NEVER @/components/viewer, NEVER @/routes/ResultPage. The Wave-4
// `scripts/check-code-split.mjs` gate enforces the machine half.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSubmitJob } from '@/api/useSubmitJob';
import { usePollJob } from '@/api/usePollJob';
import { classifyFetchError } from '@/api/errors';
import { tallyCatalog } from '@/lib/config-tally';
import ErrorCard, { type ErrorCardKind } from '@/features/loading/ErrorCard';
import type { PackRequest } from '@/types/pack-contract';

/** The navigation payload ConfigForm hands over (C-05): the built request + the id→type recovery map. */
interface LoadingNavState {
  request: PackRequest;
  idToType: Map<string, string>;
}

/** The structured error body the API returns on a `failed`/`timeout` job (zod-parsed, Wave 1). */
interface JobErrorBody {
  code?: string;
  message?: string | null;
  problems?: string[] | null;
}

/**
 * Honest status → sub-line map (D-01): the real, validated poll `status` union (zod, Wave 1) drives
 * fixed strings — NO fake %, NO cycling mockup flavor-text array. While the submit is still in flight
 * (no job_id yet) we show a neutral "Submitting…"; `done` is handled by navigation, not text.
 */
const STATUS_SUBLINE: Record<string, string> = {
  queued: 'Queued',
  running: 'Packing…',
};

/**
 * Validate the navigation payload BEFORE any consumer reads it (WR-04 / threat T-5-07). The
 * page later does `request.boxes.map(...)`, destructures `request.pallet`, and calls
 * `idToType.values()`, so a crafted/malformed `history.state` (e.g. `request: {}`, or `idToType`
 * present-but-not-a-Map) would otherwise render-crash. Checking the concrete shapes here lets the
 * caller redirect home on failure — the same graceful degrade as the no-state deep-link guard.
 */
function isLoadingNavState(state: unknown): state is LoadingNavState {
  if (typeof state !== 'object' || state === null) return false;
  const { request, idToType } = state as { request?: unknown; idToType?: unknown };
  if (typeof request !== 'object' || request === null) return false;
  const { boxes, pallet } = request as { boxes?: unknown; pallet?: unknown };
  if (!Array.isArray(boxes)) return false;
  if (typeof pallet !== 'object' || pallet === null) return false;
  if (!(idToType instanceof Map)) return false;
  return true;
}

export default function LoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state;

  const valid = isLoadingNavState(navState);
  const request = valid ? navState.request : undefined;
  const idToType = valid ? navState.idToType : undefined;

  const submit = useSubmitJob();

  // The AbortController for the CURRENT submit attempt. Held in a ref so Cancel can abort the
  // in-flight POST imperatively (SC-3); re-created on each (re)fire so a Retry gets a fresh signal.
  const controllerRef = useRef<AbortController | null>(null);
  // Fire the POST once on mount (guarded against StrictMode dev double-invoke); Retry re-arms it.
  const firedRef = useRef(false);
  // Cancelled: drop the jobId so the poll query disables (no leaked interval), and suppress any
  // in-flight error from flashing an error card while we navigate home.
  const [cancelled, setCancelled] = useState(false);

  // The single submit-firing primitive, reused by mount and Retry: abort any prior attempt, mint a
  // fresh AbortController, and POST the SAME already-built request from nav state (D-07).
  const fireSubmit = useCallback(() => {
    if (!request) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    submit.mutate({ request, signal: controller.signal });
    // submit.mutate is stable; request is captured once from nav state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (!valid || firedRef.current || !request) return;
    firedRef.current = true;
    fireSubmit();
    // Abort the in-flight POST when the page unmounts (browser-Back / route change) — SC-3.
    return () => controllerRef.current?.abort();
    // Run once on mount; `valid`/`request` are captured from the initial nav state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  const jobId = submit.data?.job_id;
  // Stop polling the instant we are cancelled (drop the jobId → the query disables, react-query
  // clears its interval) — no zombie poll after Cancel (PACK-05 / T-5-12).
  const poll = usePollJob(cancelled ? undefined : jobId);
  const status = poll.data?.status;

  // Defensive no-nav-state guard (threat T-5-07): a direct deep-link to /loading carries no state →
  // nothing to submit. Degrade to a redirect home rather than crashing on `undefined`.
  useEffect(() => {
    if (!valid) navigate('/', { replace: true });
  }, [valid, navigate]);

  // Reaching `done` — INCLUDING when `unpacked_items.length > 0` (that is SUCCESS, never an error,
  // Anti-Pattern) — hands off to /result with `replace` so Back skips the spinner (D-03/D-05). The
  // done payload remains in the react-query cache (gcTime:Infinity, Wave 2) for /result to read.
  useEffect(() => {
    if (!cancelled && status === 'done') navigate('/result', { replace: true });
  }, [cancelled, status, navigate]);

  // Classify any transport throw (POST or poll) into a bucket WITHOUT reading a status (Pattern 3).
  // An 'aborted' throw is a user-leaving no-op (no error card, Pitfall 3); 'unreachable'/'contract-
  // drift' surface the unreachable card.
  const transportError = submit.error ?? poll.error;
  const transportKind = transportError ? classifyFetchError(transportError) : undefined;

  // Derive the single terminal error-card kind to show, or undefined (still in flight / success /
  // cancelled / aborted). Order: a thrown transport beats a job-state read only when it is a real
  // (non-aborted) failure.
  const errorKind: ErrorCardKind | undefined = (() => {
    if (cancelled) return undefined;
    if (transportKind === 'unreachable' || transportKind === 'contract-drift') return 'unreachable';
    if (status === 'failed') return 'failed';
    if (status === 'timeout' || poll.isCapExceeded) return 'timeout';
    return undefined;
  })();

  // Cancel (D-08): abort the in-flight POST, stop the poll (via `cancelled`), and return home. No
  // confirmation. The form was never destructively unmounted so the draft persists (D-08) — Back
  // re-seeds Configure from it.
  const handleCancel = useCallback(() => {
    controllerRef.current?.abort();
    setCancelled(true);
    navigate('/');
  }, [navigate]);

  // Retry (D-07): re-fire the SAME built request from nav state, resetting the mutation + poll, and
  // clear any prior error so the spinner returns.
  const handleRetry = useCallback(() => {
    setCancelled(false);
    submit.reset();
    fireSubmit();
    // submit.reset is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireSubmit]);

  // Back (D-07): return to Configure with the draft intact. Same target as Cancel but semantically
  // the error-card "go back" action.
  const handleBack = useCallback(() => navigate('/'), [navigate]);

  // Job-summary card from the EXISTING tally (D-01) — do NOT recompute the unit/weight logic. The
  // request's boxes are already quantity-expanded (one entry per unit), so each maps to a
  // `{ quantity: 1, weight }` row; `tallyCatalog` then sums units + est. kg exactly as the footer
  // does. Distinct box TYPES are recovered from the idToType map (its value set), not the row count.
  const summary = useMemo(() => {
    if (!request) return null;
    const rows = request.boxes.map((b) => ({ quantity: 1, weight: b.weight }));
    const { units, estKg } = tallyCatalog(rows);
    const types = idToType ? new Set(idToType.values()).size : 0;
    const { length: L, width: W, height: H } = request.pallet;
    return { types, units, estKg, L, W, H };
  }, [request, idToType]);

  if (!valid || !summary) return null;

  // An error terminal: render the distinct card instead of the spinner. The `failed` body carries the
  // server's (untrusted, zod-parsed) message/problems; ErrorCard renders them as escaped text (T-5-10).
  if (errorKind) {
    const body = poll.data?.error as JobErrorBody | undefined;
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg font-sans text-text">
        <Topbar />
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-8">
          <ErrorCard
            kind={errorKind}
            message={errorKind === 'failed' ? body?.message : undefined}
            problems={errorKind === 'failed' ? body?.problems : undefined}
            onRetry={handleRetry}
            onBack={handleBack}
          />
        </main>
      </div>
    );
  }

  const subline = status ? (STATUS_SUBLINE[status] ?? 'Packing…') : 'Submitting…';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg font-sans text-text">
      <Topbar />

      <main className="flex flex-1 flex-col items-center justify-center gap-0 px-6 pb-24 pt-8">
        <div className="flex flex-col items-center">
          {/* Comet spinner — conic-gradient + radial mask ported from design/loading.html, driven by
              the --color-accent @theme token (NOT inline hex). Honors prefers-reduced-motion: the
              `motion-reduce:*` utilities drop the spin animation to a static ring. */}
          <span
            aria-hidden="true"
            className="h-10 w-10 animate-spin rounded-full motion-reduce:animate-none"
            style={{
              background:
                'conic-gradient(from 0deg, color-mix(in srgb, var(--color-accent) 0%, transparent) 8%, color-mix(in srgb, var(--color-accent) 18%, transparent) 30%, var(--color-accent) 100%)',
              WebkitMask:
                'radial-gradient(farthest-side, #0000 calc(100% - 3.5px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(farthest-side, #0000 calc(100% - 3.5px), #000 calc(100% - 3px))',
            }}
          />

          <div className="mt-6 text-[15px] font-medium tracking-[-0.01em] text-text">
            Packing your pallets…
          </div>

          {/* HONEST status sub-line — driven by the real poll status, never fake flavor text or %. */}
          <div role="status" aria-live="polite" className="mt-[7px] font-mono text-xs text-text-3">
            {subline}
          </div>

          <dl className="mt-7 flex items-stretch overflow-hidden rounded-[11px] border border-border bg-surface shadow-[var(--shadow)] max-[460px]:flex-col">
            <div className="flex flex-col gap-[3px] border-r border-border px-[18px] py-[11px] max-[460px]:items-center max-[460px]:border-b max-[460px]:border-r-0 max-[460px]:text-center">
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-3">
                Pallet
              </dt>
              <dd className="text-[13px] font-medium tabular-nums whitespace-nowrap text-text">
                {summary.L} × {summary.W} × {summary.H} mm
              </dd>
            </div>
            <div className="flex flex-col gap-[3px] border-r border-border px-[18px] py-[11px] max-[460px]:items-center max-[460px]:border-b max-[460px]:border-r-0 max-[460px]:text-center">
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-3">
                Boxes
              </dt>
              <dd className="text-[13px] font-medium tabular-nums whitespace-nowrap text-text">
                {summary.types} types · {summary.units} units
              </dd>
            </div>
            <div className="flex flex-col gap-[3px] px-[18px] py-[11px] max-[460px]:items-center max-[460px]:text-center">
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-3">
                Est. weight
              </dt>
              <dd className="text-[13px] font-medium tabular-nums whitespace-nowrap text-text">
                {summary.estKg} kg
              </dd>
            </div>
          </dl>

          {/* Cancel (D-08): aborts the in-flight POST + stops the poll, then returns home. The draft
              persists (D-08) so returning re-seeds the form. No confirmation dialog. */}
          <button
            type="button"
            onClick={handleCancel}
            className="mt-[30px] inline-flex cursor-pointer items-center gap-[7px] rounded-[6px] px-[10px] py-[6px] text-[12.5px] font-medium text-text-3 transition-colors duration-150 hover:text-text"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}

/** The shared brand topbar (spinner + error views render the same chrome). */
function Topbar() {
  return (
    <header className="flex h-[var(--topbar-height)] flex-none items-center px-6">
      <div className="flex items-center gap-2 font-semibold tracking-[-0.02em] text-text">
        <span
          aria-hidden="true"
          className="relative h-[22px] w-[22px] flex-none rounded-[6px] bg-[linear-gradient(150deg,#6d63f5,#4f46e5)] after:absolute after:inset-[5px] after:rounded-[2px] after:border-[1.5px] after:border-white/90 after:content-['']"
        />
        Palletize
        <small className="ml-0.5 font-mono text-[10px] font-normal uppercase text-text-3">
          pack&nbsp;studio
        </small>
      </div>
    </header>
  );
}
