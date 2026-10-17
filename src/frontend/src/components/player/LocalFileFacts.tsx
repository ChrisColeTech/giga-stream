import { PlayerFact } from "@/components/player/PlayerFact";
import type { LibraryItem } from "@/types/library";

export interface LocalFileFactsProps {
  readonly item: LibraryItem;
}

/** A local file's identity and facts (`06` section 5.2): its display name and the facts the library holds, as rail
 *  facts. No path, and no chapters are invented. A value the library does not hold is not drawn. */
export function LocalFileFacts({ item }: LocalFileFactsProps) {
  return (
    <>
      <PlayerFact label="Name" value={item.title} />
      <PlayerFact label="Kind" value="Local file" />
      {item.year !== undefined && <PlayerFact label="Year" value={String(item.year)} />}
      {item.quality !== undefined && <PlayerFact label="Quality" value={item.quality} />}
    </>
  );
}
