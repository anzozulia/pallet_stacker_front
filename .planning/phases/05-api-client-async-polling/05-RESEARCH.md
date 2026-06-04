# Phase 5: API Client & Async Polling - Research

**Researched:** 2026-06-04
**Domain:** Async submit-then-poll HTTP integration (TanStack Query) + zod network-boundary validation + clean cancellation
**Confidence:** HIGH (the live API contract was fetched and exercised end-to-end this session)

## Summary

This phase wires the existing Configure form to the real packing API via the
async submit-then-poll lifecycle. The single biggest risk — "what do the
non-`done` poll responses actually look like?" — is now **resolved against the
live OpenAPI spec and a real job run this session**, not assumed. The contract
is small and clean: `POST /api/v1/pack` returns `202 { job_id, status:"queued", links.self }`;
`GET /api/v1/jobs/{job_id}` returns `200 { job_id, status, result?, error? }`
where `status ∈ {queued, running, done, failed, timeout}`, `result` is present
**iff** `done`, and `error` (a `{ code, message?, problems? }` body) is present
**iff** `failed`/`timeout`. There is **no cancel/DELETE endpoint** — cancel is
client-side-only (abort in-flight + stop polling), exactly as D-08 assumed.

Two context assumptions were **corrected by the live spec** and the planner must
act on them: (1) the server time budget is **not 25s** — `time_budget_s` is
clamped to `[1s, ~90s default ceiling]` with a hard wall-clock kill ~30s above
(~120s); the request-builder bakes `time_budget_s:25` today, which is fine
(within range), but the **client safety cap (D-09) must be ~120-140s, not the
~60-90s the context guessed**, or it will abort legitimately-running jobs.
(2) The API **does accept per-box `max_load_on_top` (0 = fragile) and the
`this_side_up` rotation** — so the D-08 deferred question resolves *in favour of*
sending them, should the team choose to (see "D-08 resolution" below).

CORS was also verified live: the API returns **no `Access-Control-Allow-Origin`**
header for a `localhost:5173` origin and answers `OPTIONS` preflight with `405`.
This makes the dev `/api` proxy mandatory and makes the "unreachable/CORS" bucket
(D-07) a real, load-bearing terminal state — a browser CORS rejection surfaces as
an opaque `TypeError: Failed to fetch` with no readable status.

**Primary recommendation:** Install `@tanstack/react-query@5.101.0` (behind a
supply-chain checkpoint) and `msw@2.14.6` (dev). Build `src/api/` as a two-layer
stack: a thin `AbortSignal`-aware `fetch` client + a zod-validated `JobState`
parser, then react-query hooks (`useMutation` for POST, `useQuery` with a
`refetchInterval` callback that returns `false` on terminal status) on top. Drive
the whole lifecycle from the new eager, three-free `/loading` route.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Submit packing job (`POST /pack`) | API/Backend (the packer service) | Browser/Client (fetch) | The solver is authoritative; the client only fires the request and reads `job_id`. |
| Poll job to terminal (`GET /jobs/{id}`) | Browser/Client | API/Backend | Polling cadence, terminal detection, and the safety cap are client concerns; the server just reports status. |
| Cancel an in-progress job | Browser/Client **only** | — | No server cancel endpoint exists (verified). Cancel = `AbortController.abort()` + stop polling. The server keeps solving; the client just stops listening. |
| Network-boundary validation (zod) | Browser/Client | — | The trust boundary is the client's fetch response; zod parses `JobState` so a contract drift is a handled error, not a render crash (C-02). |
| Result hand-off to `/result` | Browser/Client | — | In-memory only (react-query cache keyed by `job_id` + retained `idToType`); ephemeral by design (D-05). |
| Loading-screen status display | Browser/Client | — | Honest, indeterminate status text driven by the real `status` field (D-01). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `5.101.0` | Submit-then-poll engine: `useMutation` (POST) + `useQuery` `refetchInterval` (poll) | CLAUDE.md mandate ("use it — do not hand-roll"). `refetchInterval` accepting a callback that returns `false` maps exactly onto "poll until terminal". `[VERIFIED: npm registry]` version + peer `react: ^18 \|\| ^19` (satisfies React 19.2.7). |
| `zod` | `4.4.3` | Network-boundary `JobState` parse (C-02) | Already a dependency (config form). First runtime use at the network boundary; mirrors `src/types/pack-contract.ts`. `[VERIFIED: package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `msw` | `2.14.6` | Mock Service Worker — deterministic API stubbing for jsdom hook tests AND Playwright | Used by the hook/integration tests (jsdom via `setupServer` from `msw/node`) per CLAUDE.md. `[VERIFIED: npm registry]` latest, peer `typescript: ">= 4.8.x"`, engines `node: ">=18"`. **Has a `postinstall` script** (`node -e "import('./config/scripts/postinstall.js')..."`) — standard MSW behaviour that copies the browser worker; harmless for node/jsdom `setupServer` use. Flag at the supply-chain checkpoint. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query polling | hand-rolled `setInterval` + `useEffect` | Forbidden by CLAUDE.md; you would re-implement cleanup/cancellation/stale handling worse. |
| MSW for jsdom tests | Playwright `page.route` only | Playwright covers the e2e flow, but hook-level unit tests (terminal detection, zod parse, cancel cleanup) need node-level interception — MSW `setupServer` is the right tool. Use **both** (MSW for jsdom, Playwright `route` for the preview build), as the existing e2e split already implies. |
| MSW | Vitest `vi.fn()` fetch mock | Hand-mocking `fetch` loses the realistic request/response round-trip and the abort semantics; MSW is the established pattern in the locked stack. |

**Installation:**
```bash
# runtime (behind supply-chain checkpoint, pinned exact)
npm install @tanstack/react-query@5.101.0
# dev (test transport stub)
npm install -D msw@2.14.6
```

**Version verification (this session):**
- `@tanstack/react-query` → `npm view` returns `5.101.0`, peer `react: ^18 || ^19`. `[VERIFIED: npm registry]`
- `msw` → `npm view` returns `2.14.6` (latest, modified 2026-05-11), peer `typescript >= 4.8.x`, engines `node >=18`. `[VERIFIED: npm registry]`

## Package Legitimacy Audit

> slopcheck was **not available** at research time (`pip install slopcheck` failed in-session). Both packages are nonetheless verified against the correct registry with authoritative provenance. The planner should still gate the install behind the established `T-*-SC` supply-chain checkpoint (Phases 1/4 convention).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tanstack/react-query` | npm | mature (5.x line) | very high (millions/wk) | github.com/TanStack/query | unavailable | Approved — CLAUDE.md-mandated, pinned `5.101.0` |
| `msw` | npm | mature (2.x line) | very high (millions/wk) | github.com/mswjs/msw | unavailable | Approved — official MSW; **note `postinstall` script** (worker copy, standard) — review at SC checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (`msw` postinstall is expected MSW behaviour, not a red flag — it references only in-package `./config/scripts/postinstall.js`, no external network/path)

