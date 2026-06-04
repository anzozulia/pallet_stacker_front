import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the FooterBar's
// own behaviours (BOX-05 / D-03 / D-07): the live `{N} box types · {M} units · est. {K} kg`
// total renders from given form state; the `Large job — …` advisory is STRICTLY >1000
// (present at 1001, absent at exactly 1000) and is non-blocking; the `Saved ✓` confirmation
// appears after a Save-draft click. Advisory assertions are text-based (the copy) — colour
// is the human checkpoint's job. `@/` resolves via Vitest.
import type { PackConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/features/config/defaults';
import FooterBar from '@/features/config/FooterBar';

// Mount FooterBar inside a minimal RHF host so its `useWatch('boxTypes')` resolves against
// a seeded catalog. `boxTypes` is the only field the footer reads.
function Harness({
  boxTypes,
  onRun = () => {},
  onSaveDraft = () => {},
  runDisabled = false,
}: {
  boxTypes: PackConfig['boxTypes'];
  onRun?: () => void;
  onSaveDraft?: () => void;
  runDisabled?: boolean;
}) {
  const methods = useForm<PackConfig>({
    defaultValues: { ...DEFAULT_CONFIG, boxTypes },
  });
  return (
    <FormProvider {...methods}>
      <FooterBar onRun={onRun} onSaveDraft={onSaveDraft} runDisabled={runDisabled} />
    </FormProvider>
  );
}

// A box type with controllable quantity + weight (other fields are DEFAULT-shaped).
function box(quantity: number, weight: number, id: string): PackConfig['boxTypes'][number] {
  return { ...DEFAULT_CONFIG.boxTypes[0], id, quantity, weight };
}

describe('FooterBar — live running total (BOX-05)', () => {
  test('renders the exact `{N} box types · {M} units · est. {K} kg` string', () => {
    // 2 types / 30 units / 12 kg: (10 × 0.6) + (20 × 0.3) = 6 + 6 = 12 kg.
    render(<Harness boxTypes={[box(10, 0.6, 'ba'), box(20, 0.3, 'bb')]} />);
    expect(screen.getByText('2 box types · 30 units · est. 12 kg')).toBeInTheDocument();
  });

  test('coerces in-progress NaN fields to 0 — never renders NaN', () => {
    render(<Harness boxTypes={[box(NaN, NaN, 'ba')]} />);
    expect(screen.getByText('1 box types · 0 units · est. 0 kg')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe('FooterBar — large-job advisory threshold (D-03, strict >1000)', () => {
  test('shows the advisory at 1001 units (non-blocking)', () => {
    render(<Harness boxTypes={[box(1001, 1, 'ba')]} />);
    expect(screen.getByText(/Large job — 1001 units/)).toBeInTheDocument();
    // Non-blocking: Run stays enabled regardless of the advisory.
    expect(screen.getByRole('button', { name: /Run packing/ })).toBeEnabled();
  });

  test('hides the advisory at exactly 1000 units', () => {
    render(<Harness boxTypes={[box(1000, 1, 'ba')]} />);
    expect(screen.queryByText(/Large job/)).not.toBeInTheDocument();
  });
});

describe('FooterBar — Save draft confirmation (D-07)', () => {
  test('clicking Save draft flushes and swaps the label to "Saved ✓"', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();
    render(<Harness boxTypes={[box(10, 1, 'ba')]} onSaveDraft={onSaveDraft} />);

    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });
});
