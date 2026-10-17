import { RelatedPicture } from "@/components/player/RelatedPicture";
import { cn } from "@/lib/cn";
import type { LibraryItem } from "@/types/library";

export interface RelatedCardProps {
  readonly item: LibraryItem;
  /** The thumbnail of the item the Player has open: the accent border, as the Studio's rail marks its selected render. */
  readonly selected: boolean;
  readonly onOpen: () => void;
}

/** One related title (`06` section 5.5), a thumbnail of Giga LoRA Studio's rail (`PastRuns`): the same frame,
 *  border, radius, dim border on hover and accent border when selected, at the rail's size. The picture is the whole
 *  artwork stays 4:3 with a visible single-line title below it, also used as the full tooltip and accessible name. */
export function RelatedCard({ item, selected, onOpen }: RelatedCardProps) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-label={item.title}
      title={item.title}
      onClick={onOpen}
      className={cn(
        "flex h-full flex-none cursor-pointer flex-col overflow-hidden rounded-ctl border bg-surface p-0",
        selected ? "border-accent" : "border-border hover:border-dim",
      )}
    >
      <span className="block aspect-4/3 h-[calc(100%-1.75rem)] flex-none overflow-hidden">
        <RelatedPicture src={item.posterUrl} alt={item.title} />
      </span>
      <span className="block h-7 w-0 min-w-full flex-none truncate px-2 text-left font-sans text-sm leading-7 text-text">
        {item.title}
      </span>
    </button>
  );
}