*slopcheck was unavailable; per protocol the planner SHOULD gate both installs behind a `checkpoint:human-verify` (the existing `T-5-SC` supply-chain pattern already satisfies this).*

## Architecture Patterns

### System Architecture Diagram

```
  Configure (/) ─ Run click (valid) ─┐
                                      │  buildPackRequest(config) → { request, idToType }
                                      ▼
                          navigate('/loading')  ── carries { request, idToType } (router state / store)
                                      │
                                      ▼
        ┌─────────────────────────  /loading route (eager, three-free)  ─────────────────────────┐
        │                                                                                          │
        │  useSubmitAndPoll(request)                                                                │
        │     │                                                                                     │
        │     ├─► useMutation: POST /api/v1/pack  ──(AbortSignal)──►  API ──► 202 { job_id }         │
        │     │        │ onError (throw) ─────────────────────────────────────► [UNREACHABLE bucket]│
        │     │        ▼ onSuccess: jobId                                                            │
        │     │                                                                                      │
        │     └─► useQuery(['job', jobId], enabled: !!jobId)                                          │
        │             │  refetchInterval: (q) => isTerminal(q.state.data?.status) ? false : 1000      │
        │             │  queryFn: GET /api/v1/jobs/{jobId} (AbortSignal) → zod.parse(JobState)         │
        │             │        │ throw (network/CORS/non-2xx/zod-fail) ───────► [UNREACHABLE bucket]   │
        │             ▼        ▼                                                                       │
        │       status==='queued'|'running'  → spinner + honest sub-line ("Queued" / "Packing…")      │
        │       status==='done'              → navigate('/result', { replace:true })  [SUCCESS]        │
        │       status==='failed'            → error card (error.message)              [FAILED]         │
        │       status==='timeout'           → error card ("solver ran out of time")  [TIMEOUT]        │
        │       client safety-cap elapsed    → error card (treat as timeout/unreachable)               │
        │                                                                                              │
        │   Cancel / Back / unmount → AbortController.abort() + query disabled → navigate('/')          │
        └──────────────────────────────────────────────────────────────────────────────────────────┘
                                      │  (result lives in react-query cache, keyed by job_id; + idToType)
                                      ▼
                          /result (lazy, three-only)  ── reads in-memory done payload (Phase 6 wires it)
```

File-to-responsibility mapping is in the table below; the diagram shows data flow only.

### Recommended Project Structure
```
src/
├── api/                      # NEW (D-11) — three-free, eager-reachable
│   ├── client.ts             # thin fetch wrapper: base-URL resolution, AbortSignal, JSON, throw-on-non-2xx
│   ├── pack-schema.ts        # zod schemas mirroring pack-contract.ts (JobState, JobAccepted, ErrorBody)
│   ├── errors.ts             # PackError taxonomy + classifyFetchError() (network/CORS bucketing)
│   ├── useSubmitJob.ts       # useMutation(POST /pack)
│   └── usePollJob.ts         # useQuery(GET /jobs/{id}) with refetchInterval + safety cap
├── routes/
│   └── LoadingPage.tsx       # NEW — owns the lifecycle, renders spinner/summary/error-card
├── features/loading/         # (optional) JobSummaryCard, ErrorCard, CometSpinner
└── main.tsx                  # QueryClientProvider added above RouterProvider
```

