import { PosterImage } from "@/components/ui/PosterImage";
import type { LibraryItem } from "@/types/library";

export interface RelatedCardProps {
  readonly item: LibraryItem;
  readonly onOpen: () => void;
}

/** One related title (`06` section 5.5): a 2:3 poster, the title and the year. Sized to the band: at its 140 px the
 *  poster is 51 by 77 px and the card column is 72 px. */
export function RelatedCard({ item, onOpen }: RelatedCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={item.title}
      className="flex w-[72px] flex-none cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-left font-sans text-muted hover:text-text"
    >
      <span className="block w-[51px]">
        <PosterImage src={item.posterUrl} alt={item.title} />
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight text-text">{item.title}</span>
      {item.year !== undefined && (
        <span className="w-full truncate text-center font-mono text-[10px] text-dim tabular-nums">{item.year}</span>
      )}
    </button>
  );
}
