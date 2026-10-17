import { PosterImage } from "@/components/ui/PosterImage";
import { RELATED_CARD_WIDTH } from "@/lib/player-copy";
import type { LibraryItem } from "@/types/library";

export interface RelatedCardProps {
  readonly item: LibraryItem;
  readonly onOpen: () => void;
}

/** One related title (`06` section 5.5): a 2:3 poster, the title and the year. Sized to the 140 px band: the card is as wide
 *  as its poster, RELATED_CARD_WIDTH (48 px), so the poster is 72 px tall and the card 102 px tall in the 112 px body. The
 *  skeleton cards of the same band use the same width. */
export function RelatedCard({ item, onOpen }: RelatedCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={item.title}
      style={{ width: RELATED_CARD_WIDTH }}
      className="flex flex-none cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-left font-sans text-muted hover:text-text"
    >
      <PosterImage src={item.posterUrl} alt={item.title} />
      <span className="w-full truncate text-center text-[11px] leading-tight text-text">{item.title}</span>
      {item.year !== undefined && (
        <span className="w-full truncate text-center font-mono text-[10px] text-dim tabular-nums">{item.year}</span>
      )}
    </button>
  );
}
