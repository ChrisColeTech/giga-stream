import { Button } from "@giga/ui/controls/Button";
import type { EpisodeAdjacency } from "@/lib/episode-adjacency";
import { EPISODE_SWITCH_REASON } from "@/lib/player-copy";

export interface EpisodeFooterNavigationProps {
  readonly adjacency: EpisodeAdjacency;
  readonly switching: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

/** Compact series-only navigation. Native and provider controls continue to own media transport. */
export function EpisodeFooterNavigation(props: EpisodeFooterNavigationProps) {
  const previousReason = props.switching ? EPISODE_SWITCH_REASON : props.adjacency.previous.reason;
  const nextReason = props.switching ? EPISODE_SWITCH_REASON : props.adjacency.next.reason;
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" aria-label="Previous episode" reason={previousReason}
        onClick={props.onPrevious}>Previous</Button>
      <Button size="sm" aria-label="Next episode" reason={nextReason}
        onClick={props.onNext}>Next</Button>
    </div>
  );
}
