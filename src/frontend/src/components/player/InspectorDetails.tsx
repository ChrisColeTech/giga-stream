import { CHIP } from "@/components/player/inspector-chip";
import { PlayerFact } from "@/components/player/PlayerFact";
import { FIELD_LABEL } from "@/components/ui/NumberField";
import { formatRuntime } from "@/lib/player-format";
import type { PlayerView } from "@/lib/player-view";

export interface InspectorDetailsProps {
  readonly view: PlayerView;
}

/** A labelled list of names: the rail label over its chips. */
function Names({ label, names }: { readonly label: string; readonly names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {names.map((name) => (
          <span key={name} className={CHIP}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The Details block (`06` section 5.4): the runtime or the season count, the genres and the cast. The episode on show is
 *  Overview's subtitle, so it is not repeated here. */
export function InspectorDetails({ view }: InspectorDetailsProps) {
  const { tab, item, detail, seasons } = view;
  if (tab === undefined) return null;

  return (
    <>
      {tab.kind === "movie" && detail?.runtimeMs !== undefined && (
        <PlayerFact label="Runtime" value={formatRuntime(detail.runtimeMs)} />
      )}
      {tab.kind === "tv" && <PlayerFact label="Seasons" value={String(seasons.length)} />}
      <Names label="Genres" names={detail?.genres ?? item?.genres ?? []} />
      <Names label="Cast" names={detail?.cast ?? []} />
    </>
  );
}
