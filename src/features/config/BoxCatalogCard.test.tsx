import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the catalog
// CRUD + badge contract (BOX-01/05): Add box type increments the rendered rows, Remove
// decrements them, removing the last row reveals the empty-catalog state, and the badge
// reflects the live type/unit counts. `@/` resolves via Vitest.
import type { PackConfig } from '@/types/config';
import { DEFAULT_CONFIG } from '@/features/config/defaults';
import { tallyCatalog } from '@/lib/config-tally';
import { buildPackRequest } from '@/lib/request-builder';
import BoxCatalogCard from '@/features/config/BoxCatalogCard';
import FooterBar from '@/features/config/FooterBar';

// RHF wrapper seeded from DEFAULT_CONFIG (one default box type) — mirrors the real form.
function Harness() {
  const methods = useForm<PackConfig>({ defaultValues: DEFAULT_CONFIG });
  return (
    <FormProvider {...methods}>
      <BoxCatalogCard />
    </FormProvider>
  );
}

// Integration harness for the #5/#8 desync regression: mounts the catalog rows + the footer
// inside ONE form and exposes the form instance so the test can read the SAME live `boxTypes`
// the cards display through `tallyCatalog` AND `buildPackRequest` — the three views that must
// agree (displayed rows ≡ tallied units ≡ built-request units).
function DesyncHarness({ onForm }: { onForm: (f: UseFormReturn<PackConfig>) => void }) {
  const methods = useForm<PackConfig>({ defaultValues: DEFAULT_CONFIG });
  onForm(methods);
  return (
    <FormProvider {...methods}>
      <div data-tb="catalog">
        <BoxCatalogCard />
      </div>
      <div data-tb="footer">
        <FooterBar onRun={() => {}} onSaveDraft={() => {}} />
      </div>
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

describe('BoxCatalogCard — default box-type numbering (#7)', () => {
  test('the seeded first type is "Box type 1" and a newly-added type is "Box type 2"', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // The seeded DEFAULT_CONFIG box type reads "Box type 1".
    const names = () =>
      screen.getAllByLabelText('Box type name').map((i) => (i as HTMLInputElement).value);
    expect(names()).toEqual(['Box type 1']);

    await user.click(screen.getByRole('button', { name: 'Add box type' }));
    // Numbered by additions: the new row is "Box type 2".
    expect(names()).toEqual(['Box type 1', 'Box type 2']);
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

// The #5/#8 data-integrity regression. ROOT CAUSE: RHF stores EDITED numeric `<input>` values as
// STRINGS (e.g. `"25"`), while the seeded defaults are real numbers. `tallyCatalog` used
// `Number.isFinite(value)`, which is `false` for the string `"25"`, so every edited quantity/weight
// silently dropped to 0 in the displayed badge/footer — even though the submit path (zod /
// buildPackRequest) coerces the same string to 25. The displayed counters therefore diverged from
// what actually gets packed (#8), and stale-looked on nested edits (#5). The fix coerces the tally
// the SAME way the request builder does. This test pins the invariant across an add/remove/edit
// sequence: displayed rows ≡ tallied types/units ≡ built-request types/units. (It FAILS on the
// pre-fix code — the edited row counts 0 units in the tally while buildPackRequest expands the real
// count, so `tally.units !== request.boxes.length`.)
describe('BoxCatalogCard + FooterBar — displayed ≡ tallied ≡ submitted (#5/#8 desync)', () => {
  test('rows, badge, footer, and the built request agree after add/remove/edit', async () => {
    const user = userEvent.setup();
    let form!: UseFormReturn<PackConfig>;
    const { container } = render(<DesyncHarness onForm={(f) => (form = f)} />);

    const catalog = container.querySelector('[data-tb="catalog"]') as HTMLElement;
    const footer = container.querySelector('[data-tb="footer"]') as HTMLElement;
    const displayedRows = () =>
      within(catalog).queryAllByRole('button', { name: /^Remove / }).length;
    const badgeText = () => catalog.textContent?.match(/(\d+) types · (\d+) units/);
    const footerText = () => footer.textContent?.match(/(\d+) box types · (\d+) units/);

    // Drive a rapid add / edit / remove / add sequence touching a NON-tail index.
    await user.click(screen.getByRole('button', { name: 'Add box type' })); // 2 rows
    await user.click(screen.getByRole('button', { name: 'Add box type' })); // 3 rows
    expect(displayedRows()).toBe(3);

    // Edit the MIDDLE row's quantity (index 1) — turns its value into the string "7".
    const quantities = within(catalog).getAllByLabelText('Quantity');
    await user.clear(quantities[1]);
    await user.type(quantities[1], '7');

    // Edit the FIRST row's weight too (string "2.5") — exercises the estKg coercion path.
    const weights = within(catalog).getAllByLabelText('Weight / unit');
    await user.clear(weights[0]);
    await user.type(weights[0], '2.5');

    // Remove the middle row (the one we just edited) — non-tail removal.
    const removes = within(catalog).getAllByRole('button', { name: /^Remove / });
    await user.click(removes[1]);
    expect(displayedRows()).toBe(2);

    // Add one more and edit its quantity ("13").
    await user.click(screen.getByRole('button', { name: 'Add box type' }));
    expect(displayedRows()).toBe(3);
    const quantities2 = within(catalog).getAllByLabelText('Quantity');
    await user.clear(quantities2[2]);
    await user.type(quantities2[2], '13');

    // ---- THE INVARIANT: three views derived from ONE live source must agree ----
    const values = form.getValues();
    const tally = tallyCatalog(values.boxTypes);
    const { request } = buildPackRequest(values);

    const rows = displayedRows();
    const builtUnits = request.boxes.length;
    const builtTypes = new Set(request.boxes.map((b) => b.id.replace(/-\d+$/, ''))).size;

    // Displayed rows ≡ tallied types ≡ built-request types.
    expect(tally.types).toBe(rows);
    expect(builtTypes).toBe(rows);

    // Tallied units ≡ built-request units (the heart of the #8 fix — edited string fields count).
    expect(tally.units).toBe(builtUnits);

    // Badge + footer (both `useWatch`-driven) render the SAME tallied numbers.
    const badge = badgeText();
    const foot = footerText();
    expect(badge).not.toBeNull();
    expect(foot).not.toBeNull();
    expect(Number(badge![1])).toBe(tally.types);
    expect(Number(badge![2])).toBe(tally.units);
    expect(Number(foot![1])).toBe(tally.types);
    expect(Number(foot![2])).toBe(tally.units);

    // Concretely, after the sequence the surviving rows are row1 (qty 10), row3 (untouched qty 10),
    // and the freshly-added row (edited to 13) — the qty-7 middle row was removed: 10 + 10 + 13 = 33
    // units across 3 types. On the PRE-FIX tally these 33 collapse to 20 (the edited string rows
    // count 0), which is exactly the displayed-vs-submitted divergence this test guards against.
    expect(rows).toBe(3);
    expect(tally.units).toBe(33);
    expect(builtUnits).toBe(33);
  });
});