### Component Responsibilities
| File | Responsibility |
|------|---------------|
| `src/main.tsx` | Wrap `<RouterProvider>` in `<QueryClientProvider client={queryClient}>` (new top-level provider). |
| `src/router.tsx` | Add `{ path: '/loading', element: <LoadingPage /> }` — eager, NOT `lazy()`, three-free (D-03/C-06). |
| `src/api/client.ts` | Resolve base URL (`import.meta.env.VITE_API_URL`; dev uses `/api` proxy), do fetch with `signal`, throw a typed error on non-2xx / network failure. |
| `src/api/pack-schema.ts` | `jobStateSchema` (the zod boundary, C-02) + `jobAcceptedSchema`. `safeParse` failures → a "contract drift" error in the unreachable bucket. |
| `src/api/usePollJob.ts` | `useQuery` with `refetchInterval` callback returning `false` on terminal; `enabled: !!jobId`; client safety cap. |
| `src/routes/LoadingPage.tsx` | Read `{ request, idToType }`, run submit→poll, render the four UI states, navigate on `done`, abort on leave. |
| `src/features/config/ConfigForm.tsx` | `onValid()`: replace `console.log` with `navigate('/loading', { state: { ... } })` (keep `runDisabled` gate, C-03). |

### Pattern 1: Submit-then-poll with terminal-aware `refetchInterval`
**What:** A mutation fires the POST; its `job_id` enables a query whose `refetchInterval` stops itself on a terminal status.
**When to use:** This is the canonical TanStack Query async-job pattern (v5).
**Example:**
```typescript
// Source: TanStack Query v5 docs — refetchInterval accepts (query) => number | false | undefined
// [CITED: tanstack.com/query/v5 useQuery refetchInterval]
const TERMINAL = new Set(['done', 'failed', 'timeout']);
const isTerminal = (s?: string) => !!s && TERMINAL.has(s);

const poll = useQuery({
  queryKey: ['job', jobId],
  queryFn: ({ signal }) => fetchJobState(jobId!, signal), // zod-parsed JobState
  enabled: !!jobId,
  // v5 signature: callback receives the Query object; return false to stop polling.
  refetchInterval: (query) => (isTerminal(query.state.data?.status) ? false : POLL_MS),
  refetchIntervalInBackground: true, // keep polling if the tab is briefly backgrounded
  gcTime: Infinity,   // keep the `done` payload cached for the /result hand-off (D-05) until app teardown
  staleTime: 0,
  retry: false,       // do NOT auto-retry polls — a throw means the unreachable bucket; user uses Retry
});
```

### Pattern 2: AbortSignal propagation for clean cancel/unmount (SC-3)
**What:** Both the POST and each poll fetch receive the query/mutation `AbortSignal`; leaving `/loading` aborts in-flight work.
**When to use:** Always here — SC-3 demands no leaked intervals/requests on unmount.
**Example:**
```typescript
// react-query passes an AbortSignal into queryFn; forward it to fetch.
async function fetchJobState(jobId: string, signal: AbortSignal): Promise<JobState> {
  const res = await fetch(`${BASE}/api/v1/jobs/${jobId}`, { signal });
  if (!res.ok) throw new PackError('unreachable', `HTTP ${res.status}`);
  return jobStateSchema.parse(await res.json()); // zod boundary (C-02)
}
// Cancel = stop the query (enabled→false / remove) + abort the mutation; react-query
// aborts the in-flight queryFn signal automatically when the query is disabled/unmounted.
```
Note: on unmount react-query cancels the in-flight `queryFn` via its signal and clears the
`refetchInterval` timer — no manual `clearInterval` needed (that is precisely why C-01 forbids
hand-rolled `setInterval`).

### Pattern 3: Network/CORS error bucketing
**What:** Distinguish the server's own `failed`/`timeout` (a `200` poll with a status) from transport failures (POST or poll throws).
**When to use:** D-07 SC-4 requires the "unreachable/CORS" bucket be distinct.
**Example:**
```typescript
// A browser CORS rejection is an opaque `TypeError: Failed to fetch` — NO status, NO body.
// Verified live: the API sends no Access-Control-Allow-Origin for a cross-origin browser call.
function classifyFetchError(e: unknown): PackErrorKind {
  if (e instanceof PackError) return e.kind;            // our typed non-2xx
  if (e instanceof DOMException && e.name === 'AbortError') return 'aborted'; // expected on cancel
  if (e instanceof TypeError) return 'unreachable';     // fetch network/CORS/DNS/refused
  if (e instanceof ZodError) return 'contract-drift';   // treat as unreachable bucket in UI
  return 'unreachable';
}
```

