// The pallet-configuration card (PALLET-01/02, PACK-03). Wraps the `Card` primitive with
// two `SectionLabel` groups: `Dimensions` (Length / Width / Max stack height — mm) and
// `Limits` (Max weight — kg, Max overhang — mm, Max pallets — integer solver budget). Every
// field is bound through RHF `register`; numeric inputs are left as strings on the form so
// the zod schema coerces them (Pattern 1, mirroring BoxRow).
//
// It honours C-04 (NO CoG-envelope field — replaced by the Max pallets integer, D-10/PACK-03)
// and omits the mockup's separate "Allow overhang" boolean (the numeric `maxOverhang` covers
// it — RESEARCH Open Question 2). `pallet.length`/`width`/`height`/`maxWeight`/`maxOverhang`
// and `maxPallets` are the bound paths.
//
// Code-split gate (C-05): imports ONLY React, RHF, and @/components/* / @/types/config —
// never three/r3f/drei or any viewer module, so it stays in the eager `/` chunk.
import { useFormContext } from 'react-hook-form';
import Card from '@/components/Card';
import NumberField from '@/components/NumberField';
import SectionLabel from '@/components/SectionLabel';
import type { PackConfig } from '@/types/config';

export default function PalletCard() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PackConfig>();

  const pallet = errors.pallet;

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
        <div className="grid grid-cols-3 gap-7 max-[720px]:grid-cols-1">
          <NumberField
            label="Max weight"
            unit="kg"
            step="0.1"
            error={pallet?.maxWeight?.message}
            {...register('pallet.maxWeight')}
          />
          <NumberField
            label="Max overhang"
            unit="mm"
            error={pallet?.maxOverhang?.message}
            {...register('pallet.maxOverhang')}
          />
          <NumberField
            label="Max pallets"
            error={errors.maxPallets?.message}
            {...register('maxPallets')}
          />
        </div>
      </div>
    </Card>
  );
}
