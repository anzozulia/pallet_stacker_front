---
phase: quick-260617-w8a
plan: 01
subsystem: config
tags: [config, presets, ux, forms]
requires: [src/types/config.ts, src/features/config/schema.ts, src/features/config/ConfigForm.tsx]
provides:
  - src/features/config/demo-presets.ts (DEMO_PRESETS, buildPresetConfig)
  - src/features/config/DemoPresets.tsx (picker UI)
affects: [src/features/config/ConfigForm.tsx]
tech-stack:
  added: []
  patterns: [form.reset re-seed of useFieldArray catalog, three-free eager-chunk module discipline]
key-files:
  created:
    - src/features/config/demo-presets.ts
    - src/features/config/demo-presets.test.ts
    - src/features/config/DemoPresets.tsx
  modified:
    - src/features/config/ConfigForm.tsx
    - src/features/config/ConfigForm.test.tsx
decisions:
  - Pallet envelope fixed (1200x800x1800 / 1000kg / no overhang) for all presets; only boxTypes vary.
  - Fresh nanoid id per buildPresetConfig call so a preset can be picked repeatedly without id collisions.
  - Wired via single form.reset(cfg) (no field-by-field setValue) so RHF reset replaces the field-array wholesale and autosave captures it.
metrics:
  duration: ~10m
  completed: 2026-06-17
---

# Quick 260617-w8a: Demo box-catalog presets Summary

Four vetted, one-click demo presets at the top of the Configure page that prefill the whole form (fixed pallet + preset box catalog) via `form.reset(buildPresetConfig(preset))`.

## What was built

- **`demo-presets.ts`** — `DemoPreset` type, `DEMO_PRESETS` (4 entries: Office supply cartons, Distribution-centre mix, Stationery & archive boxes, Wholesale grocery cases), and `buildPresetConfig(preset): PackConfig`. Returns fresh literals each call: the fixed pallet `{ length:1200, width:800, height:1800, maxWeight:1000, maxOverhang:0, allowOverhang:false }` and boxTypes mapped to full `BoxType` objects with a fresh `b${nanoid(8)}` id, `maxLoad:90`, `fragile:false`, `rotation:'uprightOnly'`. No `maxPallets`. Imports only nanoid + types.
- **`DemoPresets.tsx`** — presentational picker: a labelled "Try a demo" section with a wrapping row of clickable `<button type="button">` cards (name + description + "N box types" hint), accent-on-hover, collapsing to one column under `max-[720px]`. Click → `onPick(buildPresetConfig(preset))`. Three-free.
- **`ConfigForm.tsx`** — renders `<DemoPresets onPick={(cfg) => form.reset(cfg)} />` as the first child of `<main>`, above the page H1.
- **Tests** — `demo-presets.test.ts` (22 assertions: schema parse, fixed pallet, unique letter-prefixed ids, fresh ids across calls, uprightOnly); `ConfigForm.test.tsx` extended (+2: picker renders 4 presets, clicking re-seeds pallet 1200/800/1800 + the preset's 3 box labels).

## TDD Gate Compliance

Both tasks followed RED → GREEN. Task 1: `test(260617-w8a)` (85f56cb) → `feat(260617-w8a)` (0e950f4). Task 2: test extended + `feat(260617-w8a)` (73440a7) committed together (component + wiring + test are a single feature change).

## Deviations from Plan

None - plan executed exactly as written.

## Gate Results

| Gate | Before | After |
|------|--------|-------|
| `npm test` | 32 files / 203 tests | 33 files / 225 tests (passed) |
| `npm run typecheck` | clean | clean |
| `npm run lint` | 0 errors, 1 warning (router.tsx, pre-existing) | 0 errors, 1 warning (unchanged) |
| `npm run build` | success | success |
| `node scripts/check-code-split.mjs` | PASSED | PASSED (entry three-free) |
| `npm run test:e2e` | 14 passed | 14 passed |

## Commits

- `85f56cb` test(260617-w8a): add failing tests for demo-preset data + builder
- `0e950f4` feat(260617-w8a): add demo-preset data + buildPresetConfig builder
- `73440a7` feat(260617-w8a): DemoPresets picker wired into ConfigForm via form.reset

## Self-Check: PASSED

- src/features/config/demo-presets.ts — FOUND
- src/features/config/demo-presets.test.ts — FOUND
- src/features/config/DemoPresets.tsx — FOUND
- Commits 85f56cb, 0e950f4, 73440a7 — all in git log
