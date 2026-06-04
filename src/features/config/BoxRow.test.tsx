import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the box-row
// per-type contract (BOX-03/04 / D-08): fragile ON disables + zeroes max-load, OFF
// restores the prior value, the rotation segmented control sets one of the 3 modes, and
// the remove button carries the interpolated `aria-label`. `@/` resolves via Vitest.
import type { BoxType, PackConfig } from '@/types/config';
import { makeDefaultBoxType } from '@/features/config/defaults';
import BoxRow from '@/features/config/BoxRow';

// Minimal RHF wrapper providing a single box type so BoxRow's useFormContext works.
function Harness({ box, onRemove = () => {} }: { box?: Partial<BoxType>; onRemove?: () => void }) {
  const seed: BoxType = { ...makeDefaultBoxType(), id: 'btest', label: 'Carton A', ...box };
  const methods = useForm<PackConfig>({
    defaultValues: { pallet: {} as PackConfig['pallet'], boxTypes: [seed], maxPallets: 1 },
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
  test('selecting a rotation segment updates the rotation value', async () => {
    const user = userEvent.setup();
    render(<Harness box={{ rotation: 'free' }} />);

    expect(screen.getByRole('radio', { name: 'Any orientation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByRole('radio', { name: 'Fixed' }));

    expect(screen.getByRole('radio', { name: 'Fixed' })).toHaveAttribute('aria-checked', 'true');
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
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
