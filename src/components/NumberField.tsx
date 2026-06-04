// Hand-built labelled number-input primitive (UI-SPEC §Typography/§Color/§Copywriting).
// Renders a 600-weight label, a mono 13px <input> inside an `input-affix` with an
// optional mono 12px unit suffix (mm / kg / pcs), an optional hint, and — when `error`
// is set — a --color-danger 12px message line below. Focus-within ring: accent border
// + 3px --accent-weak glow. Used by the Pallet card (PALLET-01) and Box rows (BOX-04).
//
// Code-split gate (C-05 / Pitfall 1): imports ONLY React + clsx — never three/r3f/drei
// or any viewer module, so it stays in the eager `/` chunk.
import clsx from 'clsx';

/**
 * Pass-through input props are spread onto the <input> so RHF `register(name)` works
 * directly (`<NumberField {...register('pallet.length')} />`). `label` is required;
 * `unit` / `hint` / `error` are optional presentation slots.
 */
type NumberFieldProps = {
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
} & React.ComponentProps<'input'>;

export default function NumberField({
  label,
  unit,
  hint,
  error,
  className,
  id,
  ...inputProps
}: NumberFieldProps) {
  const hasError = Boolean(error);
  // Stable association for label/error/hint so screen readers announce them.
  const inputId = id ?? inputProps.name;
  const hintId = inputId ? `${inputId}-hint` : undefined;
  const errorId = inputId ? `${inputId}-error` : undefined;
  const describedBy =
    [hasError ? errorId : undefined, hint ? hintId : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-xs font-semibold text-text-2">
        {label}
      </label>
      <div
        className={clsx(
          'flex items-center overflow-hidden rounded-[var(--radius-sm)] border bg-surface transition-[border-color,box-shadow] duration-150',
          'focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-weak)]',
          hasError ? 'border-danger' : 'border-border-strong',
        )}
      >
        <input
          {...inputProps}
          id={inputId}
          type={inputProps.type ?? 'number'}
          inputMode={inputProps.inputMode ?? 'numeric'}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className="w-full border-0 bg-transparent px-3 py-2.5 font-mono text-[13px] text-text outline-none"
        />
        {unit ? (
          <span className="flex items-center self-stretch border-l border-border bg-surface-2 px-3 font-mono text-xs text-text-3">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <span id={hintId} className="text-xs text-text-3">
          {hint}
        </span>
      ) : null}
      {hasError ? (
        <span id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
