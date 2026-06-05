// The box-catalog card (BOX-01/05): a `useFieldArray` list of `BoxRow`s wrapped in the
// Card primitive, an `Add box type` dashed button (append + scroll-into-view + focus the
// new row's name input), a live `{N} types · {M} units` badge (useWatch → tallyCatalog),
// and the empty-catalog state when every row is removed.
//
// Rows are keyed on RHF's stable `field.id` (Pitfall 3), NOT the array index, so add /
// remove never re-mounts the wrong row. `Add box type` appends `makeDefaultBoxType()`
// (letter-prefixed id, C-06). The empty state is a valid editing state — the Run gate
// (Plan 07) blocks on it.
//
// Code-split gate (C-05): imports ONLY React, RHF, @/components/*, @/lib/config-tally,
// @/features/config/*, and @/types/config — never three/r3f/drei or any viewer module.
import { useRef } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import Card from '@/components/Card';
import { tallyCatalog } from '@/lib/config-tally';
import BoxRow from '@/features/config/BoxRow';
import { makeDefaultBoxType } from '@/features/config/defaults';
import type { PackConfig } from '@/types/config';

export default function BoxCatalogCard() {
  const { control } = useFormContext<PackConfig>();
  const { fields, append, remove } = useFieldArray({ control, name: 'boxTypes' });
  const listRef = useRef<HTMLDivElement>(null);

  // Live badge: subscribe to just the array and recompute the pure tally (NaN-safe).
  const watched = useWatch({ control, name: 'boxTypes' }) ?? [];
  const { types, units } = tallyCatalog(watched);

  // All current ids — passed to each row so its swatch colour is stable across reorders.
  const allIds = watched.map((b) => b?.id ?? '').filter(Boolean);

  function onAdd() {
    // Number by additions (current count + 1), NOT renumbered on removal (#7).
    append(makeDefaultBoxType(fields.length + 1));
    // After RHF commits the new row, scroll it into view and focus+select its name input
    // (ports the mockup's addBox()). The new row is the last child of the list container.
    requestAnimationFrame(() => {
      const lastRow = listRef.current?.lastElementChild;
      // scrollIntoView is absent in jsdom and a few embedded browsers — guard it so the
      // focus/select still runs and the callback never throws (Rule 1 robustness).
      lastRow?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      const nameInput = lastRow?.querySelector<HTMLInputElement>(
        'input[aria-label="Box type name"]',
      );
      nameInput?.focus();
      nameInput?.select();
    });
  }

  const badge = (
    <span className="rounded-[5px] border border-border bg-surface-2 px-[7px] py-0.5 font-mono text-[10.5px] text-text-3">
      {types} types · {units} units
    </span>
  );

  return (
    <Card title="Box catalog" desc="— item types available to pack" badge={badge}>
      <div ref={listRef} className="flex flex-col gap-6">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-[12px] border border-dashed border-border-strong px-6 py-10 text-center">
            <span className="text-sm font-semibold text-text">No box types yet</span>
            <span className="text-xs text-text-3">
              Add at least one box type to run the packer.
            </span>
          </div>
        ) : (
          fields.map((field, i) => (
            <BoxRow key={field.id} index={i} allIds={allIds} onRemove={() => remove(i)} />
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-border-strong bg-transparent px-4 py-3 text-sm font-semibold text-text-2 transition-colors duration-150 hover:border-accent hover:bg-accent-weak hover:text-accent-text"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Add box type
      </button>
    </Card>
  );
}
