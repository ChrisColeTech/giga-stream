import { Info, Play } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { ResolvedItem } from "@/lib/library-marks";
import { playRef } from "./library-service";
import { openTitleInfo } from "./open-title-info";

export interface CardActionsProps {
  readonly item: ResolvedItem;
}

/** A card's two actions as family icon buttons: Play (Open for a series), lit, and Info, in one row. The row is placed by
 *  the card at its lower left and shown on hover and on keyboard focus. */
export function CardActions({ item }: CardActionsProps) {
  const verb = item.kind === "tv" ? LIBRARY_COPY.open : LIBRARY_COPY.play;
  return (
    <>
      <IconButton bordered on aria-label={`${verb} ${item.title}`} title={verb} onClick={() => playRef(item.ref)}>
        <Play className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton
        bordered
        aria-label={`${LIBRARY_COPY.info} ${item.title}`}
        title={LIBRARY_COPY.info}
        onClick={(event) => openTitleInfo(item.ref, event.currentTarget)}
      >
        <Info className="size-3.5" aria-hidden />
      </IconButton>
    </>
  );
}
