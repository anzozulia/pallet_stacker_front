import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the pallet-card
// field-binding contract (PALLET-01/02): the dims + limits fields render with their labels and
// bind through RHF `register`, Max overhang is gated behind an Allow-overhang switch (default
// OFF → 0, disabled), there is NO Max pallets field, and NO CoG-envelope field (C-04). `@/`
// resolves via Vitest.
import type { PackConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/features/config/defaults';
import PalletCard from '@/features/config/PalletCard';

// RHF wrapper seeded from DEFAULT_CONFIG (EUR-pallet defaults) — mirrors the real form. A
// hidden probe surfaces the live form values so a test can assert a field actually binds.
function Harness() {
  const methods = useForm<PackConfig>({ defaultValues: DEFAULT_CONFIG });
  return (
    <FormProvider {...methods}>
      <PalletCard />
      <Probe />
    </FormProvider>
  );
}

function Probe() {
  const length = useWatch<PackConfig>({ name: 'pallet.length' });
  const maxOverhang = useWatch<PackConfig>({ name: 'pallet.maxOverhang' });
  return (
    <>
      <output data-testid="probe-length">{String(length)}</output>
      <output data-testid="probe-maxOverhang">{String(maxOverhang)}</output>
    </>
  );
}

describe('PalletCard — fields render + bind (PALLET-01/02)', () => {
  test('renders the dimensions + limits fields with their labels', () => {
    render(<Harness />);
    // Dimensions
    expect(screen.getByLabelText('Length')).toBeInTheDocument();
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Max stack height')).toBeInTheDocument();
    // Limits — Max weight + the switch-gated Max overhang. NO Max pallets field.
    expect(screen.getByLabelText('Max weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Max overhang')).toBeInTheDocument();
    expect(screen.queryByLabelText('Max pallets')).toBeNull();
  });

  test('seeds inputs from DEFAULT_CONFIG (controlled from birth)', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Length')).toHaveValue(DEFAULT_CONFIG.pallet.length);
    expect(screen.getByLabelText('Max weight')).toHaveValue(DEFAULT_CONFIG.pallet.maxWeight);
  });

  test('editing a dimension field updates the bound form value (register)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const length = screen.getByLabelText('Length');
    await user.clear(length);
    await user.type(length, '1500');

    expect(screen.getByTestId('probe-length')).toHaveTextContent('1500');
  });
});

describe('PalletCard — Allow-overhang switch gates Max overhang (#3)', () => {
  test('default OFF: the overhang input is disabled and shows 0', () => {
    render(<Harness />);
    const overhang = screen.getByLabelText('Max overhang');
    expect(overhang).toBeDisabled();
    expect(overhang).toHaveValue(0);
    expect(screen.getByRole('switch', { name: 'Allow overhang' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('toggling ON enables the overhang input (restores a positive value)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const toggle = screen.getByRole('switch', { name: 'Allow overhang' });
    await user.click(toggle);

    const overhang = screen.getByLabelText('Max overhang');
    expect(overhang).toBeEnabled();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    // Restores the per-session fallback (40 mm) when enabled from the default 0.
    expect(screen.getByTestId('probe-maxOverhang')).toHaveTextContent('40');
  });

  test('toggling ON then OFF zeroes + disables the overhang input again', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const toggle = screen.getByRole('switch', { name: 'Allow overhang' });
    await user.click(toggle); // ON
    await user.click(toggle); // OFF

    const overhang = screen.getByLabelText('Max overhang');
    expect(overhang).toBeDisabled();
    expect(screen.getByTestId('probe-maxOverhang')).toHaveTextContent('0');
  });
});

describe('PalletCard — no CoG-envelope field (C-04)', () => {
  test('no "CoG" text or field is rendered', () => {
    render(<Harness />);
    expect(screen.queryByText(/CoG/i)).toBeNull();
    expect(screen.queryByLabelText(/CoG/i)).toBeNull();
  });
});
