// Accessible on/off toggle primitive (UI-SPEC §Accessibility / §Interaction Contracts).
// A controlled `role="switch"` button: `aria-checked` reflects `checked`, the accessible
// name comes from the visible `label`, the ON track fills with --color-accent, and a
// `size` prop picks the named track constants (full 38x22 / sm 32x18). Toggles on click
// and on Space/Enter; `disabled` blocks the toggle and applies muted styling. Used by the
// Pallet "Allow overhang" toggle and the per-row Fragile toggle (D-08 / BOX-04).
//
// Code-split gate (C-05): imports ONLY React + clsx — never three/r3f/drei or any viewer
// module, so it stays in the eager `/` chunk.
import clsx from 'clsx';

type SwitchProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  size?: 'full' | 'sm';
  disabled?: boolean;
  className?: string;
};

// Named track-size constants (UI-SPEC §Named Component Constants) — fixed chrome
// dimensions, NOT spacing-scale values. [trackW, trackH, thumb, travel] in px.
const TRACK = {
  full: { w: 38, h: 22, thumb: 18, travel: 16 },
  sm: { w: 32, h: 18, thumb: 14, travel: 14 },
} as const;

export default function Switch({
  checked,
  onChange,
  label,
  size = 'full',
  disabled = false,
  className,
}: SwitchProps) {
  const t = TRACK[size];

  function toggle() {
    if (disabled) return;
    onChange(!checked);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      style={{ width: t.w, height: t.h }}
      className={clsx(
        'relative inline-flex flex-none items-center rounded-full transition-[background-color] duration-150',
        checked ? 'bg-accent' : 'bg-[#d6d8de]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span
        aria-hidden="true"
        style={{
          width: t.thumb,
          height: t.thumb,
          transform: checked ? `translateX(${t.travel}px)` : 'translateX(0)',
        }}
        className="absolute left-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-150"
      />
    </button>
  );
}
