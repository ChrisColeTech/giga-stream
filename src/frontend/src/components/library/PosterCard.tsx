import { Ellipsis } from "lucide-react";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { PosterImage } from "@/components/ui/PosterImage";
import { cn } from "@/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { progressRatio } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { CardActions } from "./CardActions";
import { CARD_FOOT_FADE, CARD_LIFT, CARD_REVEAL } from "./card-chrome";
import { enterOnCard } from "./card-keys";
import { menuEventBelow, openCardMenu } from "./card-menu";
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

/** One title in the grid (`06` section 4.2): a 2:3 poster that is the title's only caption. It rises 2% on hover. Play and
 *  Info are round icon buttons at its lower left and the menu at its top right, all shown on hover and on keyboard focus
 *  and never over the centre. A press selects; Enter on the selected card opens Info. The title stays in the name. */
export function PosterCard({ item, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterCardProps) {
  /* Title information returns focus here when it closes: the card's own button. */
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
        ref={infoRef}
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
      <div className={cn("pointer-events-none relative rounded-card", CARD_LIFT)}>
        <PosterImage
          src={item.posterUrl}
          alt={item.title}
          className={cn("transition-[box-shadow] duration-fade ease-linear", selected && "ring-2 ring-accent")}
        />
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end px-2 pt-10 pb-2.5",
            CARD_FOOT_FADE,
            CARD_REVEAL,
          )}
        >
          <div className="pointer-events-auto flex items-center gap-1.5">
            <CardActions item={item} />
          </div>
        </div>
        <div className={cn("pointer-events-auto absolute top-2 right-2 z-10", CARD_REVEAL)}>
          <IconButton
            bordered
            aria-label={LIBRARY_COPY.moreActions}
            title={LIBRARY_COPY.moreActions}
            onClick={(event) => openCardMenu(menuEventBelow(event.currentTarget), item, context)}
          >
            <Ellipsis className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
