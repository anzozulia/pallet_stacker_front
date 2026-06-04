// The /loading route (D-01/D-03): the three-free, EAGER `/loading` chunk (C-06). This page is
// the happy-path spine of the submit→poll lifecycle: it reads the `{ request, idToType }` handed
// over via react-router navigation state, fires `useSubmitJob` on mount, chains the returned
// `job_id` into `usePollJob`, renders the comet spinner + a tally-derived job-summary card with an
// HONEST status sub-line (NO fake %, NO cycling mockup flavor text), and on `done` navigates to
// /result with `replace` so Back skips the spinner.
//
// Code-split gate (C-06): imports ONLY React, react-router, the three-free Wave-2 hooks, the pure
// `tallyCatalog`, and the `Card`-free local chrome — NEVER three/r3f/drei, NEVER @/components/viewer,
// NEVER @/routes/ResultPage. This keeps `/loading` on the eager Configure→loading chunk and out of
// the lazy /result chunk (the Wave-4 `scripts/check-code-split.mjs` gate enforces the machine half).
//
// The failed / timeout / cap-exceeded / cancel-abort distinctions are Plan 04 — this slice handles
// ONLY the happy path plus the defensive no-nav-state guard (threat T-5-07: a deep-link to /loading
// with no state has nothing to submit → redirect to '/', never crash on `undefined`).
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSubmitJob } from '@/api/useSubmitJob';
import { usePollJob } from '@/api/usePollJob';
import { tallyCatalog } from '@/lib/config-tally';
import type { PackRequest } from '@/types/pack-contract';

/** The navigation payload ConfigForm hands over (C-05): the built request + the id→type recovery map. */
interface LoadingNavState {
  request: PackRequest;
  idToType: Map<string, string>;
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

function isLoadingNavState(state: unknown): state is LoadingNavState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'request' in state &&
    typeof (state as { request: unknown }).request === 'object' &&
    (state as { request: unknown }).request !== null
  );
}

export default function LoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state;

  const submit = useSubmitJob();
  // Fire the POST exactly once on mount, forwarding the AbortSignal (SC-3). The submit hook resolves
  // the 202 { job_id }; we chain that into the poll below. Guarded by a ref so StrictMode's
  // double-invoke (dev) does not double-submit.
  const firedRef = useRef(false);
  const valid = isLoadingNavState(navState);
  const request = valid ? navState.request : undefined;
  const idToType = valid ? navState.idToType : undefined;

  useEffect(() => {
    if (!valid || firedRef.current || !request) return;
    firedRef.current = true;
    const controller = new AbortController();
    submit.mutate({ request, signal: controller.signal });
    return () => controller.abort();
    // submit.mutate is stable; request is captured once on mount. We intentionally run this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid]);

  const jobId = submit.data?.job_id;
  const poll = usePollJob(jobId);
  const status = poll.data?.status;

  // Defensive no-nav-state guard (threat T-5-07): a direct deep-link to /loading carries no state →
  // nothing to submit. Degrade to a redirect home rather than crashing on `undefined`. Done in an
  // effect (navigate-during-render is disallowed); render a neutral null in the meantime.
  useEffect(() => {
    if (!valid) navigate('/', { replace: true });
  }, [valid, navigate]);

  // Reaching `done` hands off to /result with `replace` so Back skips the spinner (D-03/D-05). The
  // done payload remains in the react-query cache (gcTime:Infinity, Wave 2) for /result to read.
  useEffect(() => {
    if (status === 'done') navigate('/result', { replace: true });
  }, [status, navigate]);

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

  const subline = status ? (STATUS_SUBLINE[status] ?? 'Packing…') : 'Submitting…';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg font-sans text-text">
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

          {/* Secondary-action slot (design/loading.html "Skip to result"). For this happy-path slice
              this is a Cancel placeholder that simply returns home; its abort+navigate behavior is
              wired in Plan 04. The draft persists (D-08) so returning re-seeds the form. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-[30px] inline-flex cursor-pointer items-center gap-[7px] rounded-[6px] px-[10px] py-[6px] text-[12.5px] font-medium text-text-3 transition-colors duration-150 hover:text-text"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
