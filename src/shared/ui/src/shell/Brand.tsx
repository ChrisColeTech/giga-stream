import type { LucideIcon } from "lucide-react";

export interface BrandProps {
  /** The bold first line, e.g. "GIGA". */
  readonly word: string;
  /** The muted second line, e.g. "STREAM". */
  readonly subtitle: string;
  /** The icon on the accent tile. */
  readonly icon: LucideIcon;
  /** A mono tag after the wordmark, faint and letter-spaced, for an app that shares the lockup (the admin's `ADMIN`). */
  readonly tag?: string;
}

/** The lockup: a flat accent tile holding the icon, and the two-line wordmark. Flat, not a gradient chip: the accent is a
 *  flag here, not a surface. */
export function Brand({ word, subtitle, icon: Icon, tag }: BrandProps) {
  return (
    <div className="mr-1 flex items-center gap-[7px]">
      <span className="grid size-5.5 place-items-center rounded-md bg-accent">
        <Icon className="size-3 text-accent-ink" aria-hidden />
      </span>
      <span className="flex flex-col font-mono leading-[1.12] tracking-[.1em]">
        <b className="text-xs font-semibold text-text">{word}</b>
        <span className="text-xs font-medium text-faint">{subtitle}</span>
      </span>
      {tag !== undefined && <span className="ml-1 font-mono text-xs font-medium tracking-[.1em] text-faint">{tag}</span>}
    </div>
  );
}
