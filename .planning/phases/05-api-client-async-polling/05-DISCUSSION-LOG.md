# Phase 5: API Client & Async Polling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 5-API Client & Async Polling
**Areas discussed:** Loading screen content, Loading vs result routing, Result hand-off & refresh, Failure & partial-success UX

---

## Area selection

| Area | Description | Selected |
|------|-------------|----------|
| Loading screen content | Indeterminate spinner vs real status/elapsed; cosmetic cycling lines; job-summary card; Cancel placement | ✓ |
| Loading vs result routing | Dedicated /loading route vs overlay on Configure; Back-button behavior | ✓ |
| Result hand-off & refresh | How the done payload reaches /result; refresh/deep-link behavior; ephemeral vs persisted | ✓ |
| Failure & partial-success UX | Distinguishing failure/timeout/unreachable-CORS/some-unpacked; Retry; Cancel destination | ✓ |

**User's choice:** All four areas selected for discussion.

---

## Loading screen content

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner + honest status + summary | Faithful comet spinner + job-summary card (pallet · N types · M units · est. kg), sub-line shows real API status (Queued → Packing…), no fake % | ✓ |
| Mockup as-is (cosmetic cycling) | Faithful port incl. the rotating flavor lines not tied to real status | |
| Minimal spinner only | Spinner + "Packing…" + Cancel; drop the summary card and flavor text | |

**User's choice:** Spinner + honest status + summary.
**Notes:** Reuse `src/lib/config-tally.ts` (already backs the FooterBar) for the summary card; the mockup's "Skip to result" slot becomes the Cancel control. → CONTEXT D-01/D-02.

---

## Loading vs result routing

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /loading → /result | Full-page /loading route; on done, replace-navigate to /result so Back skips the spinner. Three routes total. | ✓ |
| Overlay on Configure | Loading is a full-screen overlay over the form (URL stays /); navigate to /result on done | |
| You decide | Defer to planning | |

**User's choice:** Dedicated /loading → /result.
**Notes:** Leaving /loading (Cancel / Back / unmount) aborts the in-flight POST + stops polling cleanly (SC-3); /loading stays three-free (eager chunk). → CONTEXT D-03/D-04.

---

## Result hand-off & refresh

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory + redirect on refresh | done payload kept in the TanStack Query cache (keyed by job_id); refresh/deep-link /result with nothing in memory → redirect to Configure. Result is ephemeral. | ✓ |
| Persist last result to localStorage | Cache the last done response locally so /result rehydrates after refresh | |
| You decide | Defer to planning | |

**User's choice:** In-memory + redirect on refresh.
**Notes:** Matches "no login, no stored history" — only the *config* is persisted, the *result* is ephemeral. Phase 6 must read the real in-memory result (not the fixture) and handle the no-result case. → CONTEXT D-05/D-06.

---

## Failure & partial-success UX

| Option | Description | Selected |
|--------|-------------|----------|
| Error card on loading + Retry/Back | failure/timeout/unreachable-CORS each distinct on the loading screen; Retry re-POSTs the same request; "some unpacked" = success → /result; Cancel → Configure intact | ✓ |
| Toast/banner on Configure | Errors surface as a dismissible banner on the form; Retry = press Run again | |
| You decide | Defer to planning | |

**User's choice:** Error card on loading + Retry/Back.
**Notes:** "Some items unpacked" is a `done` SUCCESS (route to /result; unpacked panel is Phase 6), not an error. Retry re-POSTs the already-built PackRequest without bouncing through the form. → CONTEXT D-07/D-08.

---

## Claude's Discretion

User accepted these as locked discretion defaults (technical/safety, not vision):
- **Polling cadence + client safety cap** (D-09): ~1s `refetchInterval` until terminal; ~60–90s client-side cap over the server's 25s `time_budget_s` + `timeout` state so a stuck job surfaces as an error.
- **No pre-flight health check** (D-10): the POST error path covers unreachable; `/health` `/version` stay out of scope.
- **Client structure** (D-11): typed fetch client + submit/poll hooks under a new `src/api/`, three-free.

Research flags handed to the researcher (not user decisions):
- Confirm the real `GET /jobs/{id}` response shapes for non-`done` states (queued/processing/failed/timeout) — the fixture only captured `done`.
- Confirm whether a cancel/DELETE endpoint exists (listed endpoints suggest client-side-only cancel).
- Resolve the Phase-4 D-08 OpenAPI question: does the API accept per-box `max_load`/`fragile` (or `fragile`→`this_side_up`)? Wire into the request-builder only if yes.

## Deferred Ideas

- Real result → 3D viewer wiring, summary rail, multi-pallet switcher, placement list, unpacked panel, CoG/support diagnostics → Phase 6.
- Failure-screen polish, JSON/printable export, Docker image + SPA fallback, GitHub docs, live-CORS verification → Phase 7.
- Runtime `VITE_API_URL` override (envsubst / window.__CONFIG__) → Phase 7.
- Sending `maxLoad`/`fragile` → pending this phase's OpenAPI confirmation.
- v2: pallet presets, duplicate-box-type, CSV import/export, share-via-URL, 2D layer view, PNG/PDF export.
</content>
