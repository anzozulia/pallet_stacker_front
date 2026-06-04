---
phase: 04-config-form-local-persistence
plan: 03
subsystem: persistence
tags: [localStorage, persistence, zod, security, pure-transform]
requires:
  - "src/features/config/schema.ts (packConfigShapeSchema — lenient restore guard) [04-01]"
  - "src/features/config/defaults.ts (DEFAULT_CONFIG — fallback) [04-01]"
  - "src/types/config.ts (PackConfig model)"
provides:
  - "src/lib/config-persist.ts: serializeConfig / deserializeConfigOrDefault / STORAGE_KEY / STORAGE_VERSION (D-07)"
affects:
  - "Plan 07 (IO hook that reads/writes localStorage[STORAGE_KEY] around these pure guards)"
tech-stack:
  added: []
  patterns:
    - "Versioned localStorage envelope { version, config } with try/catch + version-guard + safeParse (RESEARCH Pattern 7)"
    - "LENIENT shape schema for restore (Pitfall 4) vs STRICT submit schema for Run gating"
    - "Pure IO-free guard module; all localStorage IO deferred to the Plan-07 hook"
key-files:
  created:
    - "src/lib/config-persist.ts"
    - "src/lib/config-persist.test.ts"
  modified: []
decisions:
  - "Version mismatch = discard-and-seed (return DEFAULT_CONFIG); a future bump branches to migrate() at the version check — no migration logic shipped yet (D-07)."
  - "Restore guard uses packConfigShapeSchema (lenient) NOT packConfigSubmitSchema (strict) so incomplete drafts round-trip (Pitfall 4 / D-04)."
  - "Non-object JSON (number/string/array/null) is rejected before destructuring to keep the envelope contract tight."
metrics:
  duration: ~7min
  completed: 2026-06-04
  tasks: 1
  files: 2
---

# Phase 4 Plan 03: Versioned localStorage (De)serialize Guard Summary

Pure, never-throwing, version-guarded localStorage (de)serializer (`serializeConfig` / `deserializeConfigOrDefault`) that round-trips valid configs, restores incomplete-but-shaped drafts via the lenient `packConfigShapeSchema`, and silently falls back to `DEFAULT_CONFIG` on any malformed/version-mismatched/shape-invalid blob — the security-relevant "never crash-load untrusted storage" control behind Phase 4's refresh-safety feature.

## What Was Built

- **`src/lib/config-persist.ts`** — three exports the Plan-07 IO hook will wrap:
  - `STORAGE_KEY = 'palletize:config:v1'` and `STORAGE_VERSION = 1` (named-constant house style, D-07 doc comments).
  - `serializeConfig(config)` → `JSON.stringify({ version: STORAGE_VERSION, config })` (versioned envelope).
  - `deserializeConfigOrDefault(raw)` → never throws: null short-circuit, `try/catch` around `JSON.parse`, non-object rejection, `version !== STORAGE_VERSION` → defaults, then `packConfigShapeSchema.safeParse` → restored data or `DEFAULT_CONFIG`.
  - Pure: no `window` / `localStorage` / `three` / React at runtime (only zod via the schema + a type-only model import) — preserves the code-split build gate (SC-4).
- **`src/lib/config-persist.test.ts`** — 11-case golden guard suite: constant assertions, round-trip equality, the versioned-envelope shape, and the full never-crash matrix (null, unparseable, non-object, version mismatch, shape fail, malformed corpus), plus the Pitfall-4 lenient-draft-restores case (a box `length: 0` survives, proving the lenient schema is used).

## How It Works

`deserializeConfigOrDefault` is the trust boundary from untrusted localStorage into the app (T-4-PERSIST). It defends in layers: parse failure caught → non-object rejected → version checked → `safeParse` validates structure/types against an explicit zod schema (unknown keys discarded, blocking prototype pollution T-4-PP). The guard deliberately uses the **lenient** `packConfigShapeSchema` (structure/type only, no business rules) so an in-progress draft round-trips; the form re-validates with the **strict** submit schema before "Run".

## Deviations from Plan

None - plan executed exactly as written (TDD RED → GREEN, no refactor needed).

## TDD Gate Compliance

- RED gate: `test(04-03)` commit `2e22d84` — suite failed (module not found) before implementation.
- GREEN gate: `feat(04-03)` commit `be47635` — all 11 cases pass.
- No REFACTOR commit (implementation was already minimal/clean).

## Verification

- `npx vitest run src/lib/config-persist.test.ts` → 11/11 pass (incl. round-trip, null, unparseable/no-throw, non-object, version-mismatch, shape-fail, lenient-draft-restores).
- `npm run test` → 75/75 pass across 10 files (no regressions).
- `npm run typecheck` (`tsc -b --noEmit`) → clean.
- Purity: only `window.`/`localStorage` occurrences are doc-comment prose (lines 25, 43); no runtime IO. No `three` import.

## Commits

- `2e22d84` test(04-03): add failing guard suite for versioned config persist
- `be47635` feat(04-03): implement versioned config persist guard (D-07/DATA-02)

## Self-Check: PASSED

- FOUND: src/lib/config-persist.ts
- FOUND: src/lib/config-persist.test.ts
- FOUND commit: 2e22d84
- FOUND commit: be47635
