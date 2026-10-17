import { InspectorDetails } from "@/components/player/InspectorDetails";
import { InspectorOverview } from "@/components/player/InspectorOverview";
import { ResumeFooter } from "@/components/player/ResumeFooter";
import { Section } from "@/components/ui/Section";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { INSPECTOR_SKELETON_COUNT } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import { resumeOf, type PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

export interface PlayerInspectorProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  /** Whether the video is paused; Resume and Start over show only then. */
  readonly paused: boolean;
}

/** The right pane (`06` section 5.4): Overview and Details on the family accordion, each open block taking its share and
 *  scrolling inside itself, and Resume pinned at the foot while the video is paused. The item's marks (favorite,
 *  collections, history) are the stage's context menu. With nothing open it is skeletons. */
export function PlayerInspector({ view, commands, paused }: PlayerInspectorProps) {
  const folded = useAppStore((state) => state.folded);
  const toggleFold = useAppStore((state) => state.toggleFold);
  if (view.tab === undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SkeletonRows count={INSPECTOR_SKELETON_COUNT} />
      </div>
    );
  }
  const resume = resumeOf(view);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Section title="Overview" open={folded["player:overview"] !== true} onToggle={() => toggleFold("player:overview")}>
        <InspectorOverview view={view} />
      </Section>
      <Section title="Details" open={folded["player:details"] !== true} onToggle={() => toggleFold("player:details")}>
        <InspectorDetails view={view} />
      </Section>
      {paused && resume !== undefined && (
        <ResumeFooter progress={resume} onResume={commands.resume} onStartOver={commands.startOver} />
      )}
    </div>
  );
}
