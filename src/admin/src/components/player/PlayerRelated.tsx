import { RelatedCard } from "@/components/player/RelatedCard";
import { ThumbnailRailSkeleton } from "@/components/ui/SkeletonCards";
import type { PlayerCommands } from "@/lib/player-commands";
import { sameRef } from "@/lib/player-session";
import type { PlayerView } from "@/lib/player-view";

export interface PlayerRelatedProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
}

/** The related band across the bottom (`06` section 5.5): Giga LoRA Studio's bottom rail
 *  (components/generate/PastRuns.tsx), copied. Thumbnails fill the band's height; there is no header, fold or caption,
 *  and a title is its thumbnail's tooltip. Loading, empty and a local file wear the rail's skeleton. */
export function PlayerRelated({ view, commands }: PlayerRelatedProps) {
  const current = view.tab?.ref;
  if (view.tab?.kind === "local" || view.related.length === 0)
    return (
      <div className="h-full bg-panel">
        <ThumbnailRailSkeleton />
      </div>
    );
  return (
    /* A list of buttons, not a listbox: each thumbnail is a press that opens its title, reached with Tab. */
    <ul aria-label="Related titles" className="m-0 flex h-full list-none items-stretch gap-1.5 overflow-x-auto bg-panel px-2.5 py-1.5">
      {view.related.map((item) => (
        <li key={`${item.ref.kind}-${item.ref.id}`} className="flex h-full flex-none">
          <RelatedCard
            item={item}
            selected={current !== undefined && sameRef(item.ref, current)}
            onOpen={() => commands.openRelated(item)}
          />
        </li>
      ))}
    </ul>
  );
}
