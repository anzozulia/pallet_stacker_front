import { describe, expect, it } from 'vitest';
// Wiring copied from request-builder.test.ts / palette.test.ts: @/ alias proves
// resolution under Vitest, jsdom-WebGL-free (pure logic, no 3D/IO surface).
import { checkAllBoxesFit, orientationsFor } from '@/lib/box-fit';
import type { BoxType, PalletConfig } from '@/types/config';

// Synthetic box-type factory mirroring the request-builder.test fixture shape so each
// case mutates only the dims/rotation under test. label drives the failure message.
function box(partial: Partial<BoxType>): BoxType {
  return {
    id: 'Da',
    label: 'Box A',
    length: 600,
    width: 300,
    height: 150,
    weight: 5,
    quantity: 1,
    maxLoad: 50,
    fragile: false,
    rotation: 'free',
    ...partial,
  };
}

// Pallet with NO overhang by default (overhang cases set it explicitly).
function pallet(partial: Partial<PalletConfig> = {}): PalletConfig {
  return { length: 1000, width: 800, height: 1800, maxWeight: 250, maxOverhang: 0, ...partial };
}

describe('orientationsFor (D-01 / BOX-06)', () => {
  it('fixed → one orientation: footprint L×W, up = H', () => {
    const o = orientationsFor(box({ rotation: 'fixed', length: 600, width: 300, height: 150 }));
    expect(o).toEqual([{ footA: 600, footB: 300, up: 150 }]);
  });

  it('uprightOnly → one orientation (height fixed up; footprint helper covers the 90° turn)', () => {
    const o = orientationsFor(
      box({ rotation: 'uprightOnly', length: 600, width: 300, height: 150 }),
    );
    expect(o).toEqual([{ footA: 600, footB: 300, up: 150 }]);
  });

  it('free → three orientations, one per up-axis', () => {
    const o = orientationsFor(box({ rotation: 'free', length: 600, width: 300, height: 150 }));
    expect(o).toEqual([
      { footA: 600, footB: 300, up: 150 },
      { footA: 600, footB: 150, up: 300 },
      { footA: 300, footB: 150, up: 600 },
    ]);
  });
});

