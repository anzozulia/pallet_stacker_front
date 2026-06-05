// jsdom-WebGL-free component test for the per-selected-pallet Placement list (Plan 06-04 Task 1,
// RESULT-05 / D-11). Renders the golden fixture's P001 items and asserts a representative card shows
// its item_id, Size (post-orientation dims), Position (API min-corner), orientation name, weight, and
// the always-shown Support % (DIAG-02). Also fires mouseEnter/mouseLeave on a card and asserts the
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

describe('PlacementList (per-pallet cards + one-way hover, RESULT-05 / D-11)', () => {
  test('renders a representative card with id, size, position, orientation, weight, and support %', () => {
    render(<PlacementList items={items} palette={palette} palletLabel="P001" onHover={() => {}} />);

    // The block label + per-selected-pallet count (D-03).
    expect(screen.getByText('Placement')).toBeInTheDocument();
    expect(screen.getByText(`P001 · ${items.length} items`)).toBeInTheDocument();

    // The corrected min-corner note (C-01) — NOT "box-centre".
    expect(
      screen.getByText('positions are box min-corner · mm · origin = pallet corner'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/box-centre/i)).not.toBeInTheDocument();

    // A representative card: T000 — 250·250·700 @ 0,0,0, LWH, 7 kg, 100% support.
    const idTag = screen.getByText('T000');
    const card = idTag.closest('[data-placement-card]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText('250·250·700')).toBeInTheDocument();
    expect(within(card).getByText('0, 0, 0')).toBeInTheDocument();
    expect(within(card).getByText('LWH')).toBeInTheDocument();
    expect(within(card).getByText('7 kg')).toBeInTheDocument();
    // Support is ALWAYS shown (DIAG-02): support_ratio 1.0 -> 100%.
    expect(within(card).getByText('Support')).toBeInTheDocument();
    expect(within(card).getByText('100%')).toBeInTheDocument();
  });

  test('fires onHover(item_id) on mouseEnter and onHover(null) on mouseLeave (one-way, D-11)', async () => {
    const onHover = vi.fn();
    render(<PlacementList items={items} palette={palette} palletLabel="P001" onHover={onHover} />);

    const card = (screen.getByText('T000').closest('[data-placement-card]') as HTMLElement)!;
    await userEvent.hover(card);
    expect(onHover).toHaveBeenLastCalledWith('T000');
    await userEvent.unhover(card);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });
});
