import { CHIP } from "@/components/player/inspector-chip";
import { PlayerFact } from "@/components/player/PlayerFact";
import { PosterImage } from "@/components/ui/PosterImage";
import type { PlayerView } from "@/lib/player-view";

const KIND_LABEL = { movie: "Movie", tv: "Series", local: "Local file" } as const;
const TOP_GENRES = 3;

export interface InspectorOverviewProps {
  readonly view: PlayerView;
}

/** The Overview block (`06` section 5.4): a 2:3 poster, capped at 120 px wide so Details and Watch fit beneath it, the
 *  identity, the plot, the rating and the top genres. Quality is drawn only when the library holds a real value. */
export function InspectorOverview({ view }: InspectorOverviewProps) {
  const { tab, item, detail } = view;
  if (tab === undefined) return null;
  const year = detail?.year ?? item?.year;
  const quality = item?.quality;
  const genres = (detail?.genres ?? item?.genres ?? []).slice(0, TOP_GENRES);
  return (
    <>
      <div className="w-[120px] max-w-full">
        <PosterImage src={detail?.posterUrl ?? item?.posterUrl} alt={tab.title} />
      </div>
      <span className="text-sm leading-5 font-semibold text-text">{tab.title}</span>
      <div className="flex flex-col gap-1.25">
        {year !== undefined && <PlayerFact label="Year" value={String(year)} />}
        <PlayerFact label="Kind" value={KIND_LABEL[tab.kind]} />
        {quality !== undefined && <PlayerFact label="Quality" value={quality} />}
        {detail?.rating !== undefined && <PlayerFact label="Rating" value={`${detail.rating.toFixed(1)} / 10`} />}
      </div>
      {detail?.plot !== undefined && <p className="m-0 text-sm leading-5 text-muted">{detail.plot}</p>}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {genres.map((genre) => (
            <span key={genre} className={CHIP}>
              {genre}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
