import { Star } from "lucide-react";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { PosterImage } from "@/components/ui/PosterImage";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { progressRatio } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { CardActions } from "./CardActions";
import { enterOnCard } from "./card-keys";
import { menuEventBelow, openCardMenu } from "./card-menu";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";
import { TILE_BADGE, TILE_FRAME, TILE_IDLE, TILE_SELECTED } from "./tile-chrome";

export interface PosterCardProps {
  readonly item: ResolvedItem;
  readonly selected: boolean;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** One title in the grid (`06` section 4.2), on LoRA's gallery tile: the 2:3 poster is the selectable art, a favorite
 *  wears the star badge in its top right corner, progress runs along its foot, and Play, Info and the menu sit under it.
 *  A press selects the card and opens its Info, as a Continue watching card does. The title is the tooltip and the name. */
export function PosterCard({ item, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterCardProps) {
  /* Title information returns focus here when it closes: the card's own button. */
  const artRef = useRef<HTMLButtonElement>(null);
  const id = item.ref.id;
  const ratio = item.progress === undefined ? undefined : progressRatio(item.progress);
  const context = {
    collections,
    inHistory,
    onInfo: () => openTitleInfo(item.ref, artRef.current),
    onRemoveWatch: () => onRemoveWatch(item),
  };
  const onMenu = (event: MouseEvent<HTMLElement>): void => openCardMenu(event, item, context);

  return (
    <div data-card-id={id} className="flex min-w-0 flex-col gap-1" onContextMenu={onMenu}>
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
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
          enterOnCard(event, selected, () => onSelect(id), () => openTitleInfo(item.ref, artRef.current))
        }
        className={cn(TILE_FRAME, "aspect-[2/3]", selected ? TILE_SELECTED : TILE_IDLE)}
      >
        <PosterImage src={item.posterUrl} alt={item.title} className="rounded-none" />
        {item.favorite && (
          <span className={cn(TILE_BADGE, "top-1 right-1 text-accent-text")} aria-label={LIBRARY_COPY.favorite}>
            <Star className="size-3.5" fill="currentColor" aria-hidden />
          </span>
        )}
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
      </button>
      <CardActions item={item} onMore={(button) => openCardMenu(menuEventBelow(button), item, context)} />
    </div>
  );
}
