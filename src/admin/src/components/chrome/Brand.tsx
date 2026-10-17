import { Tv } from "lucide-react";

/** The lockup: a flat accent tile and the two-line wordmark. Flat, not a gradient chip: the accent is a flag here,
 *  not a surface. */
export function Brand() {
  return (
    <div className="mr-1 flex items-center gap-[7px]">
      <span className="grid size-5.5 place-items-center rounded-md bg-accent">
        <Tv className="size-3 text-accent-ink" aria-hidden />
      </span>
      <span className="flex flex-col font-mono leading-[1.12] tracking-[.1em]">
        <b className="text-xs font-semibold text-text">GIGA</b>
        <span className="text-xs font-medium text-faint">STREAM</span>
      </span>
    </div>
  );
}
