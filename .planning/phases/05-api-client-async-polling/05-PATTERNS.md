# Phase 5: API Client & Async Polling - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 15 (new + modified)
**Analogs found:** 13 / 15 (2 have no direct in-repo analog — react-query is brand new)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/api/client.ts` (NEW) | service (fetch client) | request-response | `src/lib/request-builder.ts` (pure module + header convention) | role-match (no fetch analog exists) |
| `src/api/pack-schema.ts` (NEW) | model (zod boundary) | transform/validate | `src/features/config/schema.ts` (only existing zod usage) | exact (role + zod) |
| `src/api/errors.ts` (NEW) | utility (error taxonomy) | transform | `src/lib/config-tally.ts` (pure constants + typed helper) | role-match |
| `src/api/useSubmitJob.ts` (NEW) | hook (mutation) | request-response | `src/hooks/useLocalStorageAutosave.ts` (only existing hook) | partial (hook shape; no react-query analog) |
| `src/api/usePollJob.ts` (NEW) | hook (query+poll) | event-driven (poll) | `src/hooks/useLocalStorageAutosave.ts` | partial (no react-query analog) |
| `src/routes/LoadingPage.tsx` (NEW) | route (page) | event-driven | `src/routes/ResultPage.tsx` + `src/routes/ConfigurePage.tsx` | role-match (page shell, NO three) |
| `src/router.tsx` (MODIFY) | route table | — | self (existing entries) | exact |
| `src/main.tsx` (MODIFY) | provider wiring | — | self (existing RouterProvider) | exact |
| `src/features/config/ConfigForm.tsx` (MODIFY `onValid`) | feature (the seam) | request-response | self (lines 77–95) | exact |
| `src/api/pack-schema.test.ts` (NEW) | test (pure) | — | `src/lib/request-builder.test.ts` / `src/features/config/schema.test.ts` | exact |
| `src/api/useSubmitJob.test.tsx` / `usePollJob.test.tsx` (NEW) | test (hook+MSW) | — | `src/components/SegmentedControl.test.tsx` (RTL shape) + new `renderWithClient` | role-match |
| `src/routes/LoadingPage.test.tsx` (NEW) | test (component+MSW) | — | `src/components/SegmentedControl.test.tsx` | role-match |
| `src/test/msw/{handlers,server}.ts` (NEW) | test infra | — | none (no MSW in repo yet) | NO ANALOG |
| `src/test/setup.ts` (MODIFY) | test infra | — | self (current 3-line file) | exact |
| `e2e/api-poll.spec.ts` (NEW) | test (e2e) | — | `e2e/config-persist.spec.ts` | exact |

## Pattern Assignments

### `src/api/pack-schema.ts` (model, zod boundary) — C-02

**Analog:** `src/features/config/schema.ts` (the ONLY existing zod usage; copy its style)

**Module-header + import convention** (schema.ts lines 1–15): every module opens with a multi-line `//` header stating responsibility, the decision IDs it satisfies, and — critically — a **code-split/IO statement** ("imports nothing at runtime beyond zod; no three/React/IO"). Replicate this header verbatim in style for every new `src/api/*` file (C-06 is asserted by convention in the header, then enforced by the build gate).

**zod import + schema-export pattern** (schema.ts lines 14, 34, 48–62, 69–79):
```typescript
import { z } from 'zod';
import type { PackConfig } from '@/types/config';

const rotation = z.enum(['free', 'uprightOnly', 'fixed']);   // closed unions as z.enum

export const packConfigSubmitSchema = z.object({ /* ... */ })
  satisfies z.ZodType<PackConfig>;   // <-- compile-time proof output ⊇ the hand-written type
```
**Apply this `satisfies z.ZodType<...>` discipline** to `jobStateSchema` against the `DoneResponse`/contract types in `src/types/pack-contract.ts` (C-02 says the schema mirrors these). Note the RESEARCH guidance (Pitfall 5): use **non-strict** `z.object` (zod 4 ignores unknown keys by default) — do NOT `.strict()`; only tighten `status` to the known union `z.enum(['queued','running','done','failed','timeout'])`. Exact schema bodies are in RESEARCH.md "Code Examples → The zod network boundary".

**Contract types to mirror:** `src/types/pack-contract.ts` — `DoneResponse` (`{ job_id, status, result }`), `DoneResult`, `PalletResult`, `PlacementOut`, `UnpackedItem`, `InputSummary`. Note `status` is typed `string` there (line 136) — the zod schema tightens it.

---

### `src/api/client.ts` / `errors.ts` (service/utility) — D-11

**Analog:** `src/lib/request-builder.ts` + `src/lib/config-tally.ts` (pure-module conventions)

