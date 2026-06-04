---
status: partial
phase: 05-api-client-async-polling
source: [05-VERIFICATION.md]
started: 2026-06-05T01:15:00Z
updated: 2026-06-05T01:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live loading-screen fidelity + honest status
expected: Navigate to /loading with a valid config and submit a real job. The loading screen matches `design/loading.html` (comet spinner + job-summary card), the status sub-line shows a REAL status (Queued → Packing…) with NO fake percentage and NO cycling flavor text, and on `done` the app navigates to /result.
result: [pending]
note: Substantively covered by the human UX sign-off already given during plan 05-04 (loading fidelity + honest status + error/cancel UX). The gap-closure fixes did not change the loading-screen visuals — only the `usePollJob` cap logic. Re-confirm only if desired.

### 2. Retry after a server safety-cap trip (live)
expected: With a slow/stuck job, wait for the client safety cap to trip (~2 min in production), then click Retry — the loading spinner (NOT the timeout card) returns and a fresh job polls successfully. The timeout card must NOT appear immediately on the new job.
result: [pending]
note: This was the CR-01 blocker. It is now covered by an automated `usePollJob` regression test (identity-latch, 50ms injected cap) and confirmed by three independent adversarial verification lenses + a non-triviality proof. Full-duration live confirmation is impractical to automate (the production cap is ~2 min); a one-time manual walkthrough is advisable but optional given the logic-layer proof.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