### Anti-Patterns to Avoid
- **Reading a status code off a CORS failure:** impossible — the throw is an opaque `TypeError`. Bucket *all* fetch throws (except `AbortError`) as unreachable.
- **`retry: true` on the poll query:** would silently re-fire a failing poll and mask the unreachable state; keep `retry:false` and surface Retry as a user action (D-07).
- **Persisting the `done` result to localStorage:** forbidden (D-05) — result is ephemeral; only the *config* is autosaved.
- **Importing three/r3f/drei (or `@/components/viewer/*`, `@/routes/ResultPage`) from `/loading` or `src/api/`:** breaks the code-split gate (C-06). The gate (`scripts/check-code-split.mjs`) asserts three lives only in the lazy chunk.
- **Treating `unpacked_items.length > 0` as an error:** it is a `done`/SUCCESS response — route to `/result` (D-07; the most common SC-4 misread).
- **Mutating the input config / rebuilding `idToType`:** retain the Map from submit time and pass it through (C-05).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Poll loop + stop condition | `setInterval` + `useEffect` cleanup | `useQuery` `refetchInterval`-returning-`false` | Cleanup, cancellation, unmount safety, stale handling all free; CLAUDE.md mandate. |
| In-flight request cancellation | manual flag + ignore-late-response | react-query's `AbortSignal` into `fetch` | Actually aborts the socket; no zombie requests on unmount (SC-3). |
| Response validation | `as DoneResponse` cast | `zod.parse` at the boundary (C-02) | A cast hides drift until a render crash; zod surfaces it as a handled error. |
| Test transport stubbing | hand-mocked `fetch`/`vi.fn` | MSW `setupServer` (jsdom) + Playwright `page.route` (e2e) | Realistic round-trips incl. abort + multi-poll sequences; the locked-stack convention. |
| Result hand-off store | bespoke React context/global | react-query cache keyed by `job_id` | The cache IS the in-memory carrier (D-05); `/result` reads it; `gcTime` controls lifetime. |

**Key insight:** Every "edge" of an async poll (cancel, unmount, network drop, contract drift, terminal detection) is a documented footgun that TanStack Query + zod + MSW already solve. The phase's job is *wiring*, not building primitives.

## Runtime State Inventory

> This is **not** a rename/refactor phase (it adds new code). Section included only to record the in-memory state introduced, since D-05 makes ephemerality a deliberate decision.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — result is in-memory only by design (D-05); config localStorage (`palletize:config:v1`) is Phase 4's and stays untouched. | none |
| Live service config | None — no new server-side state; the packing API is author-controlled and unchanged. | none |
| OS-registered state | None. | none |
| Secrets/env vars | `VITE_API_URL` (build-time, already typed in `src/vite-env.d.ts`) — Phase 5 is its first *consumer*, not a renamer. | consume only |
| Build artifacts | None new beyond the two npm deps. | none |

**In-memory state introduced (by design):** the react-query cache entry `['job', job_id]` holds the `done` payload, plus the retained `idToType` Map. Both vanish on refresh → D-06 redirect handles the empty case.

## Common Pitfalls

