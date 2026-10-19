import { useCallback, useMemo } from "react";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import type { PlaylistEntry } from "@/types/admin-channel";
import { playlistEntryColumns, type PlaylistEntryRow } from "./playlist-entry-columns";

const idOf = (row: PlaylistEntryRow): string => String(row.position);

/** A live channel's playlist in play order (`36` section 6, Status; `52` decision 2): the standard read-only table -
 *  `#`, the name, the `mm:ss` - bounded, no ticks, nothing sortable, no record to open. The entry on air is the row's
 *  `state: "playing"` and its name cell draws in the accent. While the channel builds the host passes no entries and the
 *  table draws its skeleton rows in its own columns; above 100 entries it windows through a synthetic paging over its
 *  own array, and at or under 100 every row is mapped (`52` decision 4). */
export function PlaylistRows({
  playlist,
  playing,
}: {
  readonly playlist: readonly PlaylistEntry[];
  readonly playing: number | null;
}) {
  const rows = useMemo<PlaylistEntryRow[]>(
    () => playlist.map((entry, position) => ({ position, entry, onAir: position === playing })),
    [playlist, playing],
  );
  const rowAt = useCallback((index: number): PlaylistEntryRow | undefined => rows[index], [rows]);
  const rowView = (row: PlaylistEntryRow): RecordRowView => ({ state: row.onAir ? "playing" : undefined, end: null });
  return (
    <div className="w-full min-w-0">
      <RecordTable<PlaylistEntryRow>
        ariaLabel="Playlist"
        columns={playlistEntryColumns}
        paging={{ total: rows.length, rowAt, resetKey: "" }}
        idOf={idOf}
        rowView={rowView}
        ticks={false}
        size="bounded"
      />
    </div>
  );
}
