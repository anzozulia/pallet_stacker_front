---
status: partial
phase: 04-config-form-local-persistence
source: [04-VERIFICATION.md]
started: 2026-06-04T22:30:00Z
updated: 2026-06-04T22:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Pallet and box field error display
expected: Clearing a required field (or entering 0) and clicking Run shows an inline error next to the field ("Required" / "Must be > 0"); empty catalog shows "Add at least one box type"; Run is blocked after the first failed submit.
result: [pending]
note: Covered by the approved 04-07 visual checkpoint (step 6).

### 2. Unfittable box inline error
expected: A box larger than the pallet in all orientations shows an inline error on that row's Dimensions field ("cannot fit the pallet in any allowed orientation") and Run stays blocked.
result: [pending]
note: Covered by the approved 04-07 visual checkpoint (step 6).

### 3. Live running total reactivity
expected: The footer "N box types · M units · est K kg" string and the catalog badge update in real time as quantity/weight change, with no submit.
result: [pending]
note: Covered by the approved 04-07 visual checkpoint.

### 4. Large-job advisory appearance + non-blocking behavior
expected: Pushing total units above 1000 shows a neutral (non-red, text-2 tone) advisory "Large job — N units may take longer to solve and render."; Run stays enabled.
result: [pending]
note: Covered by the approved 04-07 visual checkpoint (step 8).

### 5. localStorage persistence across a real browser tab close
expected: Edit the form, Save draft, fully close the tab, reopen `/` — all edited pallet fields and box values are restored intact (no blank/defaulted fields).
result: [pending]
note: Reload-restore was verified live + by the Playwright E2E; full tab-close (vs reload) was NOT explicitly exercised during the checkpoint.

### 6. Fragile toggle interactive stash/restore
expected: Fragile ON disables + zeroes Max load; Fragile OFF re-enables Max load and restores the prior non-zero value.
result: [pending]
note: Covered by the approved 04-07 visual checkpoint (step 3).

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
