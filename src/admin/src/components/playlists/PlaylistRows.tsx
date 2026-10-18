import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { PLAYLIST_GRID, PLAYLIST_HEADINGS } from "@/constants/playlist-grid";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { playlistRow } from "@/lib/playlist-rows";
import { useAppStore } from "@/store/app-store";
import { PlaylistRow } from "./PlaylistRow";

/** The playlists grid: the header with its select-all tick, and a row for each playlist. Shimmer rows in the header's
 *  own columns draw while nothing has been read and when there is nothing to list (never a sentence); a refresh and a
 *  failed read keep the rows they have. */
export function PlaylistRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.playlists);
  const tick = useAppStore((state) => state.playlistTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = usePlaylistActions();
  const waiting = items.length === 0 || status === "idle";
  const reasonFor = (id: number): string | undefined =>
    unreachable ? UNREACHABLE_REASON : saving || isBusy(`delete:${id}`) ? SAVING_REASON : undefined;

  return (
    <RecordGrid
      ariaLabel="Playlists"
      layout={PLAYLIST_GRID}
      headings={PLAYLIST_HEADINGS}
      ticks
    >
      {waiting ? (
        <SkeletonGrid />
      ) : (
        items.map((playlist) => (
          <PlaylistRow
            key={playlist.id}
            row={playlistRow(playlist)}
            ticked={ticked.includes(playlist.id)}
            deleteReason={reasonFor(playlist.id)}
            onTick={tick}
            onOpen={(id) => openWorkspace("playlists", String(id))}
            onDelete={(id) => void track(`delete:${id}`, () => flows.remove(id))}
          />
        ))
      )}
    </RecordGrid>
  );
}
