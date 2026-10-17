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
 *  card; the title is its tooltip and its accessible name, and nothing is written on it or beneath it. */
export function RelatedCard({ item, selected, onOpen }: RelatedCardProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={item.title}
      title={item.title}
      onClick={onOpen}
      className={cn(
        "block aspect-4/3 h-full flex-none cursor-pointer overflow-hidden rounded-ctl border bg-surface p-0",
        selected ? "border-accent" : "border-border hover:border-dim",
      )}
    >
      <RelatedPicture src={item.posterUrl} alt={item.title} />
    </button>
  );
}
