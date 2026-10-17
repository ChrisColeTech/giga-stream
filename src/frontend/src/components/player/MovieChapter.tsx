import { PlayerFact } from "@/components/player/PlayerFact";
import { formatRuntime } from "@/lib/player-format";

export interface MovieChapterProps {
  readonly runtimeMs: number | undefined;
  readonly quality: string | undefined;
}

/** A movie's compact chapter (`06` section 5.2): its kind, and its duration and quality when known, as rail facts. No
 *  season rows are invented for a film. */
export function MovieChapter({ runtimeMs, quality }: MovieChapterProps) {
  return (
    <>
      <PlayerFact label="Kind" value="Movie" />
      {runtimeMs !== undefined && <PlayerFact label="Runtime" value={formatRuntime(runtimeMs)} />}
      {quality !== undefined && <PlayerFact label="Quality" value={quality} />}
    </>
  );
}
