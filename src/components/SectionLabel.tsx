// Mono section-label primitive (UI-SPEC §Color §Typography). Uppercase mono 12px label
// with a 6px --color-accent leading square dot (the accent's reserved use #6). Top
// margin (xl/32px) is the consumer's concern — pass it via `className`. Used to head the
// Pallet card's `Dimensions` / `Limits` groups (PALLET-01).
//
// Code-split gate (C-05): imports ONLY React + clsx — never three/r3f/drei or viewer/*.
import type { ReactNode } from 'react';
import clsx from 'clsx';

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export default function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2 font-mono text-xs uppercase tracking-[0.06em] text-text-3',
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[2px] bg-accent" />
      {children}
    </div>
  );
}
