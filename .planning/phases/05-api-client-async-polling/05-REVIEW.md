---
phase: 05-api-client-async-polling
reviewed: 2026-06-05T00:00:00Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - e2e/api-poll.spec.ts
  - src/api/client.ts
  - src/api/errors.test.ts
  - src/api/errors.ts
  - src/api/pack-schema.test.ts
  - src/api/pack-schema.ts
  - src/api/queryClient.ts
  - src/api/usePollJob.test.tsx
  - src/api/usePollJob.ts
  - src/api/useSubmitJob.test.tsx
  - src/api/useSubmitJob.ts
  - src/features/config/ConfigForm.tsx
  - src/features/loading/ErrorCard.tsx
  - src/main.tsx
  - src/router.tsx
  - src/routes/LoadingPage.test.tsx
  - src/routes/LoadingPage.tsx
  - src/test/msw/handlers.ts
  - src/test/msw/renderWithClient.tsx
  - src/test/msw/server.ts
  - src/test/setup.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** deep
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the async submit-then-poll API layer at deep depth, tracing the full call chain
`ConfigForm → navigate('/loading') → useSubmitJob → submitPackJob` and
`usePollJob → fetchJobState → zod boundary → LoadingPage terminal derivation → navigate('/result')`,
plus the error taxonomy, AbortSignal propagation, and MSW/Playwright test infra.

The overall architecture is sound and the zod-at-boundary discipline is good. However the adversarial
pass surfaced two real correctness bugs in the poll lifecycle that produce wrong UI under the **Retry**
path and under a poll that **errors mid-flight**, neither of which is exercised by the current tests
(every test mounts a fresh hook, so the persistent-state bugs are invisible). There is also a genuine
production-config foot-gun in `API_BASE` resolution when `VITE_API_URL` is unset.

## Critical Issues

### CR-01: `capTripped` never resets — a spurious "timeout" card appears on Retry after a prior cap trip

**File:** `src/api/usePollJob.ts:93,113` (consumed at `src/routes/LoadingPage.tsx:142,157-163`)

**Issue:** `capTripped` is a `useState` that is only ever set to `true` (line 107: `setCapTripped(true)`),
never back to `false`. The exported flag is derived as `isCapExceeded = capTripped && !!jobId && !terminal`
(line 113). This derivation masks a stale trip *only while the job stays terminal/absent* — it does **not**
clear `capTripped` itself.

Trace the Retry path: `LoadingPage` keeps a single, never-remounted `usePollJob` instance. Suppose attempt 1
exceeds the cap on a stuck (`running`) job → `capTripped` latches `true`, the timeout card shows. The user
clicks **Retry** → `handleRetry` runs `submit.reset()` + `fireSubmit()` (LoadingPage.tsx:157-163). A new
`job_id` arrives, `jobId` becomes truthy again, and the new job is still non-terminal (`queued`/`running`).
Now `isCapExceeded = true && true && true = true` **instantly**, before the new poll has had any chance to
run for `safetyCapMs`. The user is shown the timeout error card on a job that just started. The only way out
is another Retry that happens to settle before the next render — i.e. Retry is effectively broken after any
cap trip.

The same latch also fires spuriously if `jobId` changes to a *new* non-terminal job within the same hook
instance for any reason.

**Fix:** Reset the latch when a fresh arming begins, and gate the timer arm so a re-arm clears the prior trip:
```ts
useEffect(() => {
  if (!jobId || terminal) {
    startRef.current = null;
    return;
  }
  if (startRef.current === null) {
    startRef.current = Date.now();
    setCapTripped(false); // fresh job → clear any stale trip from a previous job
  }
  const remaining = safetyCapMs - (Date.now() - startRef.current);
  const timer = setTimeout(() => setCapTripped(true), Math.max(0, remaining));
  return () => clearTimeout(timer);
}, [jobId, terminal, safetyCapMs, query.dataUpdatedAt]);
```
Note the `setCapTripped(false)` must run only on the *fresh-arm* branch (when `startRef.current === null`),
not unconditionally, to avoid clobbering a legitimate trip on every poll tick. A cleaner alternative is to
key the whole hook on `jobId` (remount per job) or move the cap state into a `useReducer` keyed by a
generation counter that `fireSubmit` bumps.

---

### CR-02: A stuck poll that exceeds the cap keeps hammering the network — the cap stops the *UI* but not the *poll loop*

**File:** `src/api/usePollJob.ts:79,113` (interaction with `src/routes/LoadingPage.tsx:113,142`)

**Issue:** `isCapExceeded` is a *derived display flag*; it does nothing to stop the underlying react-query
poll. `refetchInterval` (line 79) returns `false` only when `isTerminal(data?.status)` is true. On a server
that never returns a terminal status (the exact scenario the cap exists for — PACK-05 / T-5-05), the status
stays `running` forever, so `refetchInterval` keeps returning `POLL_INTERVAL_MS` and react-query keeps firing
`GET /jobs/{id}` once per second **indefinitely**, even after the timeout card is shown. `LoadingPage`
renders the `ErrorCard` (LoadingPage.tsx:142,186) but does **not** drop `jobId` or disable the query the way
Cancel does (`cancelled ? undefined : jobId`, line 113). The poll is only actually stopped if the user then
clicks Cancel/Back.

