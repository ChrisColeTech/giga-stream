import { PlayerFact } from "@/components/player/PlayerFact";
import { formatEpisodeCode, formatRuntime } from "@/lib/player-format";
import type { PlayerView } from "@/lib/player-view";

export interface InspectorDetailsProps {
  readonly view: PlayerView;
}

/** The Details block (`06` section 5.4): genres, cast chips, the runtime or the season count, the selected season and
 *  episode for a series, and a local file's facts, all as read-only facts. */
export function InspectorDetails({ view }: InspectorDetailsProps) {
  const { tab, item, detail, season, episode, seasons } = view;
  if (tab === undefined) return null;
  const genres = detail?.genres ?? item?.genres ?? [];
  const cast = detail?.cast ?? [];

  return (
    <div className="flex flex-col gap-1.5 px-2.5 pt-1">
      {tab.kind === "movie" && detail?.runtimeMs !== undefined && (
        <PlayerFact label="Runtime" value={formatRuntime(detail.runtimeMs)} />
      )}
      {tab.kind === "tv" && <PlayerFact label="Seasons" value={String(seasons.length)} />}
      {tab.kind === "tv" && season !== undefined && episode !== undefined && (
        <PlayerFact label="Selected" value={formatEpisodeCode(season, episode)} />
      )}
      {tab.kind === "local" && item?.quality !== undefined && <PlayerFact label="Quality" value={item.quality} />}
      {genres.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-sans text-xs text-muted">Genres</span>
          <div className="flex flex-wrap gap-1">
            {genres.map((genre) => (
              <span key={genre} className="rounded-ctl bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}
      {cast.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-sans text-xs text-muted">Cast</span>
          <div className="flex flex-wrap gap-1">
            {cast.map((name) => (
              <span key={name} className="rounded-ctl border border-hair px-1.5 py-0.5 font-mono text-[11px] text-muted">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
