import type { MouseEvent } from "react";
import { InspectorHistoryRemove } from "@/components/player/InspectorHistoryRemove";
import { PlayerFact } from "@/components/player/PlayerFact";
import { PlayerRow } from "@/components/player/PlayerRow";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { collectionsSubmenu } from "@/lib/collection-menu";
import { openMenu } from "@/lib/menu";
import { formatClock } from "@/lib/player-format";
import type { PlayerCommands } from "@/lib/player-commands";
import type { PlayerView } from "@/lib/player-view";

export interface InspectorWatchProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
}

/** The Watch block (`06` section 5.4): progress and watched state, a Favourite switch, the collections the item is in with
 *  the Collections menu, and Remove from History. */
export function InspectorWatch({ view, commands }: InspectorWatchProps) {
  const { tab, item, favorite, memberIds, collections } = view;
  if (tab === undefined) return null;
  const progress = item?.progress;
  const watched = progress?.state === "watched";
  const progressText =
    progress === undefined
      ? "Not started"
      : watched
        ? "Watched"
        : progress.durationMs === undefined
          ? formatClock(progress.positionMs)
          : `${formatClock(progress.positionMs)} of ${formatClock(progress.durationMs)}`;
  const memberNames = collections.filter((collection) => memberIds.includes(collection.id)).map((c) => c.name);

  /* The menu opens under its button, at the button's left edge. */
  const openCollections = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    openMenu(
      {
        clientX: box.left,
        clientY: box.bottom,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      },
      [
        collectionsSubmenu(
          collections,
          (id) => memberIds.includes(id),
          (id) => commands.toggleMember(id),
        ),
      ],
    );
  };

  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <PlayerFact label="Progress" value={progressText} />
      <PlayerFact label="Watched" value={watched ? "Yes" : "No"} />
      <PlayerFact label="Last watched" value="-" />
      <PlayerRow label="Favourite">
        <Switch label="Favourite" checked={favorite} onChange={commands.favorite} />
      </PlayerRow>
      <PlayerRow label="Collections">
        <Button size="sm" onClick={openCollections}>
          Collections
        </Button>
      </PlayerRow>
      {memberNames.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pb-1">
          {memberNames.map((name) => (
            <span key={name} className="rounded-ctl border border-hair px-1.5 py-0.5 text-[11px] text-muted">
              {name}
            </span>
          ))}
        </div>
      )}
      {progress !== undefined && <InspectorHistoryRemove watchId={item?.watchId} onRemove={commands.removeHistory} />}
    </div>
  );
}
