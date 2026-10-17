import { InspectorArt } from "@/components/player/InspectorArt";
import { PlayerFact } from "@/components/player/PlayerFact";
import { stageSubtitle, type PlayerView } from "@/lib/player-view";

export interface InspectorOverviewProps {
  readonly view: PlayerView;
}

/** The Overview block (`06` section 5.4): the art, the title once with the episode or file under it, the year and rating,
 *  and the plot. Quality is drawn only when the library holds a real value. */
export function InspectorOverview({ view }: InspectorOverviewProps) {
  const { tab, item, detail } = view;
  if (tab === undefined) return null;
  const year = detail?.year ?? item?.year;
  const quality = item?.quality;
  const subtitle = stageSubtitle(view);
  return (
    <>
      <InspectorArt src={detail?.posterUrl ?? item?.posterUrl} title={tab.title} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm leading-5 font-semibold text-text">{tab.title}</span>
        {subtitle !== undefined && <span className="truncate font-mono text-xs text-faint">{subtitle}</span>}
      </div>
      <div className="flex flex-col gap-1.25">
        {year !== undefined && tab.kind === "tv" && <PlayerFact label="Year" value={String(year)} />}
        {quality !== undefined && <PlayerFact label="Quality" value={quality} />}
        {detail?.rating !== undefined && <PlayerFact label="Rating" value={`${detail.rating.toFixed(1)} / 10`} />}
      </div>
      {detail?.plot !== undefined && <p className="m-0 text-sm leading-5 text-muted">{detail.plot}</p>}
    </>
  );
}
