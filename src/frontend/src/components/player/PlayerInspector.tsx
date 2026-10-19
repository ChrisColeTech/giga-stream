import { InspectorDetails } from "@/components/player/InspectorDetails";
import { InspectorOverview } from "@/components/player/InspectorOverview";
import { ResumeFooter } from "@/components/player/ResumeFooter";
import { EpisodeFooterNavigation } from "@/components/player/EpisodeFooterNavigation";
import { PlayerSourceControl, type PlayerSourceControlProps } from "./PlayerSourceControl";
import { Section } from "@giga/ui/lists/Section";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { INSPECTOR_SKELETON_COUNT, UNSUPPORTED_RESUME_REASON } from "@/lib/player-copy";
import type { PlayerCommands } from "@/lib/player-commands";
import type { EpisodeAdjacency } from "@/lib/episode-adjacency";
import { canResumeSource, type PlayerSource } from "@/lib/player-sources";
import { resumeOf, type PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

export interface PlayerInspectorProps extends PlayerSourceControlProps {
  readonly view: PlayerView;
  readonly commands: PlayerCommands;
  /** Whether the video is paused; Resume and Start over show only then. */
  readonly paused: boolean;
  readonly loading: boolean;
  readonly activeSource?: PlayerSource;
  readonly adjacency?: EpisodeAdjacency;
  readonly switchingEpisode: boolean;
  readonly onEpisode: (season: number, episode: number) => void;
}

/** The right pane (`06` section 5.4): Overview and Details on the family accordion, each open block taking its share and
 *  scrolling inside itself, and Resume / Start over always pinned at the foot.
 *  The item's marks (favorite, collections, history) are the stage's context menu. Idle keeps the sections and
 *  substitutes skeletons for their content. */
export function PlayerInspector(props: PlayerInspectorProps) {
  const { view, commands, paused, loading, sources, activeId, onSelect } = props;
  const folded = useAppStore((state) => state.folded);
  const toggleFold = useAppStore((state) => state.toggleFold);
  const hasSource = sources.length > 0;
  const resume = resumeOf(view);
  const unread = loading || view.tab === undefined;
  const unavailable = view.tab === undefined ? "Open a title or file first."
    : loading ? "Playback information is loading."
    : !hasSource ? "No playable source is selected."
    : !paused ? "Pause playback first." : undefined;
  const resumeReason = unavailable ?? (resume === undefined
    ? "There is no saved position to resume."
    : !canResumeSource(props.activeSource) ? UNSUPPORTED_RESUME_REASON : undefined);
  const episodeNavigation = props.adjacency === undefined ? undefined : (
    <EpisodeFooterNavigation adjacency={props.adjacency} switching={props.switchingEpisode}
      onPrevious={() => {
        const target = props.adjacency?.previous.target;
        if (target !== undefined) props.onEpisode(target.season, target.episode);
      }} onNext={() => {
        const target = props.adjacency?.next.target;
        if (target !== undefined) props.onEpisode(target.season, target.episode);
      }} />
  );
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
        onResume={commands.resume} onStartOver={commands.startOver}
        source={<PlayerSourceControl sources={sources} activeId={activeId} onSelect={onSelect} />}
        episodeNavigation={episodeNavigation} />
    </div>
  );
}
