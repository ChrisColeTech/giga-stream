import { PlayerFact } from "@/components/player/PlayerFact";
import type { LibraryItem } from "@/types/library";

export interface LocalFileFactsProps {
  readonly item: LibraryItem;
}

/** A local file's identity and facts (`06` section 5.2): its display name and the facts the library holds. No path, and
 *  no chapters are invented. A value the library does not hold is not drawn. */
export function LocalFileFacts({ item }: LocalFileFactsProps) {
  return (
    <div className="flex flex-col gap-1 p-2.5">
      <span className="truncate px-2.5 text-[13px] font-semibold text-text">{item.title}</span>
      <div className="flex flex-col gap-0.5 pt-1">
        <PlayerFact label="Kind" value="Local file" />
        {item.year !== undefined && <PlayerFact label="Year" value={String(item.year)} />}
        {item.quality !== undefined && <PlayerFact label="Quality" value={item.quality} />}
      </div>
    </div>
  );
}
