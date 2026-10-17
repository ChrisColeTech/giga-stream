import { InspectorDetails } from "@/components/player/InspectorDetails";
import { InspectorOverview } from "@/components/player/InspectorOverview";
import { PlayerFact } from "@/components/player/PlayerFact";
import { ResumeFooter } from "@/components/player/ResumeFooter";
import { Section } from "@/components/ui/Section";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { INSPECTOR_SKELETON_COUNT, PLAYER_IDLE_CONTROL_REASON } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import { resumeOf, type PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

export interface PlayerInspectorProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  /** Whether the video is paused; Resume and Start over show only then. */
  readonly paused: boolean;
  readonly loading: boolean;
}

/** The right pane (`06` section 5.4): Overview and Details on the family accordion, each open block taking its share and
 *  scrolling inside itself, and Resume pinned at the foot while the video is paused (when the Resume setting is Ask).
 *  The item's marks (favorite, collections, history) are the stage's context menu. Idle keeps both blocks visible. */
export function PlayerInspector({ view, commands, paused, loading }: PlayerInspectorProps) {
  const folded = useAppStore((state) => state.folded);
  const toggleFold = useAppStore((state) => state.toggleFold);
  /* Resume and Start over are the "Ask" answer of the Resume setting; set to always resume or always start over, the
     Player has already done that on opening and asks nothing. */
  const asks = useAppStore((state) => state.playback.resumeMode) === "ask";
  const resume = resumeOf(view);
  const idle = view.tab === undefined;
  const placeholder = (label: string) => (
    <div title={PLAYER_IDLE_CONTROL_REASON}><PlayerFact label={label} value="-" /></div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* The sections' own column always fills, so closing them never pulls the footer up off the pane's foot. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Section title="Overview" open={folded["player:overview"] !== true} onToggle={() => toggleFold("player:overview")}>
          {loading ? <SkeletonRows count={INSPECTOR_SKELETON_COUNT / 2} />
            : idle ? <>{placeholder("Title")}{placeholder("Year")}</> : <InspectorOverview view={view} />}
        </Section>
        <Section title="Details" open={folded["player:details"] !== true} onToggle={() => toggleFold("player:details")}>
          {loading ? <SkeletonRows count={INSPECTOR_SKELETON_COUNT / 2} />
            : idle ? <>{placeholder("Runtime")}{placeholder("Genres")}</> : <InspectorDetails view={view} />}
        </Section>
      </div>
      {asks && paused && resume !== undefined && (
        <ResumeFooter progress={resume} onResume={commands.resume} onStartOver={commands.startOver} />
      )}
    </div>
  );
}
