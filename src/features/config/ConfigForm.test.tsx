import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the assembled
// Configure screen's Run gate + error timing + D-08 unsent fields. `@/` resolves via Vitest.
// localStorage is cleared before each test so restore-on-mount always seeds DEFAULT_CONFIG
// (the EUR-pallet seed is business-valid and its default box fits the pallet).
import ConfigForm from '@/features/config/ConfigForm';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Both Run CTAs (topbar + footer) submit the same handler; the footer one is unambiguous.
function footerRunButton() {
  const buttons = screen.getAllByRole('button', { name: /Run packing/ });
  return buttons[buttons.length - 1];
}

describe('ConfigForm — Run gate (D-06)', () => {
  test('a cleared required pallet field blocks Run and logs nothing (D-02/D-04)', async () => {
    const user = userEvent.setup();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ConfigForm />);

    // Clear the pallet Length input (a required mm field).
    const length = screen.getByLabelText('Length');
    await user.clear(length);

    await user.click(footerRunButton());

    expect(await screen.findByText('Required')).toBeInTheDocument();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('an empty catalog blocks Run with "Add at least one box type" (D-02)', async () => {
    const user = userEvent.setup();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ConfigForm />);

    // Remove the single default box type → empty catalog.
    await user.click(screen.getByRole('button', { name: /^Remove / }));

    await user.click(footerRunButton());

    expect(await screen.findByText('Add at least one box type')).toBeInTheDocument();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('a box too big for the pallet blocks Run with an inline fit message (D-01/BOX-06)', async () => {
    const user = userEvent.setup();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ConfigForm />);

    // Make the box's length 5000mm — too big for the 1200×800×1800 deck in EVERY allowed
    // orientation (any footprint placement leaves the 5000mm extent exceeding a deck/height
    // bound). The box-row "Dimensions" field binds `length`.
    const dims = screen.getByLabelText('Dimensions');
    await user.clear(dims);
    await user.type(dims, '5000');

    await user.click(footerRunButton());

    expect(
      await screen.findByText(/cannot fit the pallet in any allowed orientation/),
    ).toBeInTheDocument();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('a valid config logs a PackRequest with NO maxLoad/fragile box keys (D-06/D-08)', async () => {
    const user = userEvent.setup();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ConfigForm />);

    // DEFAULT_CONFIG is business-valid and its default box fits the EUR pallet — Run as-is.
    await user.click(footerRunButton());

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [, payload] = logSpy.mock.calls[0] as [string, string];
    const request = JSON.parse(payload) as { boxes: Record<string, unknown>[] };
    expect(request.boxes.length).toBeGreaterThan(0);
    expect(request.boxes[0]).not.toHaveProperty('maxLoad');
    expect(request.boxes[0]).not.toHaveProperty('fragile');
  });
});

describe('ConfigForm — Run disabled while invalid (D-06)', () => {
  test('Run becomes disabled after a failed submit', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ConfigForm />);

    const length = screen.getByLabelText('Length');
    await user.clear(length);
    await user.click(footerRunButton());

    // After the failed submit the form is known-invalid → Run disabled (D-06).
    expect(footerRunButton()).toBeDisabled();
  });
});

// Guard: the rendered shell is the real assembled screen, not the placeholder.
describe('ConfigForm — shell (D-05)', () => {
  test('renders the page H1 and both cards', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<ConfigForm />);
    expect(screen.getByRole('heading', { name: 'Packing task' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading');
    const titles = headings.map((h) => h.textContent);
    expect(titles).toContain('Pallet configuration');
    expect(titles).toContain('Box catalog');
    // within() import kept meaningful: assert the footer total renders.
    const main = screen.getByRole('main');
    expect(within(main).getByText(/box types · .* units · est\. .* kg/)).toBeInTheDocument();
  });
});