**Named-constant convention** (config-tally.ts lines 10–15): tunables are single exported named constants with a doc comment referencing the decision. Apply to `POLL_MS`, the `~120–140s` safety cap (D-09 / Pitfall 1), and the `BASE`-URL resolution:
```typescript
export const LARGE_UNIT_THRESHOLD = 1000;  // analog: name + decision-ref + doc comment
```
**Base-URL resolution** (RESEARCH "Code Examples → Base-URL resolution"): `const BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL;` — `VITE_API_URL` is typed in `src/vite-env.d.ts` (line 4), this phase is its first consumer (C-04). Client owns the `/api/v1/...` suffix (Open Question 1 → lock origin).

**Error taxonomy** (`errors.ts`): a `PackError` class + `classifyFetchError()` bucketing `AbortError`→`aborted`, `TypeError`→`unreachable` (opaque CORS), `ZodError`→`contract-drift`. Full source in RESEARCH "Pattern 3". No in-repo class-based error analog exists; follow the pure-module header + named-export style of `src/lib/*`.

---

### `src/api/useSubmitJob.ts` / `usePollJob.ts` (hooks) — C-01

**Analog (shape only):** `src/hooks/useLocalStorageAutosave.ts` — the only existing custom hook (named export, returns an object e.g. `{ flushSave }`). react-query itself has **no analog** — follow RESEARCH "Pattern 1" (`useQuery` + `refetchInterval`-returning-`false` on terminal) and "Pattern 2" (AbortSignal into `queryFn`) verbatim; these are the authoritative templates. Key settings from RESEARCH: `enabled: !!jobId`, `retry: false`, `gcTime: Infinity` (Pitfall 4 — keeps the `done` payload for the `/result` hand-off, D-05), v5 single-arg `refetchInterval: (query) => isTerminal(query.state.data?.status) ? false : POLL_MS`.

---

### `src/routes/LoadingPage.tsx` (route page, three-FREE) — D-01/D-03

**Analog:** `src/routes/ConfigurePage.tsx` (three-free eager page, header comment asserts the code-split rule) + `src/routes/ResultPage.tsx` (default-export page component shape — but do NOT copy its three/Canvas imports).

**Page-component shape** (ResultPage.tsx line 23): `export default function LoadingPage()`. **CRITICAL inversion of the ResultPage analog:** ResultPage imports `@react-three/fiber`/`three`/`@/components/viewer/*` (lines 11–16) — `LoadingPage` must import NONE of these (C-06). Open the file with a header in the ConfigurePage.tsx style (lines 1–3) explicitly stating "three-free, eager `/loading` chunk".

**Summary card from the existing tally** (D-01): import `tallyCatalog` from `@/lib/config-tally` (lines 31–46) — `{ types, units, estKg }` — do NOT recompute. RESEARCH "Code Examples → Loading-screen summary card" has the exact cell mapping.

**Card chrome primitive:** `src/components/Card.tsx` exists (`<Card title desc badge>`, imports only React + clsx) for the summary/error-card shells.

