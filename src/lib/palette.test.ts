import { describe, expect, it } from 'vitest';
// Wiring copied from mapping.test.ts / Hello.test.tsx: @/ alias, jsdom-WebGL-free.
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/lib/fixture-types';
import { typeKeyOf } from '@/lib/mapping';
import { colorForType, SEED_COLORS } from '@/lib/palette';

describe('colorForType (deterministic)', () => {
  it('is sort-stable regardless of input order', () => {
    const a = colorForType(['F', 'T', 'D']);
    const b = colorForType(['D', 'T', 'F']);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('dedupes repeated keys', () => {
    const m = colorForType(['D', 'D', 'T', 'T']);
    expect(m.size).toBe(2);
  });
});

describe('colorForType (seed assignment)', () => {
  it('maps the whole-fixture type set {D,F,T} to the three seeds in sorted order', () => {
    // Derive the type set from the WHOLE fixture (all pallets' items + unpacked),
    // proving the legend covers {D,F,T} even though pallet 0 carries only D+T (Pitfall 5).
    const data = doneResponse as DoneResponse;
    const keys = new Set<string>();
    data.result.pallets.forEach((p) => p.items.forEach((i) => keys.add(typeKeyOf(i.item_id))));
    data.result.unpacked_items.forEach((u) => keys.add(typeKeyOf(u.item_id)));
    expect([...keys].sort()).toEqual(['D', 'F', 'T']);

    const m = colorForType([...keys]);
    expect(m.get('D')).toBe('#6d63f5');
    expect(m.get('F')).toBe('#0ea5a3');
    expect(m.get('T')).toBe('#e0892b');
  });
});

describe('colorForType (extension)', () => {
  it('assigns a 4th type a distinct deterministic hex (not any seed)', () => {
    const m = colorForType(['A', 'B', 'C', 'E']); // 4 types -> one beyond the 3 seeds
    const extra = m.get('E')!;
    expect(extra).toMatch(/^#[0-9a-f]{6}$/);
    expect(SEED_COLORS).not.toContain(extra);
    // Deterministic across calls.
    expect(colorForType(['A', 'B', 'C', 'E']).get('E')).toBe(extra);
  });
});
