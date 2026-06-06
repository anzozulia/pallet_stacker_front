import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the box-row
// per-type contract (BOX-03/04 / D-08): fragile ON disables + zeroes max-load, OFF
// restores the prior value, the rotation segmented control sets one of the 2 UI modes, and
// the remove button carries the interpolated `aria-label`. `@/` resolves via Vitest.
import type { BoxType, PackConfig } from '@/types/config';
import { makeDefaultBoxType } from '@/features/config/defaults';
import BoxRow from '@/features/config/BoxRow';

// Minimal RHF wrapper providing a single box type so BoxRow's useFormContext works.
function Harness({ box, onRemove = () => {} }: { box?: Partial<BoxType>; onRemove?: () => void }) {
  const seed: BoxType = { ...makeDefaultBoxType(), id: 'btest', label: 'Carton A', ...box };
  const methods = useForm<PackConfig>({
    defaultValues: { pallet: {} as PackConfig['pallet'], boxTypes: [seed] },
  });
  return (
    <FormProvider {...methods}>
      <BoxRow index={0} allIds={[seed.id]} onRemove={onRemove} />
    </FormProvider>
  );
}

describe('BoxRow — fragile ↔ maxLoad (D-08 / BOX-03)', () => {
  test('toggling Fragile ON disables the max-load input and sets it to 0', async () => {
    const user = userEvent.setup();
    render(<Harness box={{ maxLoad: 90, fragile: false }} />);

    const maxLoad = screen.getByLabelText('Max load on top') as HTMLInputElement;
    expect(maxLoad).not.toBeDisabled();
    expect(maxLoad.value).toBe('90');

    await user.click(screen.getByRole('switch', { name: /Fragile/ }));

    expect(maxLoad).toBeDisabled();
    expect(maxLoad.value).toBe('0');
  });

  test('toggling Fragile OFF restores the prior max-load value', async () => {
    const user = userEvent.setup();
    render(<Harness box={{ maxLoad: 90, fragile: false }} />);

    const maxLoad = screen.getByLabelText('Max load on top') as HTMLInputElement;
    const sw = screen.getByRole('switch', { name: /Fragile/ });

    await user.click(sw); // ON → stash 90, zero
    expect(maxLoad.value).toBe('0');

    await user.click(sw); // OFF → restore 90
    expect(maxLoad).not.toBeDisabled();
    expect(maxLoad.value).toBe('90');
  });
});

describe('BoxRow — rotation control (BOX-04 / C-03)', () => {
  test('offers exactly two options and "Fixed" is gone from the UI (#3)', () => {
    render(<Harness box={{ rotation: 'free' }} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Any orientation' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Keep this side up' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Fixed' })).not.toBeInTheDocument();
  });

  test('selecting a rotation segment updates the rotation value', async () => {
    const user = userEvent.setup();
    render(<Harness box={{ rotation: 'free' }} />);

    expect(screen.getByRole('radio', { name: 'Any orientation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByRole('radio', { name: 'Keep this side up' }));

    expect(screen.getByRole('radio', { name: 'Keep this side up' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });
});

describe('BoxRow — dimensions layout + no id chip (#4 / #6)', () => {
  test('renders three separate Length / Width / Height fields (no "Dimensions")', () => {
    render(<Harness box={{ length: 400, width: 300, height: 250 }} />);
    expect(screen.getByLabelText('Length')).toBeInTheDocument();
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dimensions')).not.toBeInTheDocument();
    // Weight is retained (moved out of the dims row, not dropped).
    expect(screen.getByLabelText('Weight / unit')).toBeInTheDocument();
  });

  test('does not render the visible id chip but keeps the hidden id input registered', () => {
    const { container } = render(<Harness box={{ id: 'btest' }} />);
    // No visible id text in the row head.
    expect(screen.queryByText('btest')).not.toBeInTheDocument();
    // The hidden id input is still registered (drives the swatch colour + request ids).
    const hiddenId = container.querySelector('input[type="hidden"][name="boxTypes.0.id"]');
    expect(hiddenId).not.toBeNull();
  });
});

describe('BoxRow — accessible remove button (UI-SPEC §Accessibility)', () => {
  test('remove button carries aria-label="Remove {label}" and fires onRemove', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Harness box={{ label: 'Carton A' }} onRemove={onRemove} />);

    const btn = screen.getByRole('button', { name: 'Remove Carton A' });
    await user.click(btn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('remove button falls back to "Remove box type" when the label is empty', () => {
    render(<Harness box={{ label: '' }} />);
    expect(screen.getByRole('button', { name: 'Remove box type' })).toBeInTheDocument();
  });
});