### Pitfall 1: Client safety cap set too low (the 25s-vs-90s trap)
**What goes wrong:** The context assumed `time_budget_s=25` and suggested a ~60-90s client cap. The live spec says the budget is clamped to `[1s, ~90s default ceiling]` with a hard kill ~30s above (~120s). A 60-90s client cap would abort jobs the server is still legitimately solving.
**Why it happens:** The committed fixture/request bakes `time_budget_s:25` (a *request*), but the server can run up to its own ceiling, and a `queued` job waits for a worker before that clock even starts.
**How to avoid:** Set the client safety cap to **~120-140s** (above the server's ~120s hard kill) so the server's own `timeout` terminal almost always wins first; the client cap is only a backstop for a server that never returns a terminal status. Make it a named constant; planner confirms against observed latency.
**Warning signs:** Jobs erroring out client-side at ~60s while the API would have returned `done`/`timeout` later.

### Pitfall 2: Mistaking a CORS failure for a server error
**What goes wrong:** Trying to branch on `res.status` after a cross-origin fetch that the browser blocked — there is no response object, just a thrown `TypeError`.
**Why it happens:** Verified live: the API sends no `Access-Control-Allow-Origin` for a `localhost` origin and `405`s preflight; in dev the Vite `/api` proxy hides this, in a misconfigured prod it will not.
**How to avoid:** Catch the throw, classify any non-`AbortError` `TypeError` as the unreachable bucket (Pattern 3). Never assume a readable status on a thrown fetch.
**Warning signs:** Uncaught `TypeError: Failed to fetch` crashing the loading screen; a blank screen instead of the "couldn't reach the packing service" card.

### Pitfall 3: `AbortError` shown to the user as a failure
**What goes wrong:** Cancel/Back/unmount aborts the fetch, which rejects with an `AbortError`; if not special-cased it renders the unreachable error card on a route the user is already leaving.
**Why it happens:** Abort is a rejection like any other.
**How to avoid:** Classify `DOMException name==='AbortError'` as `aborted` (a no-op for the UI) — the user is navigating to `/` anyway (D-08). Don't surface it.
**Warning signs:** A flash of the error card on Cancel.

### Pitfall 4: `gcTime` too short — `/result` finds no payload
**What goes wrong:** After `navigate('/result')`, if `/loading` unmounts and the query's `gcTime` (default 5min) elapses or the entry is GC'd, the cached `done` payload disappears.
**Why it happens:** react-query garbage-collects inactive queries.
**How to avoid:** Set `gcTime: Infinity` on the poll query (or keep an observer alive), so the `done` entry survives the hand-off until app teardown / refresh (D-05). D-06 already handles the refresh-empty case via redirect.
**Warning signs:** `/result` redirecting to `/` immediately after a successful job.

### Pitfall 5: zod schema too strict for forward-compat fields
**What goes wrong:** The API marks several response objects `additionalProperties: true` (`PackResult`, `PlacementOut`, `UnpackedItem`) and reserves a `meta` field. A `z.object().strict()` would reject a future field and throw a contract-drift error on a perfectly good `done`.
**Why it happens:** Over-tight boundary schema.
**How to avoid:** Use non-strict objects (zod's default `.passthrough`-equivalent: plain `z.object` already ignores unknown keys in zod 4) and only tighten `status` to the known union. Validate *structure you depend on*, tolerate extras.
**Warning signs:** Intermittent contract-drift errors after an API minor bump.

### Pitfall 6: MSW `setupServer` not wired into the existing vitest setup
**What goes wrong:** MSW handlers don't intercept because `server.listen()` was never called in the test setup.
**Why it happens:** The project's `src/test/setup.ts` currently only registers jest-dom matchers; it has no MSW lifecycle.
**How to avoid:** Add MSW `beforeAll(listen)/afterEach(resetHandlers)/afterAll(close)` to `src/test/setup.ts` (or a dedicated setup file added to `vitest.config.ts` `setupFiles`). `onUnhandledRequest:'error'` catches missed stubs.
**Warning signs:** Hook tests hitting the real network / hanging.

## Code Examples

### The zod network boundary (C-02), mirroring pack-contract.ts
```typescript
// Source: derived from the LIVE OpenAPI (packerapi.anzozulia.xyz/openapi.json, fetched 2026-06-04)
// [VERIFIED: live OpenAPI components.schemas.JobState / ErrorBody]
import { z } from 'zod';

export const errorBodySchema = z.object({
  code: z.string(),                              // not a fixed enum; treat unknown as generic
  message: z.string().nullish(),
  problems: z.array(z.string()).nullish(),
});

export const jobStatusSchema = z.enum(['queued', 'running', 'done', 'failed', 'timeout']);

// Non-strict: result/error/meta are optional and present-iff-status; extra keys tolerated.
export const jobStateSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  result: z.unknown().nullish(),  // validate deeply only when status==='done' (or reuse a doneResultSchema)
  error: errorBodySchema.nullish(),
  meta: z.record(z.unknown()).nullish(),
});

export const jobAcceptedSchema = z.object({
  job_id: z.string(),
  status: z.literal('queued').default('queued'),
  links: z.record(z.string()),  // { self: "/api/v1/jobs/..." }
});

export type JobState = z.infer<typeof jobStateSchema>;
```

### Base-URL resolution (dev proxy vs build-time bake, C-04)
```typescript
// Dev: Vite proxies '/api' → packerapi (CORS-free). Prod: VITE_API_URL is baked.
// import.meta.env.DEV is true under `npm run dev`.
const BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;
// fetch(`${BASE}/api/v1/pack`) → dev hits '/api/v1/pack' (proxied); prod hits the absolute URL.
```
Note: confirm the prod path prefix. The dev proxy forwards `/api` as-is (no rewrite), and the
real endpoints are under `/api/v1/...`; so `VITE_API_URL` should be the **origin** (e.g.
`https://packerapi.anzozulia.xyz`) and the client appends `/api/v1/...`. Planner to lock the
exact concatenation so dev and prod resolve identically.

### Loading-screen summary card from the existing tally (D-01)
```typescript
// Reuse src/lib/config-tally.ts (backs the Phase-4 FooterBar) — do NOT recompute (D-01).
import { tallyCatalog } from '@/lib/config-tally';
const { types, units, estKg } = tallyCatalog(config.boxTypes);
// Pallet cell: `${pallet.length} × ${pallet.width} × ${pallet.height} mm`
// Boxes cell:  `${types} types · ${units} units`
// Est. weight: `${estKg} kg`
// Sub-line: map status → honest text { queued:'Queued', running:'Packing…' } — NO fake %, NO cycling flavor text.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `refetchInterval: (data, query) => ...` (v4 signature) | `refetchInterval: (query) => ...` (single `Query` arg; read `query.state.data`) | TanStack Query v5 | Use the v5 single-arg callback; read status off `query.state.data?.status`. |
| MSW 1.x `rest.get(...)` | MSW 2.x `http.get(...)` + `HttpResponse.json(...)` | MSW 2.0 | Use `http`/`HttpResponse`; `setupServer` from `msw/node` for jsdom. |
| `cacheTime` | `gcTime` | TanStack Query v5 | Use `gcTime` for the result-retention knob (Pitfall 4). |

**Deprecated/outdated:**
- The context's "server `time_budget_s=25` → ~60-90s cap" reasoning: **superseded** by the live spec (ceiling ~90s, hard kill ~120s). Use a ~120-140s cap.
- MSW `rest` namespace: replaced by `http` in MSW 2.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `VITE_API_URL` should be the API *origin* and the client appends `/api/v1/...` (so dev `/api` proxy and prod resolve identically) | Code Examples (base-URL) | Low — planner locks the exact concatenation; both paths are testable. Mis-set → 404s caught by the unreachable bucket, not a crash. |
| A2 | The hard wall-clock kill sits ~30s above the ~90s soft ceiling (≈120s), so a ~120-140s client cap is safe | Pitfall 1 / D-09 | Medium — if the real ceiling differs, the cap may abort early or sit idle. Mitigation: planner confirms against observed latency; the cap is a tunable named constant. The OpenAPI states "~30 s above" the soft budget explicitly, so confidence is high. |
| A3 | MSW's `postinstall` is benign (in-package worker copy) | Package Legitimacy Audit | Low — verified the script references only `./config/scripts/postinstall.js`; review at the SC checkpoint regardless. |

**Note:** All other contract claims (status union, error shape, no-cancel-endpoint, max_load_on_top/this_side_up support, CORS opacity) are `[VERIFIED]` against the live API this session — not assumed.

## Open Questions

1. **Exact prod path concatenation for `VITE_API_URL`.**
   - What we know: dev proxy forwards `/api` as-is; live endpoints are `/api/v1/*`; `VITE_API_URL` is currently an unconsumed typed string.
   - What's unclear: whether self-hosters set it to the origin (`https://host`) or to `https://host/api` — affects the client's string-building.
   - Recommendation: lock `VITE_API_URL` = origin; client owns the `/api/v1` prefix. Document in the env note (carries into Phase 7's HOST-02).

2. **Whether to actually send `max_load_on_top` / `this_side_up` now (D-08).**
   - What we know: the API **accepts** both (verified — see D-08 resolution below). The request-builder currently omits them.
   - What's unclear: a product call — does the team want fragile/max-load to take effect in v1, or stay persisted-but-unsent until later?
   - Recommendation: **enabling them is low-cost and makes the existing BOX-03 inputs functional.** If enabled, extend `BoxRequest`/`buildPackRequest` to emit `max_load_on_top` (0 when fragile, else the per-type maxLoad) and keep the rotation mapping (already `this_side_up` for `uprightOnly`). This is a planner/user decision; the contract no longer blocks it.

## D-08 Resolution (the deferred OpenAPI question)

**RESOLVED against the live OpenAPI.** `BoxIn` (the POST `/pack` box schema) accepts:
- `max_load_on_top` (number ≥ 0, nullable): *"Omitted or `null` = unlimited; `0` = fragile (nothing may be placed on it)."* — so **fragile maps to `max_load_on_top: 0`**, and the per-type max-load maps directly.
- `rotations: 'all' | 'this_side_up' | 'none'` (already wired in the request-builder).
- Bonus fields available but out of scope: `group` (co-location, only with `max_pallets>1`), `requires_full_support` (per-box 100% support override).

So the D-08 question — "does the API accept per-box max_load/fragile, or should fragile map to this_side_up?" — answers: **the API accepts both `max_load_on_top` (the correct fragile channel, NOT `this_side_up`) and the `this_side_up` rotation independently.** `fragile` is `max_load_on_top: 0`, *not* a rotation. Whether to send them is a product decision (Open Question 2); the contract supports it cleanly. If the team defers, the builder stays unchanged and the fields remain persisted-but-unsent — no contract blocker either way.

## Cancel Mechanism Resolution (D-08)

**RESOLVED: client-side-only, confirmed.** The live OpenAPI exposes exactly four paths —
`GET /health`, `GET /version`, `POST /pack`, `GET /jobs/{job_id}` — **no DELETE / cancel
endpoint exists.** Cancel is therefore `AbortController.abort()` (in-flight POST/poll) +
stopping the react-query poll + `navigate('/')` with the draft intact (D-08). The server
keeps solving in the background; the client simply stops listening. This exactly matches the
context's assumption.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Live packing API | Manual dev verification (not CI) | ✓ | service 0.1.0 / core 3.13.0 / api v1 | Tests never hit it — MSW/Playwright stubs. |
| `npm` (install deps) | react-query + MSW install | ✓ | (project uses npm, lockfile present) | — |
| Vite `/api` dev proxy | CORS-free local dev | ✓ | configured in vite.config.ts | prod uses baked `VITE_API_URL` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — the live API is reachable but is **not** a test dependency (CI uses MSW/Playwright route interception, per CLAUDE.md and the existing e2e split).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `4.1.8` (jsdom) + @testing-library/react `16.3.2`; @playwright/test `1.60.0` (e2e) |
| Config file | `vitest.config.ts` (setupFiles: `./src/test/setup.ts`); `e2e/**` excluded from vitest |
| Quick run command | `npm run test` (vitest, jsdom) |
| Full suite command | `npm run test` + `npm run build && npm run preview` Playwright e2e (existing webServer pattern) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PACK-01 | Valid config → POST `/pack` → `202 { job_id }`; submit hook returns job_id | unit (MSW) | `npm run test -- src/api/useSubmitJob.test.tsx` | ❌ Wave 0 |
| PACK-04 | Poll `/jobs/{id}` until terminal; `refetchInterval` stops on `done`; honest status sub-line | unit (MSW) | `npm run test -- src/api/usePollJob.test.tsx` | ❌ Wave 0 |
| PACK-04 | zod boundary: a malformed `JobState` → handled error, not crash | unit | `npm run test -- src/api/pack-schema.test.ts` | ❌ Wave 0 |
| PACK-05 | Cancel/unmount aborts in-flight + stops poll; no leaked interval/request | unit (MSW) + e2e | `npm run test -- src/routes/LoadingPage.test.tsx` | ❌ Wave 0 |
| PACK-06 | `failed` / `timeout` / unreachable-CORS / unpacked>0 each distinguished; none crash | unit (MSW) + e2e | `npm run test -- src/routes/LoadingPage.test.tsx` | ❌ Wave 0 |
| PACK-06 | full Configure→loading→result + each error path | e2e (Playwright `route`) | `e2e/api-poll.spec.ts` | ❌ Wave 0 |
| SC (C-06) | `/loading` + `src/api/` stay three-free | build gate | `node scripts/check-code-split.mjs` (after `npm run build`) | ✅ exists |

### Sampling Rate
- **Per task commit:** `npm run test` (vitest quick run, jsdom).
- **Per wave merge:** `npm run test` + `npm run build && node scripts/check-code-split.mjs` (code-split gate).
- **Phase gate:** full vitest + Playwright e2e green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] MSW install + handlers: `src/test/msw/handlers.ts` (POST 202 + GET poll-sequence stubs: queued→running→done, →failed, →timeout, network-throw) and `src/test/msw/server.ts`
- [ ] Extend `src/test/setup.ts` with MSW `listen/resetHandlers/close` lifecycle (`onUnhandledRequest:'error'`)
- [ ] react-query test wrapper: a `renderWithClient` helper (fresh `QueryClient` per test, `retry:false`, `gcTime:0` for tests) — the standard RTL+react-query gotcha (each test needs an isolated client)
- [ ] `src/api/*.test.tsx`, `src/routes/LoadingPage.test.tsx`, `src/api/pack-schema.test.ts`
- [ ] `e2e/api-poll.spec.ts` using Playwright `page.route('**/api/v1/**', ...)` to stub the poll sequence deterministically (mirror the existing `config-persist.spec.ts` style)
- [ ] Framework install: `npm install -D msw@2.14.6`

## Security Domain

> `security_enforcement: true`, ASVS level 1. This phase introduces the app's first real network IO, so input/output validation and transport are the relevant controls.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Stateless tool, no auth (PROJECT.md: no login). |
| V3 Session Management | no | No sessions; result is ephemeral in-memory. |
| V4 Access Control | no | No protected resources client-side. |
| V5 Input Validation | **yes** | zod at the network boundary (C-02) — validate `JobState`/`ErrorBody` before use (`jobStateSchema`). Request side already validated by the Phase-4 config schema. |
| V6 Cryptography | no | No secrets handled client-side; `VITE_API_URL` is non-secret build config. HTTPS transport is the API's concern. |
| V13/V14 (API/Config) | partial | Transport is HTTPS (the live API enforces TLS/h2). The `VITE_API_URL` CORS allowlist hardening is **Phase 7** (HOST-02), explicitly deferred. |

### Known Threat Patterns for this stack (browser SPA ↔ JSON API)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/changed API response crashes the render | Tampering / DoS | zod `safeParse` at the boundary → handled "contract-drift" error (Pitfall 5). |
| Opaque CORS rejection mishandled → blank crash | DoS (availability) | Catch + bucket all fetch `TypeError`s as unreachable (Pattern 3); never assume a readable status. |
| Leaked in-flight requests / intervals on unmount | Resource exhaustion | `AbortSignal` + react-query auto-cancel (SC-3); no hand-rolled timers (C-01). |
| Injecting unvalidated `result` into the 3D scene | Tampering | Deferred to Phase 6, but the zod boundary here is the first line — only structurally-valid `done` payloads reach `/result`. |
| Untrusted `error.message`/`problems` rendered in the error card | XSS | React escapes text by default; render as text (never `dangerouslySetInnerHTML`). |

## Sources

### Primary (HIGH confidence)
- **Live OpenAPI** `https://packerapi.anzozulia.xyz/openapi.json` (fetched 2026-06-04) — full schemas: `JobState` (status enum + result-iff-done / error-iff-failed-timeout), `JobAccepted` (202 shape + `links.self`), `BoxIn` (`max_load_on_top`, `rotations`, `group`, `requires_full_support`), `OptionsIn` (`time_budget_s` clamp `[1s, ~90s ceiling]`, hard kill ~30s above), `ErrorBody`/`ErrorEnvelope`. Paths confirmed: only `GET /health`, `GET /version`, `POST /pack`, `GET /jobs/{job_id}` — **no cancel endpoint**.
- **Live API exercise** (this session): submitted a real job → observed `queued → running → done` with `result` present; `404 {error:{code:'not_found'}}` for unknown job; `422 {error:{code:'validation_error', problems:[...]}}` for bad body; `202` (no ACAO header) + `405` on OPTIONS preflight for a `localhost` origin → confirms opaque-CORS bucket.
- **CLAUDE.md** — locked stack/versions; the "Async Polling Pattern (TanStack Query)" mandate; code-split + MSW/Playwright testing rules.
- **Codebase** — `src/types/pack-contract.ts`, `src/features/config/ConfigForm.tsx` (the Run seam), `src/lib/{request-builder,result-mapper,config-tally}.ts`, `src/router.tsx`, `src/main.tsx`, `vite.config.ts`, `vitest.config.ts`, `scripts/check-code-split.mjs`, `e2e/config-persist.spec.ts`, `design/loading.html`.
- **npm registry** (this session) — `@tanstack/react-query@5.101.0` (peer `react ^18||^19`), `msw@2.14.6` (latest, peer `typescript >=4.8.x`, node `>=18`, postinstall noted).

### Secondary (MEDIUM confidence)
- TanStack Query v5 docs — `refetchInterval` callback signature `(query) => number|false`, `gcTime`, `AbortSignal` in `queryFn`. `[CITED: tanstack.com/query/v5]`
- MSW 2 setup with Vitest/jsdom (`setupServer` from `msw/node`, `http`/`HttpResponse`, setup-file lifecycle). `[CITED: mswjs.io/docs]`

### Tertiary (LOW confidence)
- None — all load-bearing claims were verified against the live API or the codebase this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions/peers verified on npm; both packages authoritative and already implied by CLAUDE.md.
- API contract / architecture: HIGH — fetched the live OpenAPI and ran a real job; all four terminal states, error shape, no-cancel-endpoint, and CORS opacity directly observed.
- D-08 / D-09 resolutions: HIGH — `max_load_on_top`/`this_side_up` and the budget ceiling read straight from the spec.
- Pitfalls: HIGH — derived from observed behaviour (CORS opacity, budget ceiling) and documented TanStack Query/MSW semantics.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable stack; re-verify the live API contract if the service version moves past `0.1.0`)

## Project Constraints (from CLAUDE.md)

- Use `@tanstack/react-query` for the submit-then-poll flow — **do not hand-roll** `setInterval`/`useEffect` polling (mandate).
- zod at the network boundary (validate `GET /jobs/{id}` responses) — C-02.
- Pin versions exactly per the locked quartet; React stays `19.2.x` (`<19.3` r3f cap). `@tanstack/react-query@5.101.0` is the locked version.
- Code-split discipline: `/loading` + `src/api/` must stay three-free; `scripts/check-code-split.mjs` is the build gate. Only `/result` (lazy) imports three/r3f/drei.
- Build-time `VITE_API_URL` (`import.meta.env`), not runtime — runtime override is Phase 7.
- Tailwind v4 `@theme` tokens (no inline hex where a token exists); no CSS-in-JS.
- react-router 7 **library/SPA mode** (`createBrowserRouter`); import from `react-router`.
- Tests: vitest+jsdom for logic/hooks (mocked transport — MSW), Playwright preview-build for the real flow against a **stubbed** API; never the live service in CI. Do **not** unit-test WebGL in jsdom (N/A this phase — three-free).
- Supply-chain checkpoint convention (`T-*-SC`) before dependent waves build on a new dependency.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-01 | User can submit the configuration to run a packing calculation | `POST /api/v1/pack` verified (202 `{job_id, status:'queued', links.self}`); `useSubmitJob` (`useMutation`) pattern + `jobAcceptedSchema`. Seam: `ConfigForm.onValid()` → `navigate('/loading', {state:{request, idToType}})`. |
| PACK-04 | Loading state + poll the async job to a terminal state | `GET /api/v1/jobs/{id}` status union `{queued,running,done,failed,timeout}` verified; `usePollJob` (`useQuery` + `refetchInterval`→`false` on terminal); zod boundary; honest status sub-line from real `status`; summary card from `config-tally`. Client safety cap ~120-140s (Pitfall 1). |
| PACK-05 | Cancel an in-progress job; polling stops cleanly | Client-side-only cancel confirmed (no DELETE endpoint); `AbortSignal` into POST + poll, react-query auto-cancel on unmount/disable; Cancel/Back/unmount → abort + `navigate('/')` draft-intact (D-08). |
| PACK-06 | Distinguish failure / timeout / unreachable-CORS / some-unpacked; none crash | `failed`/`timeout` carry `error.{code,message,problems}` (verified); unreachable = opaque `TypeError` bucket (CORS verified live); `unpacked_items>0` is a `done`/SUCCESS → `/result`; error card with Retry (re-POST) / Back (D-07). |
```