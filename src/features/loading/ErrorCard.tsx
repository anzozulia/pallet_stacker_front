// The distinct terminal-state error card (D-07 / PACK-06): a single presentational card that
// renders ONE of the three non-success terminal outcomes of the submit→poll lifecycle —
//   - 'failed'      — the solver/job reported a failure; show the server's error message/problems.
//   - 'timeout'     — the solver ran out of time (server `timeout` terminal OR the client safety cap).
//   - 'unreachable' — the POST/poll threw (network down / opaque CORS); we couldn't reach the API.
// plus the Retry (re-POST the SAME already-built request, D-07) and Back (return to / draft-intact)
// actions. The `done`-with-unpacked outcome is NOT an error and never reaches this card (it routes
// to /result as SUCCESS — see LoadingPage).
//
// Security (threat T-5-10 / ASVS V5): the server-supplied `message` / `problems` strings are
// UNTRUSTED. They are rendered as React TEXT children (auto-escaped) — NEVER via
// `dangerouslySetInnerHTML`. The error body was also zod-parsed at the Wave-1 boundary before
// reaching here, so it is shape-validated as well as escaped.
//
// Code-split gate (C-06 / threat T-5-13): imports ONLY React types — never three/r3f/drei or any
// viewer module — so `src/features/loading/*` stays out of the lazy /result chunk. Colours come from
// the `--color-danger` @theme token (no inline hex).

/** The three non-success terminal kinds this card renders. */
export type ErrorCardKind = 'failed' | 'timeout' | 'unreachable';

interface ErrorCardProps {
  kind: ErrorCardKind;
  /** The server-supplied error message (present on a `failed`/`timeout` job body). Untrusted text. */
  message?: string | null;
  /** Optional server-supplied problem detail lines (untrusted text, rendered as a list). */
  problems?: string[] | null;
  /** Re-fire the SAME already-built request (D-07). */
  onRetry: () => void;
  /** Return to Configure with the draft intact (D-07). */
  onBack: () => void;
}

/** kind → fixed, honest title + body. The `failed` body falls back to a generic line when the
 *  server sent no message; `timeout`/`unreachable` have fixed, kind-specific copy. */
const COPY: Record<ErrorCardKind, { title: string; body: string }> = {
  failed: {
    title: 'Packing failed',
    body: 'The solver could not complete this job.',
  },
  timeout: {
    title: 'The solver ran out of time',
    body: 'The job exceeded the time budget before a layout was found. Try fewer boxes or a larger pallet.',
  },
  unreachable: {
    title: "Couldn't reach the packing service",
    body: 'The packing service did not respond. Check the connection and try again.',
  },
};

export default function ErrorCard({ kind, message, problems, onRetry, onBack }: ErrorCardProps) {
  const { title, body } = COPY[kind];
  // For 'failed' prefer the server's message (untrusted TEXT); fall back to the generic body.
  const detail = kind === 'failed' && message ? message : body;

  return (
    <div
      role="alert"
      className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[11px] border border-border bg-surface px-7 py-8 text-center shadow-[var(--shadow)]"
    >
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-full text-[20px] font-semibold text-danger"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        }}
      >
        !
      </span>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-danger">{title}</h2>
        {/* Untrusted server text rendered as an auto-escaped React child (T-5-10). */}
        <p className="text-[13px] leading-relaxed text-text-2">{detail}</p>
      </div>

      {problems && problems.length > 0 ? (
        <ul className="flex w-full list-disc flex-col gap-1 pl-5 text-left text-xs text-text-3">
          {problems.map((p, i) => (
            // Untrusted server text rendered as an auto-escaped React child (T-5-10).
            <li key={i}>{p}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-transparent bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-accent-text"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-[13px] font-medium text-text-2 transition-colors duration-150 hover:text-text"
        >
          Back to configure
        </button>
      </div>
    </div>
  );
}
