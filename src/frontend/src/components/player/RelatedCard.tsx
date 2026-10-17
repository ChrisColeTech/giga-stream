import { PosterImage } from "@/components/ui/PosterImage";
import { cn } from "@/lib/cn";
import { RELATED_CARD_WIDTH } from "@/lib/player-copy";
import type { LibraryItem } from "@/types/library";

export interface RelatedCardProps {
  readonly item: LibraryItem;
  /** The card for the item the Player has open: the accent border, as the Studio's rail marks its selected render. */
  readonly selected: boolean;
  readonly onOpen: () => void;
}

/** One related title (`06` section 5.5): a 2:3 poster in the Studio rail's thumbnail frame (a hairline border, the ctl
 *  radius, the accent border when selected, the dim border on hover). The title lives on the poster alone; the year is
 *  the only line beneath it. Sized to the 210 px band: the card is RELATED_CARD_WIDTH (92 px) wide, so the frame is about
 *  138 px tall. */
export function RelatedCard({ item, selected, onOpen }: RelatedCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={item.title}
      aria-current={selected || undefined}
      style={{ width: RELATED_CARD_WIDTH }}
      className="group flex flex-none cursor-pointer flex-col gap-1 border-0 bg-transparent p-0 text-left font-sans"
    >
      <span
        className={cn(
          "block overflow-hidden rounded-ctl border bg-surface",
          selected ? "border-accent" : "border-border group-hover:border-dim",
        )}
      >
        <PosterImage src={item.posterUrl} alt={item.title} />
      </span>
      {item.year !== undefined && (
        <span className="w-full truncate text-center font-mono text-[10px] text-dim tabular-nums">{item.year}</span>
      )}
    </button>
  );
}
