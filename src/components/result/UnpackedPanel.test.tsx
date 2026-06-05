// jsdom-WebGL-free component test for the conditional whole-job Unpacked panel (Plan 06-04 Task 2,
// RESULT-06 / D-06). (a) With the golden fixture's 7 unpacked items, asserts the `Could not pack`
// label, the `7 items` count, and a representative row's id + reason (rendered as plain text).
// (b) With an empty array, asserts the block is OMITTED and the `All items packed ✓` affordance is
// present. Three-free; `@/` resolves via Vitest.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/types/pack-contract';
import { mapDoneResponse } from '@/lib/result-mapper';
import UnpackedPanel from '@/components/result/UnpackedPanel';

const view = mapDoneResponse(doneResponse as DoneResponse);
const unpacked = view.unpacked; // 7 items, reason `no_feasible_placement`

describe('UnpackedPanel (conditional whole-job, RESULT-06 / D-06)', () => {
  test('with unpacked items: renders the Could-not-pack block, count, and a row id + reason', () => {
    render(<UnpackedPanel unpacked={unpacked} />);

    expect(screen.getByText('Could not pack')).toBeInTheDocument();
    expect(screen.getByText('7 items')).toBeInTheDocument();
    expect(screen.queryByText(/All items packed/)).not.toBeInTheDocument();

    // A representative row: F011 with its reason rendered as plain text.
    const idTag = screen.getByText('F011');
    const row = idTag.closest('[data-unpacked-row]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).getByText('no_feasible_placement')).toBeInTheDocument();
    expect(within(row).getByText('350·350·350 mm')).toBeInTheDocument();
    expect(within(row).getByText('9 kg')).toBeInTheDocument();
  });

  test('with an empty unpacked array: omits the block and shows the all-packed affordance (D-06)', () => {
    render(<UnpackedPanel unpacked={[]} />);

    expect(screen.queryByText('Could not pack')).not.toBeInTheDocument();
    expect(screen.getByText('All items packed ✓')).toBeInTheDocument();
  });
});
