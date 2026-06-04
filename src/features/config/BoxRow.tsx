// One editable box-type catalog row (BOX-01/02/03/04). Renders the stable per-type
// colour swatch (13×13, derived from colorForType keyed by this row's id), an editable
// `label` name input, the read-only id-tag, an accessible trash remove button, the
// L/W/H/weight/quantity/max-load number fields, the Fragile toggle, and the 3-mode
// `Allowed rotation` segmented control.
//
// Numeric fields are bound via `register` and left as strings on the form — the zod
// schema coerces them (Pattern 1). Every field is seeded by makeDefaultBoxType() so the
// inputs stay controlled-from-birth (Pitfall 6). The fragile↔maxLoad interaction
// (Pattern 4 / D-08) stashes the prior max-load in a per-session ref: ON zeroes+disables
// max-load, OFF restores the stashed value (falling back to the default after a reload
// where the prior value is genuinely unknown).
//
// Code-split gate (C-05): imports ONLY React, RHF, clsx, @/components/*, @/lib/palette,
// @/features/config/defaults, and @/types/config — never three/r3f/drei or any viewer
// module, so it stays in the eager `/` chunk.
import { useRef } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import clsx from 'clsx';
import NumberField from '@/components/NumberField';
import SegmentedControl from '@/components/SegmentedControl';
import Switch from '@/components/Switch';
import { colorForType } from '@/lib/palette';
import { makeDefaultBoxType } from '@/features/config/defaults';
import type { PackConfig, RotationMode } from '@/types/config';

const ROTATION_OPTIONS: { value: RotationMode; label: string }[] = [
  { value: 'free', label: 'Any orientation' },
  { value: 'uprightOnly', label: 'Keep this side up' },
  { value: 'fixed', label: 'Fixed' },
];

type BoxRowProps = {
  /** This row's position in the `boxTypes` field array. */
  index: number;
  /** Every current box-type id — passed once to colorForType so the swatch is stable. */
  allIds: string[];
  /** Remove this row from the field array. */
  onRemove: () => void;
};

export default function BoxRow({ index, allIds, onRemove }: BoxRowProps) {
  const {
    control,
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<PackConfig>();

  // The fit-check (Plan 07 Run gate) maps an unfittable box to an inline error on this
  // row's `length` (the "Dimensions" field), so surface it there (D-01 / BOX-06).
  const lengthError = errors.boxTypes?.[index]?.length?.message;

  // Stable identity + swatch colour. colorForType is order-independent (it sorts/dedupes),
  // so a given id always maps to the same colour regardless of row order.
  const id = useWatch({ control, name: `boxTypes.${index}.id` }) ?? '';
  const label = useWatch({ control, name: `boxTypes.${index}.label` }) ?? '';
  const fragile = useWatch({ control, name: `boxTypes.${index}.fragile` }) ?? false;

  const swatchColor = colorForType(allIds).get(id) ?? '#6d63f5';

  // Per-session memory of the pre-fragile max-load (Pattern 4 / D-08). Not persisted —
  // after a reload the prior value is unknown and we fall back to the default.
  const prevMaxLoad = useRef<number>(makeDefaultBoxType().maxLoad);

  function onFragileChange(checked: boolean) {
    if (checked) {
      const current = Number(getValues(`boxTypes.${index}.maxLoad`));
      prevMaxLoad.current = Number.isFinite(current) ? current : makeDefaultBoxType().maxLoad;
      setValue(`boxTypes.${index}.maxLoad`, 0, { shouldValidate: true, shouldDirty: true });
    } else {
      setValue(`boxTypes.${index}.maxLoad`, prevMaxLoad.current, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    setValue(`boxTypes.${index}.fragile`, checked, { shouldDirty: true });
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
      {/* Head: swatch · name input · id-tag · spacer · remove */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-5 py-[15px]">
        <span
          aria-hidden="true"
          style={{ background: swatchColor }}
          className="h-[13px] w-[13px] flex-none rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
        />
        <input
          {...register(`boxTypes.${index}.label`)}
          aria-label="Box type name"
          className="w-[200px] border-0 bg-transparent text-[13.5px] font-semibold text-text outline-none focus:shadow-[0_1px_0_var(--color-accent)]"
        />
        <span className="rounded-[5px] border border-border bg-surface-2 px-[7px] py-0.5 font-mono text-[10.5px] text-text-3">
          {id}
        </span>
        {/* read-only id is stored on the form but never user-editable (T-4-05) */}
        <input type="hidden" {...register(`boxTypes.${index}.id`)} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label || 'box type'}`}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-text-3 transition-colors duration-150 hover:bg-[#f0eded] hover:text-danger"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 4h10M6.5 4V3h3v1M5 4l.5 9h5L11 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Body: dims · weight/qty/maxLoad+fragile · rotation */}
      <div className="flex flex-col gap-6 px-6 py-[26px]">
        <NumberField
          label="Dimensions"
          hint="length · width · height"
          unit="mm"
          error={lengthError}
          {...register(`boxTypes.${index}.length`)}
        />
        <div className="grid grid-cols-3 gap-7 max-[720px]:grid-cols-1">
          <NumberField label="Width" unit="mm" {...register(`boxTypes.${index}.width`)} />
          <NumberField label="Height" unit="mm" {...register(`boxTypes.${index}.height`)} />
          <NumberField
            label="Weight / unit"
            unit="kg"
            step="0.1"
            {...register(`boxTypes.${index}.weight`)}
          />
        </div>
        <div className="grid grid-cols-3 gap-7 max-[720px]:grid-cols-1">
          <NumberField label="Quantity" unit="pcs" {...register(`boxTypes.${index}.quantity`)} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`boxTypes.${index}.maxLoad`}
                className="text-xs font-semibold text-text-2"
              >
                Max load on top
              </label>
              <span className="flex items-center gap-1.5 text-xs text-text-3">
                Fragile
                <Switch
                  size="sm"
                  checked={fragile}
                  onChange={onFragileChange}
                  label={`Fragile — ${label || 'box type'}`}
                />
              </span>
            </div>
            <div
              className={clsx(
                'flex items-center overflow-hidden rounded-[var(--radius-sm)] border bg-surface transition-[border-color,box-shadow] duration-150',
                'focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-weak)]',
                'border-border-strong',
                fragile && 'opacity-50',
              )}
            >
              <input
                {...register(`boxTypes.${index}.maxLoad`)}
                id={`boxTypes.${index}.maxLoad`}
                type="number"
                inputMode="numeric"
                disabled={fragile}
                className="w-full border-0 bg-transparent px-3 py-2.5 font-mono text-[13px] text-text outline-none disabled:cursor-not-allowed disabled:text-text-3"
              />
              <span className="flex items-center self-stretch border-l border-border bg-surface-2 px-3 font-mono text-xs text-text-3">
                kg
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-2">
            Allowed rotation{' '}
            <span className="font-normal text-text-3">— how this box type may be turned</span>
          </span>
          <Controller
            control={control}
            name={`boxTypes.${index}.rotation`}
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                options={ROTATION_OPTIONS}
                onChange={field.onChange}
                ariaLabel="Allowed rotation"
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
