# Phase 5: API Client & Async Polling - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the already-built Configure form to the **real packing API** via the
async **submit-then-poll** lifecycle, and own every state the job can be in:
a user submits a valid configuration → the app `POST`s to `/api/v1/pack` →
polls `GET /api/v1/jobs/{job_id}` → shows an honest **loading screen** while
polling → hands the `done` result to the result route → and **cancels cleanly**
and **distinguishes all four terminal states** without ever crashing.

The seam this replaces is concrete: `ConfigForm.onValid()` today runs
`buildPackRequest(config)` and `console.log`s the `PackRequest` JSON
(Phase 4 D-06). Phase 5 swaps that `console.log` for the real submit→poll,
**keeping the existing disabled-while-invalid Run gate untouched**.

Delivers **PACK-01, PACK-04, PACK-05, PACK-06** (4 requirements).

**Success criteria (from ROADMAP.md):**
1. A valid config `POST`s to `/api/v1/pack` and polls `/api/v1/jobs/{job_id}` until a terminal state.
2. A loading screen shows while polling; reaching `done` advances the user toward the result.
3. A user can cancel an in-progress job and polling stops cleanly — no leaked intervals or in-flight requests on unmount.
4. Job failure, timeout, unreachable/CORS errors, and "some items unpacked" are each distinguished in the UI and none crash the app.

**Scope guardrail — explicitly NOT this phase:**
- The **result page itself** — 3D wiring of *real* data, summary rail, multi-pallet switcher, placement list, unpacked-items panel, CoG marker, support-ratio tinting (RESULT-03/04/05/06, DIAG-01/02) → **Phase 6**. `/result` today still renders the committed fixture; Phase 5 only needs to **hand the real `done` payload to that route** and let it through — it does not build the result UI. "Some items unpacked" routes to `/result` as a success; the unpacked *panel* is Phase 6.
- **Graceful failure-screen polish, JSON/printable export, the Docker image + SPA fallback, GitHub docs, and verifying live CORS from a non-localhost origin** (DATA-01, HOST-01/02/03) → **Phase 7**. Phase 5 *detects and distinguishes* unreachable/CORS errors in the UI; the production CORS allowlist + hardening live in Phase 7.
- The **request-builder, result-mapper, and coordinate mapping** are already built and unit-tested (Phases 2–3) — Phase 5 **consumes** them (`buildPackRequest`, `mapDoneResponse`), it does not touch them.
- The **config form, validation, Run gate, localStorage autosave** are done (Phase 4) — Phase 5 reuses them as-is.

</domain>

<decisions>
## Implementation Decisions

### Locked carry-forward (from prior phases / PROJECT.md / CLAUDE.md — do NOT re-litigate)
- **C-01 (TanStack Query is the engine — do not hand-roll):** `useMutation` for `POST /api/v1/pack`; on success take `job_id` and drive a `useQuery` with `refetchInterval` that returns `false` once `status` is a terminal state (`done`/`failed`/`timeout`), stopping the poll. This is the CLAUDE.md mandate ("use it — do not hand-roll"); no bare `setInterval`/`useEffect` polling. `@tanstack/react-query` (5.101.0) is **not yet installed** — installing + wiring `QueryClientProvider` is part of this phase (likely a supply-chain checkpoint, mirroring Phases 1/4).
- **C-02 (zod at the network boundary — first real use):** Validate the `GET /jobs/{job_id}` response with zod **at the trust boundary** so a malformed/changed API surfaces as a clear handled error, not a render crash. zod (4.4.3) is already a dependency (used by the config form); Phases 2/3 deliberately deferred response validation to here (Phase 3 D-04). The zod response schema mirrors `src/types/pack-contract.ts` (`DoneResponse` + the in-progress/error shapes).
- **C-03 (Run gate is unchanged):** The Run button stays **disabled-while-invalid** exactly as Phase 4 wired it (`isSubmitted && !isValid`, D-04/D-06). On a valid click it still runs `checkAllBoxesFit` → `buildPackRequest(config)`; Phase 5 only changes what happens to the resulting `PackRequest` (submit instead of `console.log`).
- **C-04 (API base URL):** Build-time `VITE_API_URL` (typed in `src/vite-env.d.ts`, currently unconsumed) is the base; the Vite `/api` dev proxy → `https://packerapi.anzozulia.xyz` is the CORS-free local path. **This phase is the first consumer of `VITE_API_URL`** (Phase 1 D-16 established the seam, deferred live use to here).
- **C-05 (carry `idToType` through):** `buildPackRequest(config)` returns `{ request, idToType }`. The `idToType` Map is the **primary** O(1) type-recovery channel for the result-mapper (Phase 3 D-07). Phase 5 must retain `idToType` from submit time and pass it (with the `done` response) into `mapDoneResponse` at the hand-off — do not rebuild it or rely solely on the `typeKeyOf` parse fallback.
- **C-06 (code-split discipline):** The API client / hooks / loading screen must stay **three-free** — they live on or are reachable from the eager `/` chunk (the Configure→loading flow). Only `/result` (lazy) may import three/r3f/drei. `scripts/check-code-split.mjs` is the build gate.

