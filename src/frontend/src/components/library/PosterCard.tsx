import { Star } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { PosterImage } from "@/components/ui/PosterImage";
import { ratingBadge } from "@/lib/card-details";
import { cn } from "@giga/ui/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { progressRatio } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { CardActions } from "./CardActions";
import { DetailsGlyph } from "./DetailsGlyph";
import { menuEventBelow, openCardMenu } from "./card-menu";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";
import { TILE_BADGE, TILE_CHIP, TILE_FRAME, TILE_IDLE, TILE_SELECTED } from "./tile-chrome";

export interface PosterCardProps {
  readonly item: ResolvedItem;
  readonly selected: boolean;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** One title in the grid (`06` section 4.2), on LoRA's gallery tile: the 2:3 poster is the selectable art, a favorite
 *  wears the star badge beneath the Details glyph in its top right corner, the rating chip is in its top left, progress
 *  runs along its foot, and Play, Info and the menu sit under it.
 *  A press selects the card and opens its Info. The visible title also supplies the tooltip and accessible name. */
export function PosterCard({ item, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterCardProps) {
  /* Title information returns focus here when it closes: the card's own button. */
  const artRef = useRef<HTMLButtonElement>(null);
  const id = item.ref.id;
  const ratio = item.progress === undefined ? undefined : progressRatio(item.progress);
  const rating = ratingBadge(item.rating);
  /* Details come from the title's detail read, which a local file has none of: no glyph for it. */
  const details = item.kind !== "local";
  const context = {
    collections,
    inHistory,
    onInfo: () => openTitleInfo(item.ref, artRef.current),
    onRemoveWatch: () => onRemoveWatch(item),
  };
  const onMenu = (event: MouseEvent<HTMLElement>): void => openCardMenu(event, item, context);

  return (
    <div data-card-id={id} className="flex min-w-0 flex-col gap-1" onContextMenu={onMenu}>
      {/* The Details glyph is a sibling of the art button, not inside it: a button cannot hold a button. */}
      <div className="relative">
        <button
          ref={artRef}
          type="button"
          data-primary
          aria-label={item.title}
          title={item.title}
          aria-pressed={selected}
          onClick={() => {
            onSelect(id);
            openTitleInfo(item.ref, artRef.current);
          }}
          className={cn(TILE_FRAME, "aspect-[2/3]", selected ? TILE_SELECTED : TILE_IDLE)}
        >
          <PosterImage src={item.posterUrl} alt={item.title} className="rounded-none" />
          {rating !== undefined && (
            <span className={cn(TILE_CHIP, "top-1 left-1")}>
              <Star fill="currentColor" aria-hidden />
              {rating}
            </span>
          )}
          {item.favorite && (
            <span
              className={cn(TILE_BADGE, details ? "top-7" : "top-1", "right-1 text-accent-text")}
              aria-label={LIBRARY_COPY.favorite}
            >
              <Star className="size-3.5" fill="currentColor" aria-hidden />
            </span>
          )}
          {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
        </button>
        {details && <DetailsGlyph item={item} />}
      </div>
      <span className="block min-w-0 truncate px-1 font-sans text-sm font-medium text-text" title={item.title}>
        {item.title}
      </span>
      <CardActions item={item} onMore={(button) => openCardMenu(menuEventBelow(button), item, context)} />
    </div>
  );
}
