import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { ContinueCard } from "./ContinueCard";

export interface ContinueStripProps {
  readonly items: readonly ResolvedItem[];
}

/** The Continue watching strip above the results. It is absent when nothing is in progress, so no empty band shows. Its
 *  heading is the section-header role of `21` section 8a. */
export function ContinueStrip({ items }: ContinueStripProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={LIBRARY_COPY.continueHeading} className="flex min-w-0 flex-col gap-1 px-3 pt-3">
      <h2 className="m-0 font-sans text-[11px] leading-5 font-semibold text-faint">{LIBRARY_COPY.continueHeading}</h2>
      <ul className="m-0 flex list-none gap-3 overflow-x-auto py-2">
        {items.map((item) => (
          <li key={`${item.ref.kind}:${item.ref.id}`} className="flex-none">
            <ContinueCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
