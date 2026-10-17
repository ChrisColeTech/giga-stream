import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { ContinueCard } from "./ContinueCard";

export interface ContinueStripProps {
  readonly items: readonly ResolvedItem[];
  readonly selected: string | null;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** The Continue watching strip above the results. It is absent when nothing is in progress, so no empty band shows. Its
 *  heading is LoRA's gallery album header: the name in faint mono, the count dim. */
export function ContinueStrip({ items, selected, collections, onSelect, onRemoveWatch }: ContinueStripProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={LIBRARY_COPY.continueHeading} className="flex min-w-0 flex-col gap-1 px-3 pt-3">
      <h2 className="m-0 flex items-center gap-2 font-mono text-xs font-normal text-faint">
        {LIBRARY_COPY.continueHeading}
        <span className="text-dim tabular-nums">{items.length}</span>
      </h2>
      <ul className="m-0 flex list-none gap-3 overflow-x-auto py-2">
        {items.map((item) => (
          <li key={`${item.ref.kind}:${item.ref.id}`} className="flex-none">
            <ContinueCard
              item={item}
              selected={selected === item.ref.id}
              collections={collections}
              onSelect={onSelect}
              onRemoveWatch={onRemoveWatch}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
