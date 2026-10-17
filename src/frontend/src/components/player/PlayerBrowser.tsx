import { EpisodeBrowser } from "@/components/player/EpisodeBrowser";
import { LocalFileFacts } from "@/components/player/LocalFileFacts";
import { MovieChapter } from "@/components/player/MovieChapter";
import { PlayerRow } from "@/components/player/PlayerRow";
import { Select } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/NumberField";
import { Section } from "@/components/ui/Section";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { BROWSER_SKELETON_COUNT, NO_SEASONS_REASON } from "@/lib/player-copy";
import { episodeMarker, type PlayerView } from "@/lib/player-view";
import { useAppStore } from "@/store/app-store";

const FOLD_ID = "player:browser";

export interface PlayerBrowserProps {
  readonly view: PlayerView;
  readonly onSeason: (season: number) => void;
  readonly onEpisode: (season: number, episode: number) => void;
}

/** The left pane (`06` section 5.2), laid out as LoRA Studio's compose rail: one family Section holding a series' season
 *  select and episode rows, a movie's facts, or a local file's facts. With nothing open it is skeletons. */
export function PlayerBrowser({ view, onSeason, onEpisode }: PlayerBrowserProps) {
  const open = useAppStore((state) => state.folded[FOLD_ID] !== true);
  const toggleFold = useAppStore((state) => state.toggleFold);
  const { tab, item, detail, seasons, season, episode } = view;
  if (tab === undefined) {
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <SkeletonRows count={BROWSER_SKELETON_COUNT} />
      </div>
    );
  }

  const title = tab.kind === "local" ? "File" : tab.kind === "movie" ? "Movie" : "Episodes";
  const noSeasons = seasons.length === 0;

  return (
    <div className="flex min-w-[180px] flex-1 flex-col overflow-hidden">
      <Section title={title} open={open} onToggle={() => toggleFold(FOLD_ID)}>
        {tab.kind === "local" && item !== undefined && <LocalFileFacts item={item} />}
        {tab.kind === "movie" && <MovieChapter runtimeMs={detail?.runtimeMs} quality={item?.quality} />}
        {tab.kind === "tv" && (
          <>
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
            <div className="-mx-2.5 border-t border-hair">
              <EpisodeBrowser
                episodes={view.episodes}
                selected={episode}
                markerOf={(number) => episodeMarker(item?.progress, season, number)}
                onSelect={(number) => {
                  if (season !== undefined) onEpisode(season, number);
                }}
              />
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
