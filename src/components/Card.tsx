// Card chrome primitive (UI-SPEC §Named Component Constants / §Color / §Interaction).
// Renders the ported card: a card-head (600 14px title + --text-3 desc + optional
// right-aligned badge over a hairline border) above a card-body padded with the named
// --card-body-padding constant and a 24px (lg) vertical rhythm. Surface bg, --radius-lg
// (14px) corners, --shadow. Used by the Pallet card (PALLET-01) and Box catalog (BOX-04).
//
// Code-split gate (C-05): imports ONLY React + clsx — never three/r3f/drei or viewer/*.
import type { ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = {
  title: string;
  desc?: string;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
};

export default function Card({ title, desc, badge, className, children }: CardProps) {
  return (
    <section
      className={clsx(
        'rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow)]',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-[var(--card-body-padding)] py-5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-text">{title}</h2>
        {desc ? <span className="text-xs text-text-3">{desc}</span> : null}
        {badge ? <span className="ml-auto">{badge}</span> : null}
      </div>
      <div className="flex flex-col gap-6 px-[var(--card-body-padding)] py-7">{children}</div>
    </section>
  );
}
