import { Check, Ellipsis, Info, Play, Star } from "lucide-react";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PosterImage } from "@/components/ui/PosterImage";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { progressRatio } from "@/lib/library-facts";
import type { CollectionRow } from "@/types/collection";
import { menuEventBelow, openCardMenu } from "./card-menu";
import { enterOnCard } from "./card-keys";
import { openTitleInfo } from "./open-title-info";
import { changeFavourite, playRef } from "./library-service";
import { ProgressBar } from "./ProgressBar";

export interface PosterCardProps {
  readonly item: ResolvedItem;
  readonly selected: boolean;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** One title in the grid (`06` section 4.2): a 2:3 poster with a favorite mark, progress and a watched check. Play and
 *  Info show on hover and on keyboard focus. A press selects; Enter on the selected card opens Info. */
export function PosterCard({ item, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterCardProps) {
  const infoRef = useRef<HTMLButtonElement>(null);
  const id = item.ref.id;
  const ratio = item.progress === undefined ? undefined : progressRatio(item.progress);
  const watched = item.progress?.state === "watched";
  const meta = [item.year, item.quality].filter((part) => part !== undefined).map(String).join(" · ");
  const context = {
    collections,
    inHistory,
    onInfo: () => openTitleInfo(item.ref, infoRef.current),
    onRemoveWatch: () => onRemoveWatch(item),
  };
  const onMenu = (event: MouseEvent<HTMLElement>): void => openCardMenu(event, item, context);

  return (
    <div data-card-id={id} className="group/card relative flex min-w-0 flex-col gap-1.5" onContextMenu={onMenu}>
      <button
        type="button"
        data-primary
        aria-label={item.title}
        aria-pressed={selected}
        onClick={() => onSelect(id)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
          enterOnCard(event, selected, () => onSelect(id), () => openTitleInfo(item.ref, infoRef.current))
        }
        className="absolute inset-0 z-0 cursor-pointer rounded-card border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="relative">
        <PosterImage
          src={item.posterUrl}
          alt={item.title}
          className={cn("transition-[box-shadow] duration-fade ease-linear", selected && "ring-2 ring-accent")}
        />
        <IconButton
          bordered
          on={item.favorite}
          aria-label={item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
          aria-pressed={item.favorite}
          title={item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
          onClick={() => changeFavourite(item.ref, !item.favorite)}
          className="absolute top-1.5 left-1.5 z-10 size-6"
        >
          <Star className="size-3" fill={item.favorite ? "currentColor" : "none"} aria-hidden />
        </IconButton>
        {watched && (
          <span
            role="img"
            aria-label={LIBRARY_COPY.watched}
            title={LIBRARY_COPY.watched}
            className="pointer-events-none absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border border-accent-edge bg-panel text-accent-text"
          >
            <Check className="size-3" aria-hidden />
          </span>
        )}
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
        <div className="absolute inset-x-1.5 bottom-3 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-fade group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          <Button size="sm" className="flex-1" onClick={() => playRef(item.ref)}>
            <Play aria-hidden /> {item.kind === "tv" ? "Open" : "Play"}
          </Button>
          <Button size="sm" ref={infoRef} className="flex-1" onClick={context.onInfo}>
            <Info aria-hidden /> Info
          </Button>
          <IconButton
            bordered
            aria-label={LIBRARY_COPY.moreActions}
            title={LIBRARY_COPY.moreActions}
            onClick={(event) => openCardMenu(menuEventBelow(event.currentTarget), item, context)}
            className="size-6"
          >
            <Ellipsis className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <p className="m-0 line-clamp-2 font-sans text-xs leading-4 font-medium text-text">{item.title}</p>
        {meta !== "" && <p className="m-0 truncate font-mono text-[11px] text-dim">{meta}</p>}
      </div>
    </div>
  );
}
