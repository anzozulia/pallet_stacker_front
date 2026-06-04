import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the pallet-card
// field-binding contract (PALLET-01/02, PACK-03): the six dims+limits fields render with
// their labels and bind through RHF `register`, Max pallets lives in the Limits group
// (D-10), and NO CoG-envelope field is present (C-04). `@/` resolves via Vitest.
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
  const maxPallets = useWatch<PackConfig>({ name: 'maxPallets' });
  return (
    <>
      <output data-testid="probe-length">{String(length)}</output>
      <output data-testid="probe-maxPallets">{String(maxPallets)}</output>
    </>
  );
}

describe('PalletCard — fields render + bind (PALLET-01/02, PACK-03)', () => {
  test('renders the six dimensions + limits fields with their labels', () => {
    render(<Harness />);
    // Dimensions
    expect(screen.getByLabelText('Length')).toBeInTheDocument();
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Max stack height')).toBeInTheDocument();
    // Limits (Max pallets replaces the mockup's CoG envelope — D-10)
    expect(screen.getByLabelText('Max weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Max overhang')).toBeInTheDocument();
    expect(screen.getByLabelText('Max pallets')).toBeInTheDocument();
  });

  test('seeds inputs from DEFAULT_CONFIG (controlled from birth)', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Length')).toHaveValue(DEFAULT_CONFIG.pallet.length);
    expect(screen.getByLabelText('Max weight')).toHaveValue(DEFAULT_CONFIG.pallet.maxWeight);
    expect(screen.getByLabelText('Max pallets')).toHaveValue(DEFAULT_CONFIG.maxPallets);
  });

  test('editing a dimension field updates the bound form value (register)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const length = screen.getByLabelText('Length');
    await user.clear(length);
    await user.type(length, '1500');

    expect(screen.getByTestId('probe-length')).toHaveTextContent('1500');
  });

  test('editing Max pallets updates the bound maxPallets value (D-10/PACK-03)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const maxPallets = screen.getByLabelText('Max pallets');
    await user.clear(maxPallets);
    await user.type(maxPallets, '5');

    expect(screen.getByTestId('probe-maxPallets')).toHaveTextContent('5');
  });
});

describe('PalletCard — no CoG-envelope field (C-04)', () => {
  test('no "CoG" text or field is rendered', () => {
    render(<Harness />);
    expect(screen.queryByText(/CoG/i)).toBeNull();
    expect(screen.queryByLabelText(/CoG/i)).toBeNull();
  });
});
