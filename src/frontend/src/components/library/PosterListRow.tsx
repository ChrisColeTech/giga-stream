import { Ellipsis, Info, Play, Star } from "lucide-react";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PosterImage } from "@/components/ui/PosterImage";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { identityLine, progressRatio } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { enterOnCard } from "./card-keys";
import { menuEventBelow, openCardMenu } from "./card-menu";
import { changeFavourite, playRef } from "./library-service";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";

export interface PosterListRowProps {
  readonly item: ResolvedItem;
  readonly selected: boolean;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** One title in the list view: a thumbnail, its name and facts, and the same commands as a card. */
export function PosterListRow({ item, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterListRowProps) {
  const infoRef = useRef<HTMLButtonElement>(null);
  const id = item.ref.id;
  const ratio = item.progress === undefined ? undefined : progressRatio(item.progress);
  const facts = [identityLine(item), item.genres.join(", ")].filter((part) => part !== "").join(" · ");
  const context = {
    collections,
    inHistory,
    onInfo: () => openTitleInfo(item.ref, infoRef.current),
    onRemoveWatch: () => onRemoveWatch(item),
  };
  const onMenu = (event: MouseEvent<HTMLElement>): void => openCardMenu(event, item, context);

  return (
    <div
      data-card-id={id}
      onContextMenu={onMenu}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-card border px-1.5 py-1.5",
        selected ? "border-accent-edge bg-accent-tint" : "border-transparent hover:bg-hov",
      )}
    >
      <button
        type="button"
        data-primary
        aria-pressed={selected}
        onClick={() => onSelect(id)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
          enterOnCard(event, selected, () => onSelect(id), () => openTitleInfo(item.ref, infoRef.current))
        }
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-ctl border-0 bg-transparent p-0 text-left text-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="w-9 flex-none">
          <PosterImage alt={item.title} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-sans text-[13px] text-text">{item.title}</span>
          {facts !== "" && <span className="truncate font-mono text-[11px] text-dim">{facts}</span>}
          {ratio !== undefined && <ProgressBar ratio={ratio} />}
        </span>
      </button>
      <IconButton
        bordered
        on={item.favorite}
        aria-label={item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
        aria-pressed={item.favorite}
        title={item.favorite ? LIBRARY_COPY.unfavorite : LIBRARY_COPY.favorite}
        onClick={() => changeFavourite(item.ref, !item.favorite)}
      >
        <Star className="size-3.5" fill={item.favorite ? "currentColor" : "none"} aria-hidden />
      </IconButton>
      <Button size="sm" onClick={() => playRef(item.ref)}>
        <Play aria-hidden /> {item.kind === "tv" ? "Open" : "Play"}
      </Button>
      <Button size="sm" ref={infoRef} onClick={context.onInfo}>
        <Info aria-hidden /> Info
      </Button>
      <IconButton
        bordered
        aria-label={LIBRARY_COPY.moreActions}
        title={LIBRARY_COPY.moreActions}
        onClick={(event) => openCardMenu(menuEventBelow(event.currentTarget), item, context)}
      >
        <Ellipsis className="size-3.5" aria-hidden />
      </IconButton>
    </div>
  );
}
