import { EpisodeBrowser } from "@/components/player/EpisodeBrowser";
import { LocalFileFacts } from "@/components/player/LocalFileFacts";
import { MovieChapter } from "@/components/player/MovieChapter";
import { Select } from "@/components/ui/Field";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { BROWSER_SKELETON_COUNT, NO_SEASONS_REASON } from "@/lib/player-copy";
import { episodeMarker, type PlayerView } from "@/lib/player-view";

export interface PlayerBrowserProps {
  readonly view: PlayerView;
  readonly onSeason: (season: number) => void;
  readonly onEpisode: (season: number, episode: number) => void;
}

/** The left pane (`06` section 5.2): a series' season select and episode rows, a movie's chapter, or a local file's facts.
 *  With no tab open it is skeletons. */
export function PlayerBrowser({ view, onSeason, onEpisode }: PlayerBrowserProps) {
  const { tab, item, detail, seasons, season, episode } = view;
  if (tab === undefined) {
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <SkeletonRows count={BROWSER_SKELETON_COUNT} />
      </div>
    );
  }

  if (tab.kind === "local") {
    return item === undefined ? null : <LocalFileFacts item={item} />;
  }

  if (tab.kind === "movie") {
    return <MovieChapter title={tab.title} runtimeMs={detail?.runtimeMs} quality={item?.quality} />;
  }

  const noSeasons = seasons.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-col gap-2 border-b border-hair p-2.5">
        <span className="truncate text-sm font-semibold text-text">{tab.title}</span>
        <Select
          aria-label="Season"
          value={season === undefined ? "" : String(season)}
          disabled={noSeasons}
          title={noSeasons ? NO_SEASONS_REASON : "Season"}
          onChange={(event) => onSeason(Number(event.target.value))}
        >
          {seasons.map((entry) => (
            <option key={entry.season} value={String(entry.season)}>
              {`Season ${entry.season} · ${entry.episodeCount}`}
            </option>
          ))}
        </Select>
      </div>
      <EpisodeBrowser
        episodes={view.episodes}
        selected={episode}
        markerOf={(number) => episodeMarker(item?.progress, season, number)}
        onSelect={(number) => {
          if (season !== undefined) onEpisode(season, number);
        }}
      />
    </div>
  );
}
