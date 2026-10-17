import { EpisodeRow } from "@/components/player/EpisodeRow";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { EPISODE_SKELETON_COUNT } from "@/lib/player-copy";
import type { EpisodeMarker } from "@/lib/player-view";
import type { Episode } from "@/types/title";

export interface EpisodeBrowserProps {
  /** The episodes of the season on show; empty while they are not known, drawn as skeletons. */
  readonly episodes: readonly Episode[];
  /** The exact episode the tab names, by number. */
  readonly selected: number | undefined;
  readonly markerOf: (episode: number) => EpisodeMarker | undefined;
  readonly onSelect: (episode: number) => void;
}

/** The episode rows of one season, edge to edge like LoRA Studio's queue. Loading and empty are the same skeleton. */
export function EpisodeBrowser({ episodes, selected, markerOf, onSelect }: EpisodeBrowserProps) {
  if (episodes.length === 0) return <SkeletonRows count={EPISODE_SKELETON_COUNT} />;
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {episodes.map((episode) => (
        <li key={episode.episode}>
          <EpisodeRow
            episode={episode}
            selected={selected === episode.episode}
            marker={markerOf(episode.episode)}
            onSelect={() => onSelect(episode.episode)}
          />
        </li>
      ))}
    </ul>
  );
}
