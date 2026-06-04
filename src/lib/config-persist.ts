// Pure, IO-free versioned (de)serialize / migrate guard for the localStorage draft slot
// (D-07 / DATA-02) — the heart of Phase 4's refresh-safety feature. This module imports
// NOTHING at runtime beyond zod (via the schema) and the type-only model, so it stays
// outside the lazy /result chunk and never threatens the code-split build gate (SC-4):
// no `window`, no `localStorage`, no `three`, no React. The thin IO hook that actually
// reads/writes `localStorage[STORAGE_KEY]` is wired later (Plan 07); only the guard logic
// lives here, which keeps it jsdom-unit-testable without mocking the browser.
//
// Security control (T-4-PERSIST / T-4-PP): the raw stored blob is UNTRUSTED — a user or
// another script may have hand-edited or corrupted it. `deserializeConfigOrDefault` MUST
// NEVER throw and MUST NEVER crash-load: JSON.parse is wrapped in try/catch, the envelope
// version is checked, and the parsed `config` is validated by `safeParse` against an
// explicit zod schema (unknown keys discarded — no prototype pollution) before it is
// trusted. Anything broken silently falls back to DEFAULT_CONFIG.
//
// CRITICAL (Pitfall 4 / D-04): the restore guard uses the LENIENT `packConfigShapeSchema`
// (structure/type only — no business rules), NOT the strict submit schema. An in-progress
// draft (e.g. a box length of 0, a blank label) is structurally valid and MUST round-trip;
// the form re-validates with the strict schema before submit.

import { packConfigShapeSchema } from '@/features/config/schema';
import { DEFAULT_CONFIG } from '@/features/config/defaults';
import type { PackConfig } from '@/types/config';

/** localStorage slot key for the persisted draft config (D-07). */
export const STORAGE_KEY = 'palletize:config:v1';

/**
 * Schema version of the persisted envelope (D-07). A blob whose `version` does not match
 * is discarded-and-seeded (fall back to DEFAULT_CONFIG); a future version bump branches to
 * a `migrate()` here instead of discarding.
 */
export const STORAGE_VERSION = 1;

/** Versioned storage envelope: `{ version, config }`. */
interface StorageEnvelope {
  version: number;
  config: unknown;
}

/**
 * Serialize a PackConfig into the versioned slot shape: `{ version, config }`.
 * Pure — returns the JSON string the Plan-07 IO hook writes to `localStorage[STORAGE_KEY]`.
 */
export function serializeConfig(config: PackConfig): string {
  return JSON.stringify({ version: STORAGE_VERSION, config });
}

/**
 * Deserialize a raw stored blob (or null) into a usable PackConfig, NEVER throwing
 * (T-4-PERSIST). Falls back to DEFAULT_CONFIG on null / unparseable / non-object /
 * version-mismatch / shape-fail; restores structurally-valid drafts via the LENIENT
 * `packConfigShapeSchema` so incomplete work-in-progress survives (Pitfall 4 / D-04).
 */
export function deserializeConfigOrDefault(raw: string | null): PackConfig {
  if (raw == null) return DEFAULT_CONFIG;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_CONFIG;
  }

  // Reject non-objects (number/string/array/null) — the envelope must be a plain object.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_CONFIG;
  }

  const { version, config } = parsed as Partial<StorageEnvelope>;

  // Version mismatch: discard-and-seed (future: branch to migrate(config, version)).
  if (version !== STORAGE_VERSION) return DEFAULT_CONFIG;

  // Lenient structure/type guard (Pitfall 4): unknown keys are discarded by safeParse,
  // and a business-invalid-but-shaped draft still passes so it round-trips.
  const result = packConfigShapeSchema.safeParse(config);
  return result.success ? result.data : DEFAULT_CONFIG;
}
