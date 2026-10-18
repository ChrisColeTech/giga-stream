import { useMemo } from "react";
import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { DELETE_TITLE } from "@/constants/playlist-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { playlistRow, type PlaylistRowView } from "@/lib/playlist-rows";
import { useAppStore } from "@/store/app-store";
import { playlistColumns } from "./playlist-columns";

const idOf = (row: PlaylistRowView): string => String(row.id);

/** The playlists table: a row for each playlist (name, source, the channel counts, last run, state) and the end `Delete`,
 *  an armed two-step whose question names the channels that go with the playlist. A disabled playlist stays in the list,
 *  dimmed. Skeleton rows in the same columns draw while nothing has been read and when there is nothing to list (never a
 *  sentence); a refresh and a failed read keep the rows they have. */
export function PlaylistRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.playlists);
  const tick = useAppStore((state) => state.playlistTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = usePlaylistActions();
  const waiting = items.length === 0 || status === "idle";
  const rows = useMemo(() => items.map(playlistRow), [items]);

  const rowView = (row: PlaylistRowView): RecordRowView => {
    const reason = unreachable ? UNREACHABLE_REASON : saving || isBusy(`delete:${row.id}`) ? SAVING_REASON : undefined;
    return {
      state: row.state.word,
      dimmed: row.state.dimmed,
      ticked: ticked.includes(row.id),
      tick: { label: `Select ${row.name}`, onToggle: (on) => tick(row.id, on) },
      onOpen: () => openWorkspace("playlists", String(row.id)),
      end: (
        <ArmedButton
          question={row.deleteQuestion}
          disabled={reason !== undefined}
          title={reason ?? DELETE_TITLE}
          onConfirm={() => void track(`delete:${row.id}`, () => flows.remove(row.id))}
        >
          Delete
        </ArmedButton>
      ),
    };
  };

  return <RecordTable ariaLabel="Playlists" columns={playlistColumns} rows={rows} idOf={idOf} rowView={rowView} waiting={waiting} />;
}
