import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the
// Switch accessibility + interaction contract (role=switch, aria-checked, toggle,
// disabled). `@/` alias proves tsconfigPaths resolves in Vitest. Matchers (jest-dom)
// are wired in src/test/setup.ts.
import Switch from '@/components/Switch';

describe('Switch — role=switch + accessible name (UI-SPEC §Accessibility)', () => {
  test('renders role=switch with its visible label as the accessible name', () => {
    render(<Switch checked={false} onChange={() => {}} label="Allow overhang" />);
    const sw = screen.getByRole('switch', { name: 'Allow overhang' });
    expect(sw).toBeInTheDocument();
  });

  test('aria-checked reflects the checked prop', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} label="Fragile" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    rerender(<Switch checked onChange={() => {}} label="Fragile" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Switch — toggle interaction', () => {
  test('clicking calls onChange with the negated value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Fragile" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('clicking an ON switch calls onChange(false)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Fragile" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('Space and Enter toggle the switch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Fragile" />);
    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
  });
});

describe('Switch — disabled blocks toggling', () => {
  test('disabled switch does not call onChange on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Fragile" disabled />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