This is a resource/lifecycle defect: the safety cap was specified to "bound" a never-settling server, but the
network loop is unbounded — it merely gets a UI overlay. With `refetchIntervalInBackground: true` (line 80)
it also keeps polling when the tab is backgrounded.

**Fix:** Make the cap actually stop the loop. Either disable the query once the cap trips:
```ts
const query = useQuery({
  queryKey: ['job', jobId],
  queryFn: ({ signal }) => fetchJobState(jobId!, signal),
  enabled: !!jobId && !capTripped,
  refetchInterval: (q) =>
    isTerminal(q.state.data?.status) || capTripped ? false : POLL_INTERVAL_MS,
  // ...
});
```
or have `LoadingPage` drop the `jobId` into `usePollJob` once `poll.isCapExceeded` is true (mirroring the
`cancelled` guard). Without this, the cap is cosmetic.

## Warnings

### WR-01: `API_BASE` becomes the literal string `"undefined"` in a production build with no `VITE_API_URL`

**File:** `src/api/client.ts:20`

**Issue:** `export const API_BASE: string = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;`
There is no `.env`/`.env.production` in the repo and `vite-env.d.ts` types `VITE_API_URL` as a non-optional
`string`, which is a lie at runtime. If a self-hoster runs `npm run build` without passing the build-arg,
`import.meta.env.VITE_API_URL` is `undefined`, and every fetch URL becomes
`` `${undefined}/api/v1/pack` `` → `"undefined/api/v1/pack"` — a request to a path literally beginning
`undefined/`, which fails as an opaque/relative-resolution error. The e2e even relies on this (comment
line 13: "bakes API_BASE = VITE_API_URL (unset here)") and only passes because its glob matches the path
suffix. CLAUDE.md flags the build-time env as a known seam, but there is no fail-loud guard.

**Fix:** Validate at module load and fail loudly in prod:
```ts
const rawBase = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;
if (!import.meta.env.DEV && !rawBase) {
  throw new Error('VITE_API_URL must be set at build time for production builds.');
}
export const API_BASE: string = rawBase ?? '';
```
and mark the env type optional (`readonly VITE_API_URL?: string`) so TS reflects reality.

### WR-02: `submitPackJob`'s 202 body is parsed but the error/non-2xx body is discarded silently

**File:** `src/api/client.ts:42-45`

**Issue:** On a non-2xx POST the client throws `PackError('unreachable', 'HTTP ' + res.status)` without
reading the response body, so a structured API error (e.g. a 400 validation error with a `problems` array)
is lost — the user only ever sees the generic "Couldn't reach the packing service" card even when the server
explained the rejection. For a 4xx (a request the server *did* reach and reject), classifying it as
`unreachable` and inviting blind Retry is misleading; Retry will re-POST the identical rejected request.

**Fix:** Distinguish 4xx (client/contract error — surface the body, no auto-Retry value) from 5xx/network
(unreachable). At minimum read and attach the body to the error so a future `failed`-style card can show it.

### WR-03: `jobAcceptedSchema.links` is required — a 202 without a `links` map throws contract-drift unnecessarily

**File:** `src/api/pack-schema.ts:52-56`

**Issue:** `links: z.record(z.string(), z.string())` is required, yet the app never reads `links`
(`useSubmitJob`/`LoadingPage` only use `job_id`/`status`; grep confirms `links` is used nowhere outside the
schema + its own test). The poll path is built client-side from `job_id` (`jobPath`), not from `links.self`.
A real API that omits `links` on the 202 (or renames it on a minor bump) would throw a ZodError →
contract-drift → "couldn't reach" card on an otherwise perfectly accepted job. The schema is stricter than
the code's actual needs, contradicting the stated forward-compat / non-strict design rule.

**Fix:** Make it tolerant since it is unused: `links: z.record(z.string(), z.string()).nullish()`.

### WR-04: `isLoadingNavState` validates `request` shape only loosely and never validates `idToType`

**File:** `src/routes/LoadingPage.tsx:58-66,175-180`

**Issue:** The type guard checks only that `request` is a non-null object. It does not check `request.boxes`
is an array or `request.pallet` exists, yet `summary` (line 175-178) immediately does
`request.boxes.map(...)` and destructures `request.pallet`. A malformed nav state (e.g. crafted via a
manipulated `history.state`, or a future refactor that changes the payload) with `request: {}` passes the
guard and then throws `Cannot read properties of undefined (reading 'map')` — a render crash, exactly the
class of failure the rest of this phase works hard to avoid. `idToType` is read (`idToType.values()`,
line 177) with only a truthiness guard; if present-but-not-a-Map it throws.