**Tailwind tokens (no inline hex):** `src/styles.css` `@theme` exposes `--color-accent` (#4f46e5), `--color-d-bg`, `--color-danger`, `--color-text`/`-2`/`-3`, `--color-surface`, `--radius`/`-lg`, `--font-mono`. Reference via Tailwind utilities (`text-accent`, `bg-surface`, `rounded-[var(--radius-lg)]`) exactly as ConfigForm.tsx (lines 99–137) and Card.tsx (line 23) do — port any missing `design/loading.html` token into `@theme` rather than inlining hex.

---

### `src/router.tsx` (MODIFY) — D-03 + C-06

**Analog:** self (lines 1–19). The split is the template: `/` is **eager** (`import ConfigurePage from '@/routes/ConfigurePage'`, line 3), `/result` is **lazy** (`lazy(() => import('@/routes/ResultPage'))`, line 7) so three lands only in its chunk. Add `/loading` **like `/`** — a static top-of-file `import LoadingPage from '@/routes/LoadingPage'` and a plain `{ path: '/loading', element: <LoadingPage /> }` entry (NO `lazy`, NO `Suspense`). The existing lazy `/result` keeps its `<Suspense fallback>` wrapper untouched.

---

### `src/main.tsx` (MODIFY) — QueryClientProvider

**Analog:** self (lines 1–11). Wrap the existing `<RouterProvider router={router} />` (line 9) in `<QueryClientProvider client={queryClient}>`, inside `<StrictMode>`. Create the `QueryClient` at module scope (single app-wide instance). This is the new top-level provider for this phase.

---

### `src/features/config/ConfigForm.tsx` `onValid()` (MODIFY) — C-03/D-03

**Analog:** self — the exact seam is **lines 77–88** (`onValid`) and the gate **line 95** (`runDisabled = isSubmitted && !isValid`).

```typescript
function onValid(config: PackConfig) {
  const fit = checkAllBoxesFit(config);
  if (!fit.ok) { /* setError per failure, return — KEEP this */ return; }
  const { request } = buildPackRequest(config);
  console.log('[Phase 4 Run] PackRequest:', ...);   // <-- REPLACE ONLY this line
}
```
**Replace only the `console.log` (line 87)** with `navigate('/loading', { state: { request, idToType } })`. Note `buildPackRequest` returns `{ request, idToType }` (line 86 currently destructures only `request`) — **also retain `idToType`** for the hand-off (C-05). Keep the `checkAllBoxesFit` gate, the `setError` mapping, and `runDisabled` (line 95) exactly as-is (C-03). `useNavigate` imports from `react-router` (same package as router.tsx line 2).

## Shared Patterns

### Module header + code-split self-assertion
**Source:** every `src/lib/*` and `src/features/config/schema.ts` (e.g. config-tally.ts lines 1–6, schema.ts lines 1–15)
**Apply to:** every new `src/api/*` and `src/routes/LoadingPage.tsx`
Each module opens with a `//` block: responsibility, decision IDs, and an explicit "imports NOTHING runtime / three-free" line. This is the human-readable half of C-06; `scripts/check-code-split.mjs` is the machine half.

### Code-split build gate
**Source:** `scripts/check-code-split.mjs` (markers `BufferGeometry`, `WebGLRenderer`; asserts three is ABSENT from `index-*` entry chunk, PRESENT in a lazy chunk)
**Apply to:** all `src/api/*`, the hooks, and `/loading` — they sit on the eager entry chunk; importing three/r3f/drei or any `@/components/viewer/*` or `@/routes/ResultPage` from them fails the gate.

### zod at the boundary
**Source:** `src/features/config/schema.ts` (z.enum for closed unions, `satisfies z.ZodType<T>`, non-strict objects)
**Apply to:** `src/api/pack-schema.ts` — first runtime use at the network boundary (C-02).

### Pure-logic test (jsdom, no WebGL)
**Source:** `src/lib/request-builder.test.ts` (lines 1–8) — `import { describe, expect, it } from 'vitest'`, fixture JSON via `@/lib/__fixtures__/*.json`, header note "stays jsdom-WebGL-free".
**Apply to:** `src/api/pack-schema.test.ts` (feed it `pack-done-response.json`).

### RTL component test
**Source:** `src/components/SegmentedControl.test.tsx` (lines 1–9) — `render`/`screen` from `@testing-library/react`, `userEvent`, `vi.fn()`, role-based queries.
**Apply to:** `LoadingPage.test.tsx`, hook tests — wrapped in the new `renderWithClient` (fresh `QueryClient` per test, `retry:false`, `gcTime:0`; RESEARCH Wave-0 gap).

### Playwright e2e with route interception
**Source:** `e2e/config-persist.spec.ts` (console-error collector lines 10–13; `page.goto('/')`; locator/role assertions). It does NOT stub network (none existed). 
**Apply to:** `e2e/api-poll.spec.ts` — same skeleton PLUS `page.route('**/api/v1/**', ...)` to stub the poll sequence (queued→running→done, →failed, →timeout, network-throw) deterministically. Reuse the console-error collector + `expect(errors).toHaveLength(0)` pattern.

### MSW node setup (NEW — no analog)
**Source:** none in repo. `src/test/setup.ts` is currently 3 lines (only `@testing-library/jest-dom/vitest`).
**Apply to:** EXTEND `src/test/setup.ts` with MSW `beforeAll(server.listen({onUnhandledRequest:'error'}))/afterEach(resetHandlers)/afterAll(close)` (RESEARCH Pitfall 6). New `src/test/msw/{handlers,server}.ts` use MSW 2 API (`http.get`/`HttpResponse.json`, `setupServer` from `msw/node`).

## No Analog Found

| File | Role | Data Flow | Reason | Planner uses |
|------|------|-----------|--------|--------------|
| `src/api/useSubmitJob.ts` / `usePollJob.ts` | react-query hooks | request-response / poll | No react-query usage exists yet (first install this phase) | RESEARCH Patterns 1–2 verbatim |
| `src/test/msw/{handlers,server}.ts` | MSW test infra | — | No MSW in repo; `setup.ts` has no server lifecycle | RESEARCH "Code Examples" + Pitfall 6 |

## Metadata

**Analog search scope:** `src/api/`, `src/lib/`, `src/hooks/`, `src/routes/`, `src/features/config/`, `src/components/`, `src/types/`, `src/test/`, `e2e/`, `scripts/`
**Files scanned:** 14 read in full/part (router, main, ResultPage, ConfigurePage, ConfigForm, schema, config-tally, request-builder.test, SegmentedControl.test, pack-contract, Card, test/setup, config-persist e2e, check-code-split)
**Pattern extraction date:** 2026-06-04
```