---
phase: 04-config-form-local-persistence
plan: 04
subsystem: ui-primitives
tags: [react, tailwind, accessibility, components, code-split]
requires:
  - "src/styles.css light config-form @theme tokens (04-01)"
  - "src/types/config.ts RotationMode union (03-01)"
provides:
  - "src/components/NumberField.tsx — labelled mono input + unit affix + error slot"
  - "src/components/Switch.tsx — accessible role=switch on/off toggle"
  - "src/components/SegmentedControl.tsx — generic 3-mode radio-group control (C-03)"
  - "src/components/Card.tsx — card chrome primitive"
  - "src/components/SectionLabel.tsx — mono section label with accent dot"
affects:
  - "Plan 05 (Box catalog) and Plan 06 (Pallet card) compose these primitives"
tech-stack:
  added: []
  patterns:
    - "Roving tabindex + arrow/Home/End nav for radio-group segmented control"
    - "Controlled role=switch button (no native checkbox) with aria-checked + Space/Enter"
    - "Pass-through input props ({...register}) on NumberField for RHF wiring"
    - "Named layout constants (track sizes, card padding) as inline style / token vars, NOT spacing utilities"
key-files:
  created:
    - src/components/NumberField.tsx
    - src/components/Card.tsx
    - src/components/SectionLabel.tsx
    - src/components/Switch.tsx
    - src/components/SegmentedControl.tsx
    - src/components/Switch.test.tsx
    - src/components/SegmentedControl.test.tsx
  modified: []
decisions:
  - "Switch is a controlled <button role=switch>, not a wrapped native checkbox — single accessible name + aria-checked, toggles on Space/Enter (UI-SPEC §Accessibility)"
  - "SegmentedControl uses roving tabindex (one Tab stop) + arrow-key wrap; selection moves on arrow keys per WAI-ARIA radiogroup pattern"
  - "NumberField spreads pass-through input props (chose spread over forwardRef) since the phase wires via {...register(name)} (plan-directed)"
metrics:
  duration: ~6min
  completed: 2026-06-04
---

# Phase 04 Plan 04: Reusable UI Primitives Summary

Five hand-built, three-free UI primitives — `NumberField`, `Switch`, `SegmentedControl`, `Card`, `SectionLabel` — styled with Tailwind utilities over the light config-form tokens from Plan 01, with the two interactive controls (Switch, SegmentedControl) pinned by accessibility/interaction tests.

## What Was Built

- **`NumberField`** — 600-weight `<label>` (associated via `htmlFor`/`id`), a mono 13px `<input type=number inputMode=numeric>` inside an `input-affix` with an optional mono 12px unit suffix (`mm`/`kg`/`pcs`), an optional hint, and a `--color-danger` 12px `role=alert` error line when `error` is set. Focus-within ring (accent border + 3px `--accent-weak`). Spreads pass-through input props so `{...register(name)}` wires directly; sets `aria-invalid`/`aria-describedby`.
- **`Card`** — `card-head` (600 14px title + `--text-3` desc + optional right-aligned `badge`) over a hairline, then a `card-body` padded with the named `--card-body-padding` (28px) constant and 24px (`lg`) vertical rhythm. `--radius-lg` (14px), `--shadow`, surface bg.
- **`SectionLabel`** — uppercase mono 12px label with a 6px `--color-accent` leading square dot (`aria-hidden`); top margin left to the consumer via `className`.
- **`Switch`** — controlled `<button role="switch">` with `aria-checked`, accessible name from `label`, ON track filled `--color-accent`, named track sizes (`full` 38×22 / `sm` 32×18 as inline-style constants), `disabled` muted + blocked. Toggles on click and Space/Enter.
- **`SegmentedControl<T extends string>`** — `role="radiogroup"` of `role="radio"` segments, exactly one selected at all times, roving tabindex (single Tab stop), arrow-key navigation (wraps) + Home/End, selected segment uses `--accent-weak` bg + `--accent-text` (the C-03 3-mode rotation control replacing the mockup's 6 chips).

## Tests

- `Switch.test.tsx` — role=switch + accessible name, `aria-checked` reflects state, click toggles with negated value (both directions), Space/Enter toggle, disabled blocks toggle. (6 tests)
- `SegmentedControl.test.tsx` — radiogroup with one radio per option and exactly one selected (across value changes), click emits the chosen value, ArrowRight/ArrowLeft move selection (with wrap), roving tabindex. Exercised with the `RotationMode` options. (6 tests)
- Both jsdom-WebGL-free (no Canvas/three import).

## Verification Results

- `npx vitest run src/components/SegmentedControl.test.tsx src/components/Switch.test.tsx` → 12 passed.
- `npm run test` (full suite) → 12 files, 87 tests passed.
- `npm run build` (`tsc -b` typecheck + vite build) → succeeded.
- `node scripts/check-code-split.mjs` → code-split check PASSED (entry chunk three-free; three isolated in the lazy ResultPage chunk).
- `grep -rc "from 'three'|/viewer/"` over all five primitives → total 0 (three-free; T-4 / C-05).

## Deviations from Plan

None functional. One cosmetic adjustment: the NumberField header comment originally contained the literal substring `src/components/viewer/*`, which tripped the acceptance grep (`/viewer/`) even though it was only documentation. Reworded to "or any viewer module" so the three-free grep totals 0 as specified. Tasks otherwise executed exactly as written. (The lint-staged pre-commit hook applied prettier/eslint formatting to committed files — expected, no behavior change.)

## Threat Model Notes

- **T-4-XSS** (mitigate): all user-facing strings (`label`, `error`, `hint`, option labels, title/desc) render as React text children only — no `dangerouslySetInnerHTML`/`innerHTML` anywhere. React auto-escapes. Satisfied.
- **T-4-A11Y** (mitigate): Switch role=switch + aria-checked; SegmentedControl radiogroup with arrow-key nav and roving tabindex — pinned by the two test files.

No new security-relevant surface introduced (no network, no storage, no file access in any primitive).

## Self-Check: PASSED

Files created (all present):
- src/components/NumberField.tsx
- src/components/Card.tsx
- src/components/SectionLabel.tsx
- src/components/Switch.tsx
- src/components/SegmentedControl.tsx
- src/components/Switch.test.tsx
- src/components/SegmentedControl.test.tsx

Commits (all in git log):
- 10c5848 feat(04-04): add NumberField, Card, and SectionLabel primitives
- 3b95b6d feat(04-04): add accessible Switch and 3-mode SegmentedControl + tests