**Fix:** Validate the payload with a zod schema (or at least check `Array.isArray(request.boxes)` and
`request.pallet` and `idToType instanceof Map`) before use, redirecting home on failure as the deep-link
guard already does.

### WR-05: Retry can leak the previous attempt's in-flight POST AbortController is fine, but `firedRef` + mount-effect cleanup double-aborts a live Retry on unmount

**File:** `src/routes/LoadingPage.tsx:100-108,149-153,157-163`

**Issue:** The mount effect's cleanup (`return () => controllerRef.current?.abort()`, line 105) aborts
*whatever controller is current at unmount time*. After a Retry, `controllerRef.current` points at the Retry's
controller. That is the intended abort-on-unmount, so not a leak — but note the cleanup closes over
`controllerRef` (a ref, stable) and runs on every `valid` change. Since `valid` is captured once this is
effectively unmount-only, which is correct. The real smell: there is **no** abort of the *poll's* in-flight
request on Cancel beyond dropping `jobId`; react-query does abort on `enabled:false`, so this is acceptable —
but the comment block (lines 16-20, 104) overstates the guarantees. Lower-severity: the `firedRef` guard is
never reset, so if `LoadingPage` were ever reused with a new nav state without remounting (not currently
possible via the router, but a latent coupling to "this route always remounts"), the POST would never fire.

**Fix:** Document the remount assumption explicitly, or reset `firedRef` keyed on the request identity. Not a
live bug under the current router config, but a fragile invariant.

### WR-06: `refetchIntervalInBackground: true` keeps polling a hidden tab — combined with CR-02 this is an unbounded background loop

**File:** `src/api/usePollJob.ts:80`

**Issue:** Polling in the background is a deliberate choice (so a backgrounded tab still resolves), but paired
with CR-02 (cap doesn't stop the loop) and `gcTime: Infinity`, a user who backgrounds a stuck job leaves a
1 Hz request loop running indefinitely with no UI present. Even independent of CR-02, this should be a
conscious, documented trade-off.

**Fix:** Reconsider whether background polling is needed; if kept, ensure CR-02's cap-stop covers the
background case too (it does, once `enabled` is gated on `!capTripped`).

## Info

### IN-01: `JobErrorBody` interface in LoadingPage duplicates `errorBodySchema` — drift risk

**File:** `src/routes/LoadingPage.tsx:41-46` vs `src/api/pack-schema.ts:30-34`

**Issue:** `LoadingPage` re-declares the error body shape as a hand-written interface and then `as`-casts the
zod-parsed value to it (`poll.data?.error as JobErrorBody`, line 187). There is already a `z.infer` type
available from `errorBodySchema`. Two sources of truth can drift, and the `as` cast defeats the boundary
validation it sits behind.

**Fix:** Export and import `type JobError = z.infer<typeof errorBodySchema>` from `pack-schema.ts`; drop the
local interface and the cast.

### IN-02: `classifyFetchError`'s final two branches are redundant

**File:** `src/api/errors.ts:47-48`

**Issue:** `if (e instanceof TypeError) return 'unreachable'; return 'unreachable';` — both branches return the
same value, so the `instanceof TypeError` check is dead weight (the fallthrough already yields `unreachable`).
It is harmless but the comment implies a meaningful distinction that does not exist in the code.

**Fix:** Drop the `TypeError` branch, or give it a distinct kind if one is ever warranted; keep the comment in
sync.

### IN-03: `STATUS_SUBLINE` typed as `Record<string, string>` loosens the validated union

**File:** `src/routes/LoadingPage.tsx:53`

**Issue:** The map is typed `Record<string, string>` even though the status domain is the closed
`JobStatus` union. Typing it `Partial<Record<JobStatus, string>>` would let TS catch a typo'd/removed status
key against the schema. Minor type-safety leak given the rest of the phase's tight-union discipline.

**Fix:** `const STATUS_SUBLINE: Partial<Record<JobStatus, string>> = { ... }`.

### IN-04: No test covers the Retry-after-cap or cap-stops-loop behavior

**File:** `src/api/usePollJob.test.tsx`, `src/routes/LoadingPage.test.tsx`

**Issue:** Every poll test mounts a *fresh* hook, so the persistent-`capTripped` defect (CR-01) and the
keep-polling-after-cap defect (CR-02) are structurally invisible to the suite. There is no test that trips the
cap and then re-arms the same hook instance, and none asserting the poll *stops* firing after the cap. Tests
validate the happy lifecycle thoroughly but do not adversarially probe the cap's two failure modes.

**Fix:** Add a `LoadingPage` test that drives a never-terminal poll past an injected tiny cap, clicks Retry,
and asserts the spinner (not the timeout card) returns; and a `usePollJob` test asserting `fetchJobState` call
count stops increasing after the cap trips.

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
