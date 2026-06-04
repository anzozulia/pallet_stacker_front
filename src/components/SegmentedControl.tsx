// Generic 3-mode segmented control with radio-group semantics (C-03 / UI-SPEC
// §Accessibility / §Interaction Contracts). Replaces the mockup's 6-chip rotation UI
// with three mutually-exclusive segments — exactly one selected at all times. The
// selected segment uses --accent-weak bg + --accent-text text. Keyboard contract:
// arrow keys move selection between segments (wrapping), Home/End jump to first/last,
// and the segments use a roving tabindex so the group is a single Tab stop. Used for the
// box-row `Allowed rotation` control (BOX-04) with the RotationMode union.
//
// Code-split gate (C-05): imports ONLY React + clsx — never three/r3f/drei or any viewer
// module, so it stays in the eager `/` chunk.
import { useRef } from 'react';
import clsx from 'clsx';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
};

export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function selectAt(index: number) {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    refs.current[index]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        selectAt(index === last ? 0 : index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        selectAt(index === 0 ? last : index - 1);
        break;
      case 'Home':
        e.preventDefault();
        selectAt(0);
        break;
      case 'End':
        e.preventDefault();
        selectAt(last);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx('inline-flex flex-wrap gap-2', className)}
    >
      {options.map((opt, index) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={clsx(
              'cursor-pointer select-none rounded-[var(--radius-sm)] border px-3 py-1.5 font-mono text-xs transition-[color,background-color,border-color] duration-150',
              selected
                ? 'border-accent bg-accent-weak text-accent-text'
                : 'border-border-strong bg-surface text-text-2',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
