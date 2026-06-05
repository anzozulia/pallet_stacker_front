// Pure, deterministic support-ratio -> heat-colour scale for the stability heatmap (DIAG-02).
// IO-free, jsdom-testable: this module imports NOTHING at runtime (no `three`, no React, no
// IO) so it stays outside the lazy /result chunk and never threatens the code-split build
// gate (C-04).
//
// The scale is perceptually ORDERED (well-supported → low-support) and colour-blind-
// considerate: it runs blue/teal → amber → magenta rather than a pure red↔green ramp, so
// the buckets stay distinguishable for the common deuteranopia/protanopia cases. It is
// ALWAYS paired with the numeric support N% in the UI (UI-SPEC §Color), so colour is a
// reinforcement, not the sole channel.

/**
 * Ordered support buckets, BEST → WORST. Index 0 is the well-supported top bucket
 * (`supportColor(1.0)`); the last entry is the low-support bottom bucket (`supportColor(0)`).
 * Five perceptually distinct stops; not a red↔green-only ramp.
 */
const SUPPORT_BUCKETS = [
  '#1d4ed8', // ratio ∈ (0.8, 1.0]   — well supported (blue)
  '#0ea5a3', // ratio ∈ (0.6, 0.8]   — good (teal)
  '#d97706', // ratio ∈ (0.4, 0.6]   — moderate (amber)
  '#db2777', // ratio ∈ (0.2, 0.4]   — weak (magenta)
  '#7c2d12', // ratio ∈ [0.0, 0.2]   — low support (deep brown)
] as const;

/**
 * Map a support ratio in [0,1] to an ordered, colour-blind-considerate hex. Out-of-range
 * input clamps to [0,1]. Higher ratio → top (well-supported) bucket; lower ratio → bottom
 * (low-support) bucket. Deterministic and pure.
 */
export function supportColor(ratio: number): string {
  const r = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
  // Five evenly-sized buckets over [0,1]; the top bucket is inclusive of 1.0.
  if (r > 0.8) return SUPPORT_BUCKETS[0];
  if (r > 0.6) return SUPPORT_BUCKETS[1];
  if (r > 0.4) return SUPPORT_BUCKETS[2];
  if (r > 0.2) return SUPPORT_BUCKETS[3];
  return SUPPORT_BUCKETS[4];
}