### Loading screen content (discussed)
- **D-01 (honest spinner, no fake progress):** Render the `design/loading.html` look — the **conic "comet" spinner** + the **job-summary card** (`pallet L×W×H · N types · M units · est. K kg`) — but the **sub-line reflects the API's real job status** (e.g. `Queued` → `Packing…`), **not** the mockup's cosmetic cycling flavor text ("Generating candidate placements…", etc.) and **no fake %**. The poll is genuinely indeterminate; be honest about it. Reuse the existing live-total logic for the summary card: **`src/lib/config-tally.ts`** already computes `N types · M units · est. kg` (it backs the Phase 4 FooterBar) — derive the card from the same source, do not recompute.
- **D-02 (Cancel control on the loading screen):** The loading screen carries a single secondary action — a **Cancel** button (the slot the mockup uses for its dev-only "Skip to result"). See D-08 for what Cancel does.

### Loading vs result routing (discussed)
- **D-03 (dedicated `/loading` route):** Add a **third route, `/loading`** (full-page, mockup-faithful). The Run handler navigates to `/loading`, which owns the submit+poll lifecycle; on `done` it **`navigate('/result', { replace: true })`** so the browser **Back button skips the dead spinner** and returns to Configure. Routes become `/` (eager) · `/loading` (eager, three-free) · `/result` (lazy, three-only). This matches the mockup's three separate pages and keeps the loading screen out of the three chunk.
- **D-04 (leaving `/loading` aborts cleanly):** Navigating away from `/loading` — via **Cancel**, the **browser Back button**, or unmount — **aborts the in-flight `POST` (AbortController) and stops the poll** with no leaked intervals/requests (SC-3). TanStack Query's `enabled`/cancellation + an `AbortSignal` on the fetch is the intended mechanism.

