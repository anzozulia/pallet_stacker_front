import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the catalog
// CRUD + badge contract (BOX-01/05): Add box type increments the rendered rows, Remove
// decrements them, removing the last row reveals the empty-catalog state, and the badge
// reflects the live type/unit counts. `@/` resolves via Vitest.
import type { PackConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/features/config/defaults';
import BoxCatalogCard from '@/features/config/BoxCatalogCard';

// RHF wrapper seeded from DEFAULT_CONFIG (one default box type) — mirrors the real form.
function Harness() {
  const methods = useForm<PackConfig>({ defaultValues: DEFAULT_CONFIG });
  return (
    <FormProvider {...methods}>
      <BoxCatalogCard />
    </FormProvider>
  );
}

// Rows are identified by their remove button (one per row, aria-label "Remove …").
function rowCount() {
  return screen.queryAllByRole('button', { name: /^Remove / }).length;
}

describe('BoxCatalogCard — add / remove (BOX-01)', () => {
  test('clicking "Add box type" increases the row count by one', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(rowCount()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Add box type' }));
    expect(rowCount()).toBe(2);
  });

  test('clicking a row remove decreases the row count by one', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add box type' }));
    expect(rowCount()).toBe(2);

    const removeButtons = screen.getAllByRole('button', { name: /^Remove / });
    await user.click(removeButtons[0]);
    expect(rowCount()).toBe(1);
  });

  test('removing the last row reveals the empty-catalog state', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(rowCount()).toBe(1);

    await user.click(screen.getByRole('button', { name: /^Remove / }));

    expect(rowCount()).toBe(0);
    expect(screen.getByText('No box types yet')).toBeInTheDocument();
    expect(screen.getByText('Add at least one box type to run the packer.')).toBeInTheDocument();
  });
});

describe('BoxCatalogCard — live badge (BOX-05)', () => {
  test('badge reflects the live type/unit counts and updates on add', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // DEFAULT_CONFIG: 1 type · 10 units (makeDefaultBoxType quantity = 10).
    expect(screen.getByText('1 types · 10 units')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add box type' }));
    // 2 types · 20 units (each default row carries quantity 10).
    expect(screen.getByText('2 types · 20 units')).toBeInTheDocument();
  });
});
