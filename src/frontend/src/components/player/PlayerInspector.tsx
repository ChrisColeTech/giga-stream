import { InspectorDetails } from "@/components/player/InspectorDetails";
import { InspectorOverview } from "@/components/player/InspectorOverview";
import { ResumeFooter } from "@/components/player/ResumeFooter";
import { PlayerSourceControl, type PlayerSourceControlProps } from "./PlayerSourceControl";
import { Section } from "@giga/ui/lists/Section";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { INSPECTOR_SKELETON_COUNT } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import { resumeOf, type PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

export interface PlayerInspectorProps extends PlayerSourceControlProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  /** Whether the video is paused; Resume and Start over show only then. */
  readonly paused: boolean;
  readonly loading: boolean;
}

/** The right pane (`06` section 5.4): Overview and Details on the family accordion, each open block taking its share and
 *  scrolling inside itself, and Resume / Start over always pinned at the foot.
 *  The item's marks (favorite, collections, history) are the stage's context menu. Idle keeps the sections and
 *  substitutes skeletons for their content. */
export function PlayerInspector({ view, commands, paused, loading, sources, activeId, onSelect }: PlayerInspectorProps) {
  const folded = useAppStore((state) => state.folded);
  const toggleFold = useAppStore((state) => state.toggleFold);
  const hasSource = sources.length > 0;
  const resume = resumeOf(view);
  const unread = loading || view.tab === undefined;
  const unavailable = view.tab === undefined ? "Open a title or file first."
    : loading ? "Playback information is loading."
    : !hasSource ? "No playable source is selected."
    : !paused ? "Pause playback first." : undefined;
  const resumeReason = unavailable ?? (resume === undefined ? "There is no saved position to resume." : undefined);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* The sections' own column always fills, so closing them never pulls the footer up off the pane's foot. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Section title="Overview" open={folded["player:overview"] !== true} onToggle={() => toggleFold("player:overview")}>
          {unread ? <SkeletonRows count={INSPECTOR_SKELETON_COUNT / 2} />
            : <InspectorOverview view={view} />}
        </Section>
        <Section title="Details" open={folded["player:details"] !== true} onToggle={() => toggleFold("player:details")}>
          {unread ? <SkeletonRows count={INSPECTOR_SKELETON_COUNT / 2} />
            : <InspectorDetails view={view} />}
        </Section>
      </div>
      <ResumeFooter progress={resume} resumeReason={resumeReason} startOverReason={unavailable}
        onResume={commands.resume} onStartOver={commands.startOver}>
        <PlayerSourceControl sources={sources} activeId={activeId} onSelect={onSelect} />
      </ResumeFooter>
    </div>
  );
}
