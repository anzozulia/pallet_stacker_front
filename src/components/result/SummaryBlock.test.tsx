// jsdom-WebGL-free component test for the whole-job Summary block (Plan 06-03 Task 1, RESULT-03).
// Builds the ResultView from the committed golden fixture and asserts the three rendered stat cells
// read the whole-job golden values: Pallets used `2`, Utilisation `72.8 %` (1 decimal), Total weight
// `211.0 kg` (1 decimal). The Unpacked STAT was removed (#5) — the Unpacked PANEL still renders
// elsewhere. The block is three-free (Card/SectionLabel + the pure `summarise` only); the WebGL
// canvas is never imported here. `@/` resolves via Vitest.
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { mapDoneResponse } from '@/lib/result-mapper';
import SummaryBlock from '@/components/result/SummaryBlock';

const view = mapDoneResponse(doneResponse as DoneResponse);

describe('SummaryBlock (whole-job stats, RESULT-03 / D-03)', () => {
  test('renders the three whole-job golden stat cells (no Unpacked stat — #5)', () => {
    render(<SummaryBlock view={view} />);

    // Pallets used → 2 (integer, no denominator when maxPallets omitted).
    expect(screen.getByText('2')).toBeInTheDocument();
    // Utilisation → 72.8 % (1 decimal of the raw 72.81 product).
    expect(screen.getByText(/72\.8/)).toBeInTheDocument();
    // Total weight → 211.0 kg (1 decimal).
    expect(screen.getByText(/211\.0/)).toBeInTheDocument();

    // The three remaining cell labels.
    expect(screen.getByText('Pallets used')).toBeInTheDocument();
    expect(screen.getByText('Utilisation')).toBeInTheDocument();
    expect(screen.getByText('Total weight')).toBeInTheDocument();

    // The Unpacked STAT was removed (#5) — neither the label nor the `7 / 38` value renders here.
    expect(screen.queryByText('Unpacked')).not.toBeInTheDocument();
    expect(screen.queryByText('7 / 38')).not.toBeInTheDocument();
  });

  test('shows the `/ {maxPallets}` denominator only when maxPallets is supplied', () => {
    const { rerender } = render(<SummaryBlock view={view} />);
    // Omitted → no denominator affix.
    expect(screen.queryByText(/\/\s*5/)).not.toBeInTheDocument();

    rerender(<SummaryBlock view={view} maxPallets={5} />);
    expect(screen.getByText(/\/\s*5/)).toBeInTheDocument();
  });

  test('renders the Utilisation accent fill bar (named constant: 4px / max 120px)', () => {
    const { container } = render(<SummaryBlock view={view} />);
    const bar = container.querySelector('[data-util-fill]');
    expect(bar).not.toBeNull();
  });
});
