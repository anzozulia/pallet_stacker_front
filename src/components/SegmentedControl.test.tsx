import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
// jsdom-WebGL-free component test (Pitfall 2): no Canvas/three import. Pins the
// SegmentedControl radio-group contract (C-03): exactly one selected segment, change
// emits the chosen value, arrow-key navigation moves selection. Exercised with the
// RotationMode options it will carry in the box row. `@/` alias resolves via Vitest.
import type { RotationMode } from '@/types/config';
import SegmentedControl from '@/components/SegmentedControl';

const OPTIONS: { value: RotationMode; label: string }[] = [
  { value: 'free', label: 'Any orientation' },
  { value: 'uprightOnly', label: 'Keep this side up' },
  { value: 'fixed', label: 'Fixed' },
];

describe('SegmentedControl — radio-group semantics (C-03 / UI-SPEC §Accessibility)', () => {
  test('renders a radiogroup with one radio per option and exactly one selected', () => {
    render(
      <SegmentedControl
        value="free"
        options={OPTIONS}
        onChange={() => {}}
        ariaLabel="Allowed rotation"
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Allowed rotation' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Any orientation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('selection is always exactly one as value changes', () => {
    const { rerender } = render(
      <SegmentedControl value="free" options={OPTIONS} onChange={() => {}} />,
    );
    expect(screen.getByRole('radio', { name: 'Any orientation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    rerender(<SegmentedControl value="fixed" options={OPTIONS} onChange={() => {}} />);
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Fixed' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('SegmentedControl — change interaction', () => {
  test('clicking a segment calls onChange with that segment value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl value="free" options={OPTIONS} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Keep this side up' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('uprightOnly');
  });

  test('ArrowRight moves selection to the next segment (and wraps)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl value="free" options={OPTIONS} onChange={onChange} />);
    screen.getByRole('radio', { name: 'Any orientation' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('uprightOnly');
  });

  test('ArrowLeft from the first segment wraps to the last', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl value="free" options={OPTIONS} onChange={onChange} />);
    screen.getByRole('radio', { name: 'Any orientation' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('fixed');
  });

  test('only the selected segment is in the tab order (roving tabindex)', () => {
    render(<SegmentedControl value="uprightOnly" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Keep this side up' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('radio', { name: 'Any orientation' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
    expect(screen.getByRole('radio', { name: 'Fixed' })).toHaveAttribute('tabindex', '-1');
  });
});
