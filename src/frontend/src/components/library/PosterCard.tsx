import { Ellipsis, Info, Play } from "lucide-react";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PosterImage } from "@/components/ui/PosterImage";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { progressRatio } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { enterOnCard } from "./card-keys";
import { menuEventBelow, openCardMenu } from "./card-menu";
import { playRef } from "./library-service";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";

export interface PosterCardProps {
  readonly item: ResolvedItem;
  readonly selected: boolean;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/* The foot row sits on a dark fade of the surface token, so Play and Info read over any artwork. */
const FOOT_FADE = "bg-[linear-gradient(to_top,color-mix(in_srgb,var(--color-surface)_92%,transparent),transparent)]";

/** One title in the grid (`06` section 4.2), drawn as a streaming catalogue tile: a 2:3 poster that is the title's only
 *  caption. It rises slightly on hover; Play and Info sit on its foot and the menu in its corner, all shown on hover and
 *  on keyboard focus. A press selects; Enter on the selected card opens Info. The title stays in the accessible name. */
export function PosterCard({ item, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterCardProps) {
  const infoRef = useRef<HTMLButtonElement>(null);
  const id = item.ref.id;
  const ratio = item.progress === undefined ? undefined : progressRatio(item.progress);
  const context = {
    collections,
    inHistory,
    onInfo: () => openTitleInfo(item.ref, infoRef.current),
    onRemoveWatch: () => onRemoveWatch(item),
  };
  const onMenu = (event: MouseEvent<HTMLElement>): void => openCardMenu(event, item, context);

  return (
    <div data-card-id={id} className="group/card relative min-w-0" onContextMenu={onMenu}>
      <button
        type="button"
        data-primary
        aria-label={item.title}
        title={item.title}
        aria-pressed={selected}
        onClick={() => onSelect(id)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
          enterOnCard(event, selected, () => onSelect(id), () => openTitleInfo(item.ref, infoRef.current))
        }
        className="absolute inset-0 z-0 cursor-pointer rounded-card border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div
        className={cn(
          "pointer-events-none relative transition-[transform,box-shadow] duration-[140ms] ease-linear",
          "group-hover/card:-translate-y-[2%] group-hover/card:shadow-[var(--shadow-menu)]",
          "rounded-card",
        )}
      >
        <PosterImage
          src={item.posterUrl}
          alt={item.title}
          className={cn("transition-[box-shadow] duration-fade ease-linear", selected && "ring-2 ring-accent")}
        />
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
        <div
          className={cn(
            "pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex items-end gap-1.5 px-2 pt-10 pb-2.5 opacity-0",
            "transition-opacity duration-fade group-hover/card:opacity-100 group-focus-within/card:opacity-100",
            FOOT_FADE,
          )}
        >
          <Button size="sm" variant="primary" className="flex-1" onClick={() => playRef(item.ref)}>
            <Play aria-hidden /> {item.kind === "tv" ? "Open" : "Play"}
          </Button>
          <Button size="sm" ref={infoRef} className="flex-1" onClick={context.onInfo}>
            <Info aria-hidden /> Info
          </Button>
        </div>
        <IconButton
          bordered
          aria-label={LIBRARY_COPY.moreActions}
          title={LIBRARY_COPY.moreActions}
          onClick={(event) => openCardMenu(menuEventBelow(event.currentTarget), item, context)}
          className="pointer-events-auto absolute top-1.5 right-1.5 z-10 size-6 opacity-0 transition-opacity duration-fade group-hover/card:opacity-100 group-focus-within/card:opacity-100"
        >
          <Ellipsis className="size-3.5" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}
