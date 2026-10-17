import { InspectorDetails } from "@/components/player/InspectorDetails";
import { InspectorOverview } from "@/components/player/InspectorOverview";
import { InspectorWatch } from "@/components/player/InspectorWatch";
import { Section } from "@/components/ui/Section";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { INSPECTOR_SKELETON_COUNT } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import type { PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

export interface PlayerInspectorProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
}

/** The right pane (`06` section 5.4): three collapsible blocks on the family accordion, Overview, Details and Watch. The
 *  pane is a definite-height column, and each open block takes its share and scrolls inside itself. With nothing open it
 *  is skeletons. */
export function PlayerInspector({ view, commands }: PlayerInspectorProps) {
  const folded = useAppStore((state) => state.folded);
  const toggleFold = useAppStore((state) => state.toggleFold);
  if (view.tab === undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SkeletonRows count={INSPECTOR_SKELETON_COUNT} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Section title="Overview" open={folded["player:overview"] !== true} onToggle={() => toggleFold("player:overview")}>
        <InspectorOverview view={view} />
      </Section>
      <Section title="Details" open={folded["player:details"] !== true} onToggle={() => toggleFold("player:details")}>
        <InspectorDetails view={view} />
      </Section>
      <Section title="Watch" open={folded["player:watch"] !== true} onToggle={() => toggleFold("player:watch")}>
        <InspectorWatch view={view} commands={commands} />
      </Section>
    </div>
  );
}
