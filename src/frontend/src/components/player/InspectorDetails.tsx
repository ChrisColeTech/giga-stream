import { NAME_CHIP } from "@/components/ui/name-chip";
import { PlayerFact } from "@/components/player/PlayerFact";
import { FIELD_LABEL } from "@/components/ui/NumberField";
import { cn } from "@/lib/cn";
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
      {/* Over its chips, not beside them, so the label needs no column: the rail label's type at its own width. */}
      <span className={cn(FIELD_LABEL, "w-auto!")}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {names.map((name) => (
          <span key={name} className={NAME_CHIP}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

const fileSize = (bytes: number): string => `${(bytes / 1_048_576).toFixed(1)} MB`;

/** The Details block (`06` section 5.4): the runtime or the season count, the genres and the cast. The episode on show is
 *  Overview's subtitle, so it is not repeated here. A local file has no catalogue entry, so its Details are the file's
 *  own facts: the year, its length once it has been played, and the collections it is in. */
export function InspectorDetails({ view }: InspectorDetailsProps) {
  const { tab, item, detail, seasons, memberIds, collections } = view;
  if (tab === undefined) return null;

  if (tab.kind === "local") {
    const info = view.local?.info;
    const duration = info?.durationMs ?? item?.progress?.durationMs;
    const names = collections.filter((row) => memberIds.includes(row.id)).map((row) => row.name);
    return (
      <>
        {item?.year !== undefined && <PlayerFact label="Year" value={String(item.year)} />}
        {duration !== undefined && <PlayerFact label="Duration" value={formatRuntime(duration)} />}
        {info?.width !== undefined && info.height !== undefined && (
          <PlayerFact label="Resolution" value={`${info.width} x ${info.height}`} />
        )}
        {info?.container !== undefined && <PlayerFact label="Container" value={info.container} />}
        {info?.videoCodec !== undefined && <PlayerFact label="Video" value={info.videoCodec} />}
        {info?.audioCodec !== undefined && <PlayerFact label="Audio" value={info.audioCodec} />}
        {info?.sizeBytes !== undefined && <PlayerFact label="Size" value={fileSize(info.sizeBytes)} />}
        {info?.folderName !== undefined && info.folderName !== "" && (
          <PlayerFact label="Folder" value={info.folderName} />
        )}
        <Names label="Collections" names={names} />
      </>
    );
  }

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
