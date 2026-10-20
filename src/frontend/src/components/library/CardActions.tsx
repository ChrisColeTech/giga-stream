import { Ellipsis, Info, Play } from "lucide-react";
import { cn } from "@giga/ui/lib/cn";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import { openTitleInfo } from "./open-title-info";
import { TILE_BUTTON } from "./tile-chrome";

export interface CardActionsProps {
  readonly item: ResolvedItem;
  /** Opens the card's menu under the given button. Absent, the row has no menu button. */
  readonly onMore?: (button: HTMLElement) => void;
}

/** A card's verbs under its art, as LoRA's gallery tile lays out Keep, Reject and Delete: Play (Open for a series) and
 *  Info share the width, and the menu button is a fixed square at the end. */
export function CardActions({ item, onMore }: CardActionsProps) {
  const actions = useLibraryActions();
  const verb = item.kind === "tv" ? LIBRARY_COPY.open : LIBRARY_COPY.play;
  return (
    <div className="flex gap-1">
      <button type="button" className={TILE_BUTTON} aria-label={`${verb} ${item.title}`} onClick={() => actions.play(item.ref)}>
        <Play aria-hidden /> {verb}
      </button>
      <button
        type="button"
        className={TILE_BUTTON}
        aria-label={`${LIBRARY_COPY.info} ${item.title}`}
        onClick={(event) => openTitleInfo(item.ref, event.currentTarget)}
      >
        <Info aria-hidden /> {LIBRARY_COPY.info}
      </button>
      {onMore !== undefined && (
        <button
          type="button"
          className={cn(TILE_BUTTON, "flex-none px-1.5")}
          aria-label={LIBRARY_COPY.moreActions}
          title={LIBRARY_COPY.moreActions}
          onClick={(event) => onMore(event.currentTarget)}
        >
          <Ellipsis aria-hidden />
        </button>
      )}
    </div>
  );
}
