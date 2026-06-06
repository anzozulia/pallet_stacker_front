// The capstone host for the Configure screen (D-04/D-05/D-06/D-08). Owns the single
// `useForm<PackConfig>` instance, seeds it from the restored localStorage draft, wires the
// debounced auto-save, and assembles the page shell: topbar (brand + step nav) →
// page-head → PalletCard → BoxCatalogCard → sticky FooterBar (which owns the sole Run CTA).
//
// Error timing (D-04): `mode:'onSubmit'` + `reValidateMode:'onChange'` — least noisy while
// typing; errors first surface on a Run attempt, then live-update per field. Persistence
// captures work-in-progress even when invalid (the hook saves unconditionally).
//
// Run gate (D-06): `handleSubmit(onValid)` runs the resolver first; on a valid parse it runs
// the pure `checkAllBoxesFit` feasibility check, maps any fit failures to inline row errors
// and stays blocked, else builds the PackRequest and logs the JSON (no network this phase).
// The built request omits maxLoad/fragile (D-08) — that is the request-builder's contract.
//
// Code-split gate (C-05): imports ONLY React, react-hook-form, @hookform/resolvers/zod,
// `@/features/config/*`, `@/hooks/*`, `@/lib/{request-builder,box-fit}`, and `@/types/config`
// — never three/r3f/drei or any viewer module, so it stays in the eager `/` chunk.
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import PalletCard from '@/features/config/PalletCard';
import BoxCatalogCard from '@/features/config/BoxCatalogCard';
import FooterBar from '@/features/config/FooterBar';
import { packConfigSubmitSchema } from '@/features/config/schema';
import { readPersistedConfig, useLocalStorageAutosave } from '@/hooks/useLocalStorageAutosave';
import { checkAllBoxesFit } from '@/lib/box-fit';
import { buildPackRequest } from '@/lib/request-builder';
import type { PackConfig } from '@/types/config';

export default function ConfigForm() {
  const navigate = useNavigate();

  // Restore-on-mount once, before the form exists, so RHF seeds from the persisted draft
  // (or DEFAULT_CONFIG). Memoised so re-renders never re-read storage / reset defaultValues.
  const defaultValues = useMemo<PackConfig>(() => readPersistedConfig(), []);

  const form = useForm<PackConfig>({
    defaultValues,
    // The submit schema TRANSFORMS string inputs → numbers, so its zod `input` type is a
    // (string | number) superset of PackConfig while its `output` IS PackConfig. The whole
    // form (cards, footer) is typed on PackConfig (defaults are numbers); we narrow the
    // resolver to `Resolver<PackConfig>` so RHF's field-values generic stays PackConfig and
    // the cards' `useFormContext<PackConfig>` line up. Validation still runs the strict schema.
    resolver: zodResolver(packConfigSubmitSchema) as Resolver<PackConfig>,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitted, errors },
  } = form;

  // The empty-catalog (`boxTypes` array `.min(1)`) error is form-level: surface it near the
  // catalog card / footer (D-02). RHF stores an array-level message under `.root` (or, for
  // some zod paths, directly on the field node).
  const catalogError = errors.boxTypes?.root?.message ?? errors.boxTypes?.message;

  // Wire the debounced auto-save to this form instance (the sole persistence path — the manual
  // Save draft button was removed; the debounce captures work-in-progress unconditionally, D-07).
  useLocalStorageAutosave(form);

  // The valid-parse path: feasibility gate, then build + hand off to /loading (D-06 / C-03 / C-05).
  function onValid(config: PackConfig) {
    const fit = checkAllBoxesFit(config);
    if (!fit.ok) {
      // Map each unfittable box to an inline error on its row's first dimension field.
      fit.failures.forEach((f) => {
        setError(`boxTypes.${f.index}.length`, { type: 'fit', message: f.message });
      });
      return; // stay blocked — do NOT build/navigate
    }
    // Build the request AND retain idToType (C-05): both ride the navigation state into the
    // eager /loading route, which runs the submit→poll lifecycle. The form is NOT unmounted
    // destructively and the persisted draft survives (D-08) for a later Cancel/Back return.
    const { request, idToType } = buildPackRequest(config);
    navigate('/loading', { state: { request, idToType } });
  }

  const onRun = handleSubmit(onValid);

  // Disable Run only after the first submit (mode:onSubmit) once the form is known-invalid,
  // so the button is not pre-disabled before the user has tried (D-06 timing).
  const runDisabled = isSubmitted && !isValid;

  return (
    <FormProvider {...form}>
      <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[rgba(255,255,255,0.82)] px-6 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold tracking-[-0.02em] text-text">
          <span
            aria-hidden="true"
            className="relative h-[22px] w-[22px] flex-none rounded-[6px] bg-[linear-gradient(150deg,#6d63f5,#4f46e5)] after:absolute after:inset-[5px] after:rounded-[2px] after:border-[1.5px] after:border-white/90 after:content-['']"
          />
          Palletize
          <small className="ml-0.5 font-mono text-[10px] font-normal uppercase text-text-3">
            pack&nbsp;studio
          </small>
        </div>

        <nav aria-label="Steps" className="ml-1.5 flex items-center gap-2 max-[720px]:hidden">
          <span className="flex items-center gap-[7px] text-xs font-semibold text-text">
            <span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-accent font-mono text-[11px] text-white">
              1
            </span>
            Configure
          </span>
          <span aria-hidden="true" className="h-px w-[22px] bg-border-strong" />
          <span aria-disabled="true" className="flex items-center gap-[7px] text-xs text-text-3">
            <span className="grid h-[19px] w-[19px] place-items-center rounded-full border border-border-strong font-mono text-[11px] text-text-3">
              2
            </span>
            Result
          </span>
        </nav>

        <div className="flex-1" />
      </header>

      <main className="mx-auto w-full max-w-[960px] px-6 pt-12 font-sans">
        <div className="mb-12">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text">Packing task</h1>
          <p className="mt-1.5 max-w-[560px] text-sm leading-relaxed text-text-2">
            Define the target pallet and the boxes to place on it. The solver fits each box type
            respecting weight, overhang, and stacking limits.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <PalletCard />
          <div className="flex flex-col gap-2">
            <BoxCatalogCard />
            {catalogError ? (
              <span role="alert" className="text-xs text-danger">
                {catalogError}
              </span>
            ) : null}
          </div>
        </div>
      </main>

      {/* Full-width sticky footer — sibling of header/main so its bar spans the viewport
          (the inner content is re-centred to the 960px column inside FooterBar). */}
      <FooterBar onRun={onRun} runDisabled={runDisabled} />
    </FormProvider>
  );
}
