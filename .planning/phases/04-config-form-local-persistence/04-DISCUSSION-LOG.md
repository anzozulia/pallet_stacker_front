# Phase 4: Config Form & Local Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 4-Config Form & Local Persistence
**Areas discussed:** Validation & warnings, Page shell & Run seam

---

## Gray-area menu (which areas to discuss)

| Option | Description | Selected |
|--------|-------------|----------|
| Persistence model | Auto-save vs explicit "Save draft"; restore timing; single vs named drafts; schema versioning | |
| Box model gaps | Locked BoxType lacks max-load / fragile / display name, and the captured API request carries none — extend model, decide persist-only vs send | |
| Validation & warnings | What's invalid (incl. box-fits-pallet); when errors show; what they block; the BOX-05 large-count warning threshold | ✓ |
| Page shell & Run seam | How much mockup chrome to build now; what "Run packing" does with no API yet | ✓ |

**User's choice:** Validation & warnings + Page shell & Run seam. Persistence model and Box model gaps deferred to Claude's discretion ("resolve the rest with sensible defaults").

---

## Validation & warnings

### Box-fits-pallet cross-check

| Option | Description | Selected |
|--------|-------------|----------|
| Soft warning | Flag too-big box but allow submit; solver is authoritative (returns unpacked-with-reason) | |
| Hard block | Block submit if a box can't fit in any allowed orientation | ✓ |
| No cross-check | Per-field validation only; let the solver decide fit | |

**User's choice:** Hard block.
**Notes:** Captured as a *conservative* check (respects rotation mode + max-overhang + max stack height; rejects only genuinely-impossible boxes) to avoid duplicating solver logic / false rejections.

### Large-unit-count warning (BOX-05)

| Option | Description | Selected |
|--------|-------------|----------|
| > 500, non-blocking | Soft heads-up above ~500 units | |
| > 1000, non-blocking | Only nudge on extreme catalogs | ✓ |
| I'll set the number | User specifies threshold/blocking | |

**User's choice:** > 1000 units, non-blocking.

### Error timing & what's blocked

| Option | Description | Selected |
|--------|-------------|----------|
| On submit, then live | RHF onSubmit + reValidate onChange; block Run only; persistence keeps WIP | ✓ |
| On blur | Validate per field on leave; block Run only | |
| On change (live) | Validate from first keystroke; block Run only | |

**User's choice:** On submit, then live.
**Notes:** Persistence always captures work-in-progress even when invalid — validation gates only the Run/submit action.

---

## Page shell & Run seam

### Chrome scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full shell | Topbar + Configure/Result step nav + two cards + sticky footer (running total + Run) | ✓ |
| Cards + footer, no topbar | Cards + sticky footer/total; skip topbar until result flow exists | |
| Forms-only | Two cards + inline total; no topbar/footer | |

**User's choice:** Full shell.

### "Run packing" behaviour with no API yet

| Option | Description | Selected |
|--------|-------------|----------|
| Present, disabled-when-invalid | Button exists, inert placeholder when valid; Phase 5 wires submit | |
| Present + build request to console | Disabled-when-invalid; valid click runs buildPackRequest and logs the PackRequest JSON (no network) | ✓ |
| Omit until Phase 5 | No Run button this phase | |

**User's choice:** Present + build request to console.
**Notes:** Proves the form→request-builder seam end-to-end as a demonstrable Phase 4 deliverable; Phase 5 swaps the console output for the real submit→poll behind the same disabled-when-invalid gate.

---

## Claude's Discretion

User opted to let Claude resolve these with mockup-grounded defaults (presented and approved before writing CONTEXT.md):

- **Persistence model (DATA-02):** auto-save (debounced ~400ms) to a single `palletize:config:v1` slot + restore on load; footer "Save draft" = explicit save + "Saved ✓"; `{version, config}` schema with silent discard-and-seed on mismatch. (CONTEXT D-07)
- **Box model gaps (BOX-03):** extend `BoxType` with `label` / `maxLoad` / `fragile`; fragile ON disables+zeros maxLoad; `maxLoad`+`fragile` persisted/displayed but **not sent** in v1 (BoxRequest has no slot) — flagged for Phase 5 OpenAPI confirmation; swatch via `colorForType(id)`. (CONTEXT D-08)
- **Seed defaults & empty state:** EUR-shaped default pallet + one starter box on first load; empty catalog is a valid editing state that blocks Run. (CONTEXT D-09)
- **`maxPallets` placement (PACK-03):** single integer in the pallet/limits group; other options stay baked in the request-builder. (CONTEXT D-10)

## Deferred Ideas

- Standard pallet presets (EUR/GMA) **picker** — CFG-V2-01 (v2; flagged "consider pulling into v1"). D-09 seeds a EUR-shaped default without a picker.
- Duplicate-a-box-type / CSV import-export — CFG-V2-02 / CFG-V2-03 (v2).
- Share config via URL — SHR-V2-01 (v2).
- Sending `maxLoad`/`fragile` to the API — pending Phase 5 OpenAPI confirmation.
- Wiring Run to real submit/poll/loading — Phase 5.
