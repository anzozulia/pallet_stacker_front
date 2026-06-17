import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the assembled
// Configure screen's Run gate + error timing + D-08 unsent fields. `@/` resolves via Vitest.
// localStorage is cleared before each test so restore-on-mount always seeds DEFAULT_CONFIG
// (the EUR-pallet seed is business-valid and its default box fits the pallet).
//
// Plan 05-03 seam swap (C-05): onValid now `navigate('/loading', { state: { request, idToType } })`
// instead of console.log. `useNavigate` is spied so the Run gate is asserted via the navigation
// INTENT — a blocked Run must NOT navigate, a valid Run navigates carrying the built PackRequest.
import type { PackRequest } from '@/types/pack-contract';
import ConfigForm from '@/features/config/ConfigForm';

const navigateSpy = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateSpy };
});

beforeEach(() => {
  localStorage.clear();
  navigateSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderForm() {
  return render(
    <MemoryRouter>
      <ConfigForm />
    </MemoryRouter>,
  );
}

// The footer owns the single Run CTA (#1 removed the duplicate topbar button).
function footerRunButton() {
  return screen.getByRole('button', { name: /Run packing/ });
}

// PalletCard and BoxRow now BOTH have a "Length" field (#4), so getByLabelText('Length') is
// ambiguous — target each by its bound input name instead.
function inputByName(name: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!el) throw new Error(`no input named ${name}`);
  return el;
}

describe('ConfigForm — Run gate (D-06)', () => {
  test('a cleared required pallet field blocks Run and navigates nowhere (D-02/D-04)', async () => {
    const user = userEvent.setup();
    renderForm();

    // Clear the pallet Length input (a required mm field).
    const length = inputByName('pallet.length');
    await user.clear(length);

    await user.click(footerRunButton());

    expect(await screen.findByText('Required')).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  test('an empty catalog blocks Run with "Add at least one box type" (D-02)', async () => {
    const user = userEvent.setup();
    renderForm();

    // Remove the single default box type → empty catalog.
    await user.click(screen.getByRole('button', { name: /^Remove / }));

    await user.click(footerRunButton());

    expect(await screen.findByText('Add at least one box type')).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  test('a box too big for the pallet blocks Run with an inline fit message (D-01/BOX-06)', async () => {
    const user = userEvent.setup();
    renderForm();

    // Make the box's length 5000mm — too big for the 1200×800×1800 deck in EVERY allowed
    // orientation (any footprint placement leaves the 5000mm extent exceeding a deck/height
    // bound). The box-row "Length" field (#4, formerly "Dimensions") binds `length`.
    const dims = inputByName('boxTypes.0.length');
    await user.clear(dims);
    await user.type(dims, '5000');

    await user.click(footerRunButton());

    expect(
      await screen.findByText(/cannot fit the pallet in any allowed orientation/),
    ).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  test('a valid config navigates to /loading with a PackRequest carrying NO maxLoad/fragile box keys (D-06/D-08)', async () => {
    const user = userEvent.setup();
    renderForm();

    // DEFAULT_CONFIG is business-valid and its default box fits the EUR pallet — Run as-is.
    await user.click(footerRunButton());

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const [path, opts] = navigateSpy.mock.calls[0] as [
      string,
      { state: { request: PackRequest; idToType: Map<string, string> } },
    ];
    expect(path).toBe('/loading');
    const { request, idToType } = opts.state;
    expect(request.boxes.length).toBeGreaterThan(0);
    expect(request.boxes[0]).not.toHaveProperty('maxLoad');
    expect(request.boxes[0]).not.toHaveProperty('fragile');
    // idToType rides along for the /result type recovery (C-05).
    expect(idToType).toBeInstanceOf(Map);
    expect(idToType.size).toBe(request.boxes.length);
  });
});

describe('ConfigForm — Run disabled while invalid (D-06)', () => {
  test('Run becomes disabled after a failed submit', async () => {
    const user = userEvent.setup();
    renderForm();

    const length = inputByName('pallet.length');
    await user.clear(length);
    await user.click(footerRunButton());

    // After the failed submit the form is known-invalid → Run disabled (D-06).
    expect(footerRunButton()).toBeDisabled();
  });
});

describe('ConfigForm — demo presets', () => {
  test('renders the 4-preset picker', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /Office supply cartons/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Distribution-centre mix/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stationery & archive boxes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wholesale grocery cases/ })).toBeInTheDocument();
  });

  test('clicking a preset re-seeds the form (fixed pallet + that preset catalog)', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /Distribution-centre mix/ }));

    // RHF reset is async to the inputs — wait for the re-render to settle.
    await waitFor(() => {
      expect(inputByName('pallet.length').value).toBe('1200');
    });
    expect(inputByName('pallet.width').value).toBe('800');
    expect(inputByName('pallet.height').value).toBe('1800');

    // The catalog now holds exactly the preset's 3 box-type labels (replacing the default).
    const nameInputs = screen.getAllByLabelText('Box type name') as HTMLInputElement[];
    expect(nameInputs).toHaveLength(3);
    const values = nameInputs.map((i) => i.value);
    expect(values).toContain('Master carton (tall)');
    expect(values).toContain('Case box');
    expect(values).toContain('Square tote');
  });
});

// Guard: the rendered shell is the real assembled screen, not the placeholder.
describe('ConfigForm — shell (D-05)', () => {
  test('renders the page H1 and both cards', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Packing task' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading');
    const titles = headings.map((h) => h.textContent);
    expect(titles).toContain('Pallet configuration');
    expect(titles).toContain('Box catalog');
    // The footer is now a full-width sibling of <main> (#1), so it renders OUTSIDE main —
    // assert the tally at the page-document level.
    expect(screen.getByText(/box types · .* units · est\. .* kg/)).toBeInTheDocument();
  });
});
