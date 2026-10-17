import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { ContinueCard } from "./ContinueCard";

export interface ContinueStripProps {
  readonly items: readonly ResolvedItem[];
}

/** The Continue Watching strip above the results. It is absent when nothing is in progress, so no empty band shows. */
export function ContinueStrip({ items }: ContinueStripProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={LIBRARY_COPY.continueHeading} className="flex min-w-0 flex-col gap-2 px-3 pt-3">
      <h2 className="m-0 font-mono text-[11px] font-semibold text-muted">{LIBRARY_COPY.continueHeading}</h2>
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1">
        {items.map((item) => (
          <li key={`${item.ref.kind}:${item.ref.id}`} className="flex-none">
            <ContinueCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
