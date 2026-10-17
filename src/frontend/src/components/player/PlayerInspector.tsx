import { InspectorDetails } from "@/components/player/InspectorDetails";
import { InspectorGroup } from "@/components/player/InspectorGroup";
import { InspectorOverview } from "@/components/player/InspectorOverview";
import { InspectorWatch } from "@/components/player/InspectorWatch";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { INSPECTOR_SKELETON_COUNT } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import type { PlayerView } from "@/lib/player-view";

export interface PlayerInspectorProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
}

/** The right pane (`06` section 5.4): three folding blocks, Overview, Details and Watch. With no tab open it is skeletons. */
export function PlayerInspector({ view, commands }: PlayerInspectorProps) {
  if (view.tab === undefined) return <SkeletonRows count={INSPECTOR_SKELETON_COUNT} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <InspectorGroup id="player:overview" title="Overview" info="The poster, the identity, the plot and the rating.">
        <InspectorOverview view={view} />
      </InspectorGroup>
      <InspectorGroup id="player:details" title="Details" info="Genres, cast and the runtime or seasons of this title.">
        <InspectorDetails view={view} />
      </InspectorGroup>
      <InspectorGroup id="player:watch" title="Watch" info="Progress, favourite and the collections this title is in.">
        <InspectorWatch view={view} commands={commands} />
      </InspectorGroup>
    </div>
  );
}
