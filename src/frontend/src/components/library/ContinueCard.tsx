import { useRef, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { continueLabel, progressRatio, remainingLabel } from "@/lib/library-facts";
import type { ResolvedItem } from "@/lib/library-marks";
import { posterTone } from "@/lib/poster-tone";
import type { CollectionRow } from "@/types/collection";
import { CardActions } from "./CardActions";
import { menuEventBelow, openCardMenu } from "./card-menu";
import { openTitleInfo } from "./open-title-info";
import { ProgressBar } from "./ProgressBar";
import { TILE_FRAME, TILE_IDLE, TILE_SELECTED } from "./tile-chrome";

export interface ContinueCardProps {
  readonly item: ResolvedItem;
  readonly selected: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** One Continue watching card (`06` section 4.2), on LoRA's gallery tile: a 16:9 backdrop in the title's color family as
 *  the art, progress along its foot, one line under it naming the title and the time left, then Play, Info and the
 *  menu. A press selects it and opens its Info, as a poster does; the menu is the poster's. */
export function ContinueCard({ item, selected, collections, onSelect, onRemoveWatch }: ContinueCardProps) {
  const artRef = useRef<HTMLButtonElement>(null);
  const progress = item.progress;
  if (progress === undefined) return null;
  const label = continueLabel(item.title, progress);
  const ratio = progressRatio(progress);
  const remaining = remainingLabel(progress);
  const tone = `var(${posterTone(item.title)})`;
  const context = {
    collections,
    inHistory: false,
    onInfo: () => openTitleInfo(item.ref, artRef.current),
    onRemoveWatch: () => onRemoveWatch(item),
  };
  const onMenu = (event: MouseEvent<HTMLElement>): void => openCardMenu(event, item, context);
  return (
    <article aria-label={label} className="flex w-[260px] flex-none flex-col gap-1" onContextMenu={onMenu}>
      <button
        ref={artRef}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => {
          onSelect(item.ref.id);
          openTitleInfo(item.ref, artRef.current);
        }}
        className={cn(TILE_FRAME, "aspect-video", selected ? TILE_SELECTED : TILE_IDLE)}
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${tone} 46%, var(--color-surface)) 0%, var(--color-surface) 82%)`,
        }}
      >
        {ratio !== undefined && <ProgressBar ratio={ratio} className="absolute inset-x-0 bottom-0" />}
      </button>
      <span className="flex min-w-0 justify-between gap-2 font-mono text-xs">
        <span className="truncate text-text">{label}</span>
        {remaining !== undefined && <span className="flex-none text-faint">{remaining}</span>}
      </span>
      <CardActions item={item} onMore={(button) => openCardMenu(menuEventBelow(button), item, context)} />
    </article>
  );
}