describe('checkAllBoxesFit (D-01 / BOX-06)', () => {
  it('exact-fit: footprint == pallet L×W and H <= pallet height → fits', () => {
    const config = {
      pallet: pallet({ length: 1000, width: 800, height: 1800, maxOverhang: 0 }),
      boxTypes: [box({ rotation: 'fixed', length: 1000, width: 800, height: 1000 })],
    };
    expect(checkAllBoxesFit(config)).toEqual({ ok: true, failures: [] });
  });

  it('overhang-edge: footprint within maxOverhang → fits; beyond → fails', () => {
    // Pallet 1000×800, overhang 50. Box footprint 1040×820 (each side +40/+20) → within.
    const within = {
      pallet: pallet({ length: 1000, width: 800, maxOverhang: 50 }),
      boxTypes: [box({ rotation: 'fixed', length: 1040, width: 820, height: 100 })],
    };
    expect(checkAllBoxesFit(within).ok).toBe(true);

    // Same box, but footprint 1060×820 (length over by 60 > 50 overhang) → beyond → fails.
    const beyond = {
      pallet: pallet({ length: 1000, width: 800, maxOverhang: 50 }),
      boxTypes: [box({ rotation: 'fixed', length: 1060, width: 820, height: 100 })],
    };
    const res = checkAllBoxesFit(beyond);
    expect(res.ok).toBe(false);
    expect(res.failures).toEqual([
      { index: 0, id: 'Da', message: '"Box A" cannot fit the pallet in any allowed orientation' },
    ]);
  });

  it('too-tall-but-rotatable: free lays a shorter axis up → fits; fixed (height locked) → fails', () => {
    // Box 700×300×2000 on a 1800mm-high pallet. Footprint must also fit 1000×800.
    // free: lay the 700-axis up → footprint 300×2000? no. lay 300 up → 700×2000? no.
    // Use a box where ONLY a rotation makes both height and footprint work:
    // 700 × 500 × 2000 pallet 1000×800 height 1800.
    //   base (up=2000) too tall.
    //   up=500 → footprint 700×2000 → 2000 > 1000+0 and 2000 > 800 → no.
    //   up=700 → footprint 500×2000 → 2000 too big → no. Hmm.
    // Choose dims so a rotated footprint fits: 900 × 1700 × 2000, pallet 1000×800 height 1800.
    //   up=2000 footprint 900×1700: 1700>1000 & 1700>800 → no.
    //   up=1700 footprint 900×2000 → no.
    //   up=900 footprint 1700×2000 → no.
    // Simpler: tall thin box 400×400×2000, pallet 1000×800 height 1800.
    //   free: up=400 → footprint 400×2000 → 2000 > both → no. Still no.
    // The genuinely-rotatable case: a box whose ONE oversized axis is the height,
    // and the other two fit the deck. 400×400×2000 fails because 2000 can't lie on an
    // 1000×800 deck either. Use 400×900×2000 pallet 1000×800 height 1800:
    //   up=2000 → footprint 400×900: 900>800 but 900<=1000 & 400<=800 (swapped) → FITS footprint,
    //     but up=2000 > 1800 → no.
    //   up=900  → footprint 400×2000 → 2000 too big → no.
    //   up=400  → footprint 900×2000 → no.
    // Need the height axis to be the ONLY too-big one AND a non-height axis can become up.
    // 500×900×1700 pallet 1000×800 height 1500:
    //   up=1700 footprint 500×900: 900>800 & 900<=1000,500<=800 swapped → footprint FITS; 1700>1500 → no.
    //   up=900  footprint 500×1700 → 1700 too big → no.
    //   up=500  footprint 900×1700 → no.
    // The clean case: box where a SHORT axis can go up. 500×900×1400 pallet 1000×800 height 1300:
    //   up=1400 footprint 500×900 fits deck; 1400>1300 → no.
    //   up=900  footprint 500×1400 → 1400 too big → no.
    //   up=500  footprint 900×1400 → no.
    // The deck (1000×800) is the limiter. Make the box small enough on two axes:
    // 600×700×1400 pallet 1000×800 height 1300:
    //   up=1400 footprint 600×700: fits deck; 1400>1300 → no.
    //   up=700  footprint 600×1400 → 1400>1000 → no.
    //   up=600  footprint 700×1400 → 1400>1000 → no.
    // For a rotation to RESCUE height, a non-height axis (<=1300) must be able to lie on the deck.
    // 600×700×1400 → axes 600,700 both <=1300 and as up they're fine; the trouble is the
    // REMAINING footprint then includes 1400 which exceeds the deck. So rotation only helps
    // when the long (height) axis ALSO fits the deck. 600×700×1000 pallet 1000×800 height 900:
    //   up=1000 footprint 600×700 fits; 1000>900 → no.
    //   up=700  footprint 600×1000: 1000<=1000 & 600<=800 → FITS; 700<=900 → FITS overall ✓ (free)
    //   fixed: only up=1000 → 1000>900 → fails.
    const dims = { length: 600, width: 700, height: 1000 };
    const tallPallet = pallet({ length: 1000, width: 800, height: 900, maxOverhang: 0 });

    const free = { pallet: tallPallet, boxTypes: [box({ rotation: 'free', ...dims })] };
    expect(checkAllBoxesFit(free).ok).toBe(true);

    const fixed = { pallet: tallPallet, boxTypes: [box({ rotation: 'fixed', ...dims })] };
    expect(checkAllBoxesFit(fixed).ok).toBe(false);
  });

  it('uprightOnly: height fixed up, base turns 90° — footprint fits in either deck alignment', () => {
    // Box 800×1000×500 (footprint exceeds deck in given alignment but fits when turned),
    // pallet 1000×800 height 1800. up=500 <= 1800; footprint 800×1000 fits via swap.
    const config = {
      pallet: pallet({ length: 1000, width: 800, height: 1800, maxOverhang: 0 }),
      boxTypes: [box({ rotation: 'uprightOnly', length: 800, width: 1000, height: 500 })],
    };
    expect(checkAllBoxesFit(config).ok).toBe(true);
  });

  it('2000mm typo: a 2000mm box on an 800mm pallet (40mm overhang, 1800mm height) → fails in every mode', () => {
    const config = (rotation: BoxType['rotation']) => ({
      pallet: pallet({ length: 800, width: 800, height: 1800, maxOverhang: 40 }),
      boxTypes: [box({ rotation, length: 2000, width: 2000, height: 2000 })],
    });
    expect(checkAllBoxesFit(config('free')).ok).toBe(false);
    expect(checkAllBoxesFit(config('uprightOnly')).ok).toBe(false);
    expect(checkAllBoxesFit(config('fixed')).ok).toBe(false);
  });

  it('aggregates per-box failures with {index,id,message}; ok iff failures empty', () => {
    const config = {
      pallet: pallet({ length: 1000, width: 800, height: 1800, maxOverhang: 0 }),
      boxTypes: [
        box({ id: 'Da', label: 'Good', rotation: 'fixed', length: 500, width: 400, height: 300 }),
        box({
          id: 'Tb',
          label: 'Too Big',
          rotation: 'fixed',
          length: 2000,
          width: 2000,
          height: 2000,
        }),
      ],
    };
    const res = checkAllBoxesFit(config);
    expect(res.ok).toBe(false);
    expect(res.failures).toEqual([
      { index: 1, id: 'Tb', message: '"Too Big" cannot fit the pallet in any allowed orientation' },
    ]);
  });
});
