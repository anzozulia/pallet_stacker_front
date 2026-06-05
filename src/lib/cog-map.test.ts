import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts: @/ alias proves resolution under Vitest, jsdom-WebGL-free
// (pure math, no Canvas/three import). Golden arrays are hand-computed LITERALS (NOT re-derived
// from the formula) so a CoG-axis bug fails loudly — same empirical discipline as the Phase-2
// mapping risk. The fixture cog values come from pack-done-response.json pallets[].cog.
import { mapCog } from '@/lib/cog-map';

const pallet = { L: 1000, W: 800 }; // both fixture pallets share these dims

describe('mapCog (golden, DIAG-01 — cog.z is the up-axis, no half-dim term)', () => {
  it('maps fixture P001 cog to the hand-computed three-space point', () => {
    // cog {491.597, 368.697, 497.059} → [491.597-500, 100+497.059, 368.697-400]
    const [x, y, z] = mapCog({ x: 491.597, y: 368.697, z: 497.059 }, pallet);
    expect(x).toBeCloseTo(-8.403, 3);
    expect(y).toBeCloseTo(597.059, 3);
    expect(z).toBeCloseTo(-31.303, 3);
  });

  it('maps fixture P002 cog to the hand-computed three-space point', () => {
    // cog {382.609, 339.13, 382.609} → [382.609-500, 100+382.609, 339.13-400]
    const [x, y, z] = mapCog({ x: 382.609, y: 339.13, z: 382.609 }, pallet);
    expect(x).toBeCloseTo(-117.391, 3);
    expect(y).toBeCloseTo(482.609, 3);
    expect(z).toBeCloseTo(-60.87, 3);
  });

  it('a CoG is already a centre point — no half-dimension offset is added to the up-axis', () => {
    // origin-x/y cog with z=0 must land exactly on the deck top, not deck + H/2.
    const [x, y, z] = mapCog({ x: 500, y: 400, z: 0 }, pallet);
    expect(x).toBeCloseTo(0, 6); // 500 - L/2
    expect(y).toBeCloseTo(100, 6); // DECK_TOP_Y + 0 (no +H/2)
    expect(z).toBeCloseTo(0, 6); // 400 - W/2
  });
});
