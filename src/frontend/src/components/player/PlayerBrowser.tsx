import { EpisodeBrowser } from "@/components/player/EpisodeBrowser";
import { LocalFileFacts } from "@/components/player/LocalFileFacts";
import { MovieChapter } from "@/components/player/MovieChapter";
import { PlayerRow } from "@/components/player/PlayerRow";
import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/NumberField";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { BROWSER_SKELETON_COUNT, NO_SEASONS_REASON } from "@/lib/player-copy";
import { episodeMarker, type PlayerView } from "@/lib/player-view";

export interface PlayerBrowserProps {
  readonly view: PlayerView;
  readonly onSeason: (season: number) => void;
  readonly onEpisode: (season: number, episode: number) => void;
}

/** The left pane (`06` section 5.2): a series' season select over its episode rows, a movie's facts, or a local file's
 *  facts. One thing, so no collapsible section around it; the episode list is the pane's one scroll container. With
 *  nothing open it is skeletons. */
export function PlayerBrowser({ view, onSeason, onEpisode }: PlayerBrowserProps) {
  const { tab, item, detail, seasons, season, episode } = view;
  if (tab === undefined) {
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <SkeletonRows count={BROWSER_SKELETON_COUNT} />
      </div>
    );
  }

  if (tab.kind !== "tv") {
    return (
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.25 overflow-y-auto p-2.5">
        {tab.kind === "local" && item !== undefined && <LocalFileFacts item={item} />}
        {tab.kind === "movie" && <MovieChapter runtimeMs={detail?.runtimeMs} quality={item?.quality} />}
      </div>
    );
  }

  const noSeasons = seasons.length === 0;
  return (
    <div className="flex min-w-[180px] flex-1 flex-col overflow-hidden">
      <div className="flex-none p-2.5">
        <PlayerRow label="Season" disabled={noSeasons} reason={NO_SEASONS_REASON}>
          <Select
            aria-label="Season"
            className={FIELD_CONTROL}
            value={season === undefined ? "" : String(season)}
            disabled={noSeasons}
            onChange={(event) => onSeason(Number(event.target.value))}
          >
            {seasons.map((entry) => (
              <option key={entry.season} value={String(entry.season)}>
                {`Season ${entry.season}`}
              </option>
            ))}
          </Select>
        </PlayerRow>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-hair">
        <EpisodeBrowser
          episodes={view.episodes}
          selected={episode}
          markerOf={(number) => episodeMarker(item?.progress, season, number)}
          onSelect={(number) => {
            if (season !== undefined) onEpisode(season, number);
          }}
        />
      </div>
    </div>
  );
}
