// jsdom-WebGL-free component test for the single-select Pallet switcher (Plan 06-03 Task 2,
// RESULT-04). Renders with the golden fixture pallets and asserts: a row per generated pallet
// (labels P001/P002, box counts 19/12, weights 119/92 kg), exactly one row aria-pressed, clicking
// the second row calls onSelect(1), and NO row carries an amber/warn treatment (D-04 — fill% is
// always neutral, never a client-side quality judgement). Three-free; `@/` resolves via Vitest.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { mapDoneResponse } from '@/lib/result-mapper';
import PalletSwitcher from '@/components/result/PalletSwitcher';

const view = mapDoneResponse(doneResponse as DoneResponse);

describe('PalletSwitcher (single-select group, RESULT-04 / D-04)', () => {
  test('renders one row per pallet with label, box count, and weight', () => {
    render(<PalletSwitcher pallets={view.pallets} selected={0} onSelect={() => {}} />);

    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(2);

    // Labels are the API pallet_id (D-05) — never A/B/C.
    expect(screen.getByText('P001')).toBeInTheDocument();
    expect(screen.getByText('P002')).toBeInTheDocument();

    // Mono meta: box count + weight per row.
    expect(within(rows[0]).getByText(/19 boxes/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/119 kg/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/12 boxes/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/92 kg/)).toBeInTheDocument();
  });

  test('exactly one row is selected (aria-pressed)', () => {
    render(<PalletSwitcher pallets={view.pallets} selected={0} onSelect={() => {}} />);
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('P001');
  });

  test('clicking the second row calls onSelect(1)', async () => {
    const onSelect = vi.fn();
    render(<PalletSwitcher pallets={view.pallets} selected={0} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('P002'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  test('no pallet row carries an amber / warn treatment (D-04)', () => {
    const { container } = render(
      <PalletSwitcher pallets={view.pallets} selected={0} onSelect={() => {}} />,
    );
    // No --color-warn token, no amber class, no warn utility anywhere in the rendered markup.
    expect(container.innerHTML).not.toMatch(/warn|amber|d97706/i);
  });
});
