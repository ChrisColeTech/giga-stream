import { EpisodeBrowser } from "@/components/player/EpisodeBrowser";
import { EpisodeRow } from "@/components/player/EpisodeRow";
import { Select } from "@/components/ui/Field";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { progressRatio } from "@/lib/library-facts";
import {
  BROWSER_SKELETON_COUNT, NO_SEASONS_REASON, PLAYER_IDLE_CONTROL_REASON, PLAYER_LOADING_REASON,
} from "@/lib/player-copy";
import { episodeMarker, type EpisodeMarker, type PlayerView } from "@/lib/player-view";

export interface PlayerBrowserProps {
  readonly view: PlayerView;
  readonly onSeason: (season: number) => void;
  readonly onEpisode: (season: number, episode: number) => void;
  readonly loading: boolean;
}

/** The left pane (`06` section 5.2): a series' season select over its episode rows, or a movie or local file as one row
 *  of the same shape. No collapsible section wraps it; idle keeps the season control visibly disabled. */
export function PlayerBrowser({ view, onSeason, onEpisode, loading }: PlayerBrowserProps) {
  const { tab, item, detail, seasons, season, episode } = view;
  if (tab === undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-none p-2.5" title={PLAYER_IDLE_CONTROL_REASON}>
          <Select aria-label="Season" value="" disabled><option value="">Season</option></Select>
        </div>
        <div className="min-h-0 flex-1 border-t border-hair" />
      </div>
    );
  }

  if (loading && tab.kind !== "tv") return <SkeletonRows count={BROWSER_SKELETON_COUNT} />;

  if (tab.kind !== "tv") {
    /* A movie or a local file is one row in the episode row's own shape, so the rail reads the same for every kind:
       its picture, its title, and "Movie" or "Local file" with the runtime; selected, since it is what is open. */
    const progress = item?.progress;
    const ratio = progress === undefined ? undefined : progressRatio(progress);
    const marker: EpisodeMarker | undefined =
      progress === undefined
        ? undefined
        : progress.state === "watched"
          ? { watched: true }
          : { watched: false, fraction: ratio ?? 0 };
    return (
      <div className="min-h-0 min-w-[180px] flex-1 overflow-y-auto">
        <EpisodeRow
          episode={{
            season: 0,
            episode: 1,
            title: tab.title,
            runtimeMs: detail?.runtimeMs ?? view.local?.info?.durationMs,
            stillUrl: item?.posterUrl,
          }}
          code={tab.kind === "movie" ? "Movie" : "Local file"}
          selected
          marker={marker}
        />
      </div>
    );
  }

  const noSeasons = seasons.length === 0;
  const disabledReason = loading ? PLAYER_LOADING_REASON : noSeasons ? NO_SEASONS_REASON : undefined;
  return (
    <div className="flex min-w-[180px] flex-1 flex-col overflow-hidden">
      {/* No label: every option reads "Season N", so the select names itself. */}
      <div className="flex-none p-2.5" title={disabledReason}>
        <Select
          aria-label="Season"
          value={season === undefined ? "" : String(season)}
          disabled={loading || noSeasons}
          onChange={(event) => onSeason(Number(event.target.value))}
        >
          {seasons.map((entry) => (
            <option key={entry.season} value={String(entry.season)}>
              {`Season ${entry.season}`}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-hair">
        {loading ? <SkeletonRows count={BROWSER_SKELETON_COUNT} /> : <EpisodeBrowser
          episodes={view.episodes}
          selected={episode}
          markerOf={(number) => episodeMarker(item?.progress, season, number)}
          onSelect={(number) => {
            if (season !== undefined) onEpisode(season, number);
          }}
        />}
      </div>
    </div>
  );
}
