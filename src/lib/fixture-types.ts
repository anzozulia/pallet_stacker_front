// Re-export shim: the `done`-response interfaces were consolidated into
// src/types/pack-contract.ts (D-02). This shim preserves the existing
// @/lib/fixture-types import path for its 5 importers (mapping.ts, mapping.test.ts,
// palette.test.ts, Boxes.tsx, ResultPage.tsx) — chosen over rewriting them because
// two are locked Phase-2 runtime components. Import from '@/types/pack-contract' in
// new code.
export * from '@/types/pack-contract';
