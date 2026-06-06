// jsdom-WebGL-free component test for the per-selected-pallet Placement list (Plan 06-04 Task 1,
// RESULT-05 / D-11). Renders the golden fixture's P001 items and asserts a representative card shows
// the human box-TYPE LABEL (#6, via typeToLabel), the Size (post-orientation dims), the weight, and
// the always-shown Support % (DIAG-02). It also asserts the decluttered card NO LONGER shows the raw
// item_id chip, the typeId sub-line, the orientation badge, the Position x,y,z field, or the
// min-corner caption (#6-#8, #11). Also fires mouseEnter/mouseLeave on a card and asserts the
// one-way hover callback fires with the item_id then null. Three-free; `@/` resolves via Vitest.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { mapDoneResponse } from '@/lib/result-mapper';
import { colorForType } from '@/lib/palette';
import PlacementList from '@/components/result/PlacementList';

const view = mapDoneResponse(doneResponse as DoneResponse);
const items = view.pallets[0].items; // P001 — `PlacementOut & { typeId }`
const palette = colorForType(items.map((i) => i.typeId));
// Map every recovered typeId to a human label (#6) — mirrors the request-builder typeToLabel.
const typeToLabel = new Map(items.map((i) => [i.typeId, `Box type ${i.typeId}`]));

describe('PlacementList (per-pallet cards + one-way hover, RESULT-05 / D-11)', () => {
  test('a card shows the human type LABEL, size, weight, support % — and none of the removed fields', () => {
    render(
      <PlacementList
        items={items}
        palette={palette}
        palletLabel="P001"
        typeToLabel={typeToLabel}
        onHover={() => {}}
      />,
    );

    // The block label + per-selected-pallet count (D-03).
    expect(screen.getByText('Placement')).toBeInTheDocument();
    expect(screen.getByText(`P001 · ${items.length} items`)).toBeInTheDocument();

    // The min-corner caption (#11) is gone.
    expect(
      screen.queryByText('positions are box min-corner · mm · origin = pallet corner'),
    ).not.toBeInTheDocument();

    // A representative card: the T-type box — 250·250·700, 7 kg, 100% support, shown by its label.
    const label = screen.getAllByText('Box type T')[0];
    const card = label.closest('[data-placement-card]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText('250·250·700')).toBeInTheDocument();
    expect(within(card).getByText('7 kg')).toBeInTheDocument();
    // Support is ALWAYS shown (DIAG-02): support_ratio 1.0 -> 100%.
    expect(within(card).getByText('Support')).toBeInTheDocument();
    expect(within(card).getByText('100%')).toBeInTheDocument();

    // Removed fields (#6-#8): no raw item_id chip, no typeId sub-line, no orientation badge,
    // no Position field.
    expect(within(card).queryByText('T000')).not.toBeInTheDocument();
    expect(within(card).queryByText('Position x,y,z')).not.toBeInTheDocument();
    expect(within(card).queryByText('LWH')).not.toBeInTheDocument();
    expect(within(card).queryByText('0, 0, 0')).not.toBeInTheDocument();
  });

  test('falls back to the raw typeId when no label is threaded', () => {
    render(<PlacementList items={items} palette={palette} palletLabel="P001" onHover={() => {}} />);
    // With no typeToLabel, the card identifier is the raw typeId (e.g. "T").
    expect(screen.getAllByText('T').length).toBeGreaterThan(0);
  });

  test('fires onHover(item_id) on mouseEnter and onHover(null) on mouseLeave (one-way, D-11)', async () => {
    const onHover = vi.fn();
    render(
      <PlacementList
        items={items}
        palette={palette}
        palletLabel="P001"
        typeToLabel={typeToLabel}
        onHover={onHover}
      />,
    );

    const card = (screen
      .getAllByText('Box type T')[0]
      .closest('[data-placement-card]') as HTMLElement)!;
    await userEvent.hover(card);
    expect(onHover).toHaveBeenLastCalledWith('T000');
    await userEvent.unhover(card);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });
});