### Result hand-off & refresh (discussed)
- **D-05 (in-memory hand-off, ephemeral result):** The `done` payload is kept **in memory only** — the **TanStack Query cache keyed by `job_id`** is the carrier (plus the retained `idToType`, C-05). `/result` reads the latest result from that in-memory source. **No result is persisted to localStorage** — the result is **ephemeral by design**, consistent with "no login, no stored history" (PROJECT.md). (Contrast: the *config* IS autosaved to localStorage — that stays; only the *result* is ephemeral.)
- **D-06 (refresh / deep-link `/result` with no job → redirect to Configure):** A hard refresh or deep-link to `/result` when there is no result in memory **redirects to Configure (`/`)**. (A "no result yet — run a job" empty state is an acceptable equivalent — planner's call; redirect is the simpler default.) ⚠ Phase 6 note: Phase 6's `/result` must read the **real in-memory result** instead of the committed fixture import it uses today, and handle the no-result case per this decision.

### Failure & partial-success UX (discussed)
- **D-07 (distinct error card on the loading screen + Retry/Back):** The four terminal states are distinguished on the **`/loading` screen** (it transforms the spinner into an error card — no separate error route this phase):
  - **`failed`** (server completed the job as failed) — solver/job error message from the response.
  - **`timeout`** (server's own terminal `timeout` state; the baked `time_budget_s` is 25 — Phase 3 D-03) — distinct "the solver ran out of time" message.
  - **unreachable / CORS / network** (the `POST` or a poll throws — DNS, connection refused, CORS rejection, non-2xx) — distinct "couldn't reach the packing service" message. ⚠ Researcher: a browser CORS failure is opaque (a generic `TypeError: Failed to fetch`) — detect it as the network/unreachable bucket; don't try to read a status code.
  - **"some items unpacked"** — this is a **`done` response, i.e. SUCCESS**, not an error: navigate to `/result` (the unpacked-items panel is Phase 6). Do not block or error on a populated `result.unpacked_items[]`.
  Each error card offers **Retry** = **re-`POST` the same already-built `PackRequest`** (no need to bounce back through the form) and **Back to config** = return to `/` with the form/draft intact.
- **D-08 (Cancel returns to Configure intact):** Cancel (D-02) aborts the job (D-04) and returns to **Configure (`/`)** with the form and its autosaved draft **intact** (the form is never unmounted destructively / the draft persists via the Phase 4 autosave). No confirmation dialog — cancel is cheap and reversible (just press Run again).

### Claude's Discretion (locked defaults for downstream agents — user opted not to micromanage these)
- **D-09 (polling cadence + client safety cap):** Poll `/api/v1/jobs/{job_id}` on a **fixed ~1s interval** (`refetchInterval` until terminal, C-01). Because the server has its own `time_budget_s` (25s) **and** its own `timeout` terminal state, add a **generous client-side safety cap (~60–90s)** so a job that is stuck/`queued` forever (or the server never returns a terminal status) surfaces as an error (treat as the timeout/unreachable bucket) rather than spinning indefinitely. Exact interval/cap are tunable named constants; planner confirms against observed API latency.
- **D-10 (no pre-flight health check):** Do **not** add a `GET /api/v1/health` pre-check before submit — the `POST` error path (D-07 unreachable bucket) already covers an unreachable API. (`/health` and `/version` exist but are out of scope for v1 unless a researcher finds a concrete need.)
- **D-11 (client structure):** Put the typed fetch client + the submit/poll hooks under a new **`src/api/`** directory (Phase 1 signposted the `lib → api → features` inside-out ordering; `src/api/` does not exist yet). Keep raw fetch/IO in the client module and the zod-validated, react-query-shaped hooks layered on top; keep all of it three-free (C-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase goal, requirements & scope
- `.planning/ROADMAP.md` §"Phase 5: API Client & Async Polling" — the goal and the **4 success criteria** this phase is measured against.
- `.planning/REQUIREMENTS.md` — the 4 phase requirements: **PACK-01** (submit to run a calc), **PACK-04** (loading state + poll to terminal), **PACK-05** (cancel an in-progress job, polling stops cleanly), **PACK-06** (distinguish failure / timeout / unreachable-CORS / some-unpacked, none crash).
- `.planning/PROJECT.md` — the **API context** (the async job model + endpoint list, lines ~49), constraints (build-time `VITE_API_URL` + the CORS consequence, no backend / stateless, mm-kg units), and the **Key Decisions** table ("Async submit-then-poll integration with the pack API" — pending → realized here).

### The live API (the integration target)
- `https://packerapi.anzozulia.xyz` — async job model: **`POST /api/v1/pack`** → `202 { job_id, status:"queued" }`, then poll **`GET /api/v1/jobs/{job_id}`** until `done` / `failed` / `timeout`. Also `GET /api/v1/health`, `GET /api/v1/version`. Author-controlled API; the Vite `/api` dev proxy reaches it CORS-free for local dev. ⚠ **Researcher must confirm the actual `GET /jobs/{id}` response shapes for the NON-`done` states** (`queued`/`processing`/`failed`/`timeout`) — the committed fixture (`pack-done-response.json`) only captured the `done` shape; the zod boundary schema (C-02) and the status-machine need the in-progress + error shapes too. Also confirm whether a **cancel/DELETE** endpoint exists (the listed endpoints suggest **client-side-only cancel**, D-08).

### The Run seam this phase replaces (most important)
- `src/features/config/ConfigForm.tsx` — the **Run handler** (`onValid()` lines ~77–88) currently does `checkAllBoxesFit` → `buildPackRequest(config)` → `console.log`. **Phase 5 replaces the `console.log` with submit→poll** and the `runDisabled` gate stays (C-03). This is the single most important file to read.
- `src/router.tsx` — the route table: `/` (eager `ConfigurePage`) + `/result` (lazy, three-isolated). **Add `/loading`** here (D-03), eager + three-free.
- `src/routes/ResultPage.tsx` — currently imports and renders the **committed fixture** (`pack-done-response.json`). Phase 5 hands a *real* `done` payload to this route via the in-memory carrier (D-05); ⚠ **Phase 6** swaps the fixture import for the real result + the no-result handling (D-06). Read to understand the hand-off target shape.
- `design/loading.html` — the loading-screen **visual north star** (comet spinner CSS, job-summary card markup, secondary action slot). Port the look per **D-01** (honest status sub-line, real summary, no fake %); the "Skip to result" button is a mockup dev-shortcut → becomes **Cancel** (D-02). `:root` light tokens here already match the ported config palette.

### The data contracts (builder OUTPUT / poller INPUT / mapper INPUT)
- `src/types/pack-contract.ts` — **`PackRequest`** (the submit body) + **`DoneResponse` / `DoneResult` / `PalletResult` / `PlacementOut` / `UnpackedItem` / `InputSummary` / `Orientation` / `Cog`** (the response contract). The **zod boundary schema (C-02) mirrors these**. Note `status` is currently typed `string` — the zod schema should tighten it to the real status union.
- `src/lib/request-builder.ts` → **`buildPackRequest(config)` returns `{ request, idToType }`** — the Run handler already calls this; retain `idToType` through submit→done (C-05).
- `src/lib/result-mapper.ts` → **`mapDoneResponse(...)`** — consumes the `done` response (+ `idToType`) and produces the grouped view model Phase 6 renders. Phase 5 wires its input; Phase 6 renders its output.
- `src/lib/__fixtures__/pack-request.json` + `pack-done-response.json` — the **real captured request/response pair** — the corpus for the zod schema + the client's unit/MSW tests (multi-pallet, 7 unpacked, 3 types D/T/F).
- `src/lib/config-tally.ts` — the existing `N types · M units · est. kg` tally (backs the FooterBar) — **reuse for the loading-screen summary card** (D-01).

### Stack, env seam & prior-phase decisions
- `CLAUDE.md` — the locked stack + versions (esp. **@tanstack/react-query 5.101.0** — install here, the "Async Polling Pattern (TanStack Query)" section, the `useMutation` + `refetchInterval`-returning-`false` guidance; **zod 4.4.3** at the boundary; **react-router 7** library mode; the "don't hand-roll polling" and code-split rules; **MSW/Playwright route-interception** for deterministic async-flow tests).
- `vite.config.ts` — the **`/api` dev proxy** to `packerapi.anzozulia.xyz` (the CORS-free local path) and the `import.meta.env.VITE_API_URL` build-time bake comment (C-04).
- `src/vite-env.d.ts` — the typed **`VITE_API_URL`** seam (line 4) — Phase 5 is its **first consumer**.
- `.planning/phases/04-config-form-local-persistence/04-CONTEXT.md` — **D-06** (the Run = build-to-console seam Phase 5 replaces, with the disabled-when-invalid gate), **D-08** (⚠ the `maxLoad`/`fragile` are persisted-but-unsent decision + the **flag to confirm against the live OpenAPI** whether the API accepts per-box `max_load`/`fragile`, or whether `fragile` should map to `this_side_up` — resolve here, wire into the request-builder only if the API supports it), and the eager-`/`-chunk three-free rule (C-05/C-06 here).
- `.planning/phases/03-pure-transform-core/03-CONTEXT.md` — **D-03** (baked options `time_budget_s=25` / `seed=7` / `support_ratio=0.8`; the 25s budget informs the client timeout cap D-09), **D-04** (zod reserved for *this* phase), **D-07** (the `idToType` primary / `typeKeyOf` fallback recovery — C-05).
- `.planning/phases/01-scaffolding-version-lock/01-CONTEXT.md` — the signposted `lib → api → features` ordering (`src/api/` lands here, D-11), the `React.lazy` `/result` code-split + `scripts/check-code-split.mjs` gate (C-06), and the build-time-`VITE_API_URL`/runtime-envsubst-deferred-to-Phase-7 note (D-16).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/features/config/ConfigForm.tsx` → `onValid()`** — the exact insertion point; swap `console.log` for the submit→navigate-to-`/loading` flow, keep the `runDisabled` gate (C-03/D-03).
- **`src/lib/request-builder.ts` → `buildPackRequest`** — already unit-tested; returns `{ request, idToType }` (C-05). No changes needed unless the D-08 OpenAPI check adds `max_load`/`fragile`.
- **`src/lib/result-mapper.ts` → `mapDoneResponse`** — already unit-tested; the hand-off feeds it the real `done` response + `idToType`.
- **`src/lib/config-tally.ts`** — the live `types · units · est. kg` tally → the loading-screen summary card (D-01), no recompute.
- **`src/types/pack-contract.ts`** — `PackRequest` + `DoneResponse` etc. → the zod boundary schema mirrors these (C-02).
- **`src/lib/__fixtures__/*.json`** — real request/response pair for zod + async-flow tests.
- **`src/styles.css`** — Tailwind v4 `@theme`; the light loading-screen tokens largely overlap the already-ported config palette (the loading mockup reuses `--accent #4f46e5`, surfaces, mono font) — port any missing token rather than inline hex.
- **`src/components/`** — shared primitives (Card, etc.) exist for the summary card / error card chrome.

### Established Patterns
- **Code-split gate** (`scripts/check-code-split.mjs`): the new `/loading` route + `src/api/` + hooks must stay **three-free** — they sit on the eager Configure→loading path (C-06).
- **Supply-chain checkpoint convention** (Phases 1/4 `T-*-SC`): installing `@tanstack/react-query` likely gets a human-approved pinned-install gate before dependent waves build (C-01).
- **Pure logic in `src/lib/` + co-located Vitest** — the zod schema parse + any status-machine helpers are pure/jsdom-testable; the **network + react-query hooks are tested with route interception (MSW / Playwright)** per CLAUDE.md, NOT against the live API.
- **Testing split**: jsdom for logic + hook behavior (mocked transport); Playwright preview-build for the real Configure→loading→result flow against a **stubbed** API (deterministic async/poll/cancel/error paths) — never the live service in CI.

### Integration Points
- **Form → API**: `ConfigForm` Run → `buildPackRequest` → `POST /api/v1/pack` → navigate `/loading` (the Phase-4/5 seam: same `PackRequest`, real network now).
- **Poll → `/result`**: `/loading` polls to `done` → in-memory hand-off (Query cache keyed by `job_id` + `idToType`) → `navigate('/result', {replace:true})` (the Phase-5/6 seam).
- **`QueryClientProvider`** wraps the app (likely in `src/main.tsx` / above the router) — new top-level provider introduced this phase.
- **`src/api/`** (does not exist) — first tenant: the typed client + submit/poll hooks (D-11).

</code_context>

<specifics>
## Specific Ideas

- **Honest over pretty on the loading screen** — keep the mockup's comet spinner and summary card, but drop the fake cycling flavor text in favor of the real `status` (D-01). The poll is indeterminate; say so.
- **`/loading` is a real route, not an overlay** (D-03) — full page, mockup-faithful, and Back skips it via `replace` navigation.
- **The result is ephemeral** (D-05/D-06) — in-memory only, refresh of `/result` redirects to Configure. This is a deliberate match to "no stored history," and a Phase 6 contract note (Phase 6 reads the real in-memory result, not the fixture).
- **"Some items unpacked" is success, not failure** — the single most common misread of SC-4; it routes straight to `/result` (D-07).
- **Retry re-POSTs the built request directly** (D-07) — no bounce through the form; the `PackRequest` is already in hand.
- **Cancel is client-side only and non-destructive** (D-08) — abort + stop polling + return to Configure with the draft intact; almost certainly no server cancel endpoint (researcher confirms).

</specifics>

<deferred>
## Deferred Ideas

- **Real result → 3D viewer wiring, summary rail, multi-pallet switcher, placement list + hover↔mesh highlight, unpacked-items panel, CoG marker, support-ratio tinting** (RESULT-03/04/05/06, DIAG-01/02) → **Phase 6**. Phase 5 hands the `done` payload to `/result`; Phase 6 reads it (replacing the fixture import) and builds the UI.
- **Failure-screen polish, JSON + printable export, the single Docker image + SPA fallback, GitHub self-host docs, and verifying live CORS from a non-localhost serving origin** (DATA-01, HOST-01/02/03) → **Phase 7**. Phase 5 only *detects/distinguishes* the unreachable/CORS bucket.
- **Runtime `VITE_API_URL` override (nginx `envsubst` / `window.__CONFIG__`)** → **Phase 7** (Phase 1 D-16). Phase 5 consumes the build-time value.
- **Sending `maxLoad` / `fragile` to the API** — pending the **D-08 live-OpenAPI confirmation** done in *this* phase's research; wire into `request-builder` only if the API accepts them (else they stay persisted-but-unsent).
- **Standard pallet presets, duplicate-box-type, CSV import/export, share-config-via-URL, 2D layer view, PNG snapshot, true PDF** (v2: CFG-V2-*, RES-V2-*, SHR-V2-01) — not this phase.

None of the above are scope creep into Phase 5 — they are correctly-placed later work.

</deferred>

---

*Phase: 5-API Client & Async Polling*
*Context gathered: 2026-06-04*
</content>
</invoke>
