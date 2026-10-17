import { EpisodeRow } from "@/components/player/EpisodeRow";
import type { EpisodeMarker } from "@/lib/player-view";
import type { Episode } from "@/types/title";

export interface EpisodeBrowserProps {
  /** The episodes of the season on show. The parent owns the pending-request skeleton. */
  readonly episodes: readonly Episode[];
  /** The exact episode the tab names, by number. */
  readonly selected: number | undefined;
  readonly markerOf: (episode: number) => EpisodeMarker | undefined;
  readonly onSelect: (episode: number) => void;
}

/** The episode rows of one season, edge to edge like LoRA Studio's queue. */
export function EpisodeBrowser({ episodes, selected, markerOf, onSelect }: EpisodeBrowserProps) {
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
