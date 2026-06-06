// The pallet-configuration card (PALLET-01/02). Wraps the `Card` primitive with two
// `SectionLabel` groups: `Dimensions` (Length / Width / Max stack height — mm) and `Limits`
// (Max weight — kg, Max overhang — mm). Every field is bound through RHF `register`; numeric
// inputs are left as strings on the form so the zod schema coerces them (Pattern 1, mirroring
// BoxRow).
//
// `maxOverhang` is gated behind an `Allow overhang` switch (mirroring the BoxRow fragile ↔
// maxLoad pattern): OFF (the default) zeroes + disables the field; ON restores the stashed
// prior value and enables it. There is NO Max pallets field — the solver is never artificially
// capped (request-builder sends max_pallets = box count).
//
// Code-split gate (C-05): imports ONLY React, RHF, and @/components/* / @/types/config —
// never three/r3f/drei or any viewer module, so it stays in the eager `/` chunk.
import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import clsx from 'clsx';
import Card from '@/components/Card';
import NumberField from '@/components/NumberField';
import SectionLabel from '@/components/SectionLabel';
import Switch from '@/components/Switch';
import type { PackConfig } from '@/types/config';

// Fallback overhang value restored when Allow overhang is toggled ON after a reload (the
// per-session ref's prior value is genuinely unknown then) — mirrors BoxRow's prevMaxLoad.
const DEFAULT_OVERHANG = 40;

export default function PalletCard() {
  const {
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<PackConfig>();

  const pallet = errors.pallet;
  const allowOverhang =
    useWatch<PackConfig, 'pallet.allowOverhang'>({ name: 'pallet.allowOverhang' }) ?? false;

  // Per-session memory of the pre-disable overhang value (mirrors BoxRow.prevMaxLoad). Not
  // persisted — after a reload the prior value is unknown and we fall back to the default.
  const prevOverhang = useRef<number>(DEFAULT_OVERHANG);

  function onAllowOverhangChange(checked: boolean) {
    if (checked) {
      setValue('pallet.maxOverhang', prevOverhang.current, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      const current = Number(getValues('pallet.maxOverhang'));
      prevOverhang.current = Number.isFinite(current) && current > 0 ? current : DEFAULT_OVERHANG;
      setValue('pallet.maxOverhang', 0, { shouldValidate: true, shouldDirty: true });
    }
    setValue('pallet.allowOverhang', checked, { shouldDirty: true });
  }

  return (
    <Card title="Pallet configuration" desc="— the physical envelope and constraints">
      <div className="flex flex-col gap-6">
        <SectionLabel>Dimensions</SectionLabel>
        <div className="grid grid-cols-3 gap-7 max-[720px]:grid-cols-1">
          <NumberField
            label="Length"
            unit="mm"
            error={pallet?.length?.message}
            {...register('pallet.length')}
          />
          <NumberField
            label="Width"
            unit="mm"
            error={pallet?.width?.message}
            {...register('pallet.width')}
          />
          <NumberField
            label="Max stack height"
            unit="mm"
            error={pallet?.height?.message}
            {...register('pallet.height')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <SectionLabel className="mt-8">Limits</SectionLabel>
        <div className="grid grid-cols-2 gap-7 max-[720px]:grid-cols-1">
          <NumberField
            label="Max weight"
            unit="kg"
            step="0.1"
            error={pallet?.maxWeight?.message}
            {...register('pallet.maxWeight')}
          />

          {/* Max overhang — gated behind the Allow-overhang switch (default OFF → 0, disabled),
              mirroring the BoxRow fragile ↔ maxLoad pattern. */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pallet.maxOverhang" className="text-xs font-semibold text-text-2">
                Max overhang
              </label>
              <span className="flex items-center gap-1.5 text-xs text-text-3">
                Allow overhang
                <Switch
                  size="sm"
                  checked={allowOverhang}
                  onChange={onAllowOverhangChange}
                  label="Allow overhang"
                />
              </span>
            </div>
            <div
              className={clsx(
                'flex items-center overflow-hidden rounded-[var(--radius-sm)] border bg-surface transition-[border-color,box-shadow] duration-150',
                'focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-weak)]',
                'border-border-strong',
                !allowOverhang && 'opacity-50',
              )}
            >
              <input
                {...register('pallet.maxOverhang')}
                id="pallet.maxOverhang"
                type="number"
                inputMode="numeric"
                disabled={!allowOverhang}
                className="w-full border-0 bg-transparent px-3 py-2.5 font-mono text-[13px] text-text outline-none disabled:cursor-not-allowed disabled:text-text-3"
              />
              <span className="flex items-center self-stretch border-l border-border bg-surface-2 px-3 font-mono text-xs text-text-3">
                mm
              </span>
            </div>
            {pallet?.maxOverhang?.message ? (
              <span role="alert" className="text-xs text-danger">
                {pallet.maxOverhang.message}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
