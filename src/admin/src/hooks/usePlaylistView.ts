import { useMemo } from "react";
import { playlistSpec } from "@/lib/list-specs";
import { playlistRow, type PlaylistRowView } from "@/lib/playlist-rows";
import { useAppStore } from "@/store/app-store";
import { useListQuery, type ListQueryView } from "./useListQuery";

const idOf = (row: PlaylistRowView): string => String(row.id);

function retain(keep: (id: string) => boolean): void {
  const state = useAppStore.getState();
  state.playlistsSetTicked(state.playlists.ticked.filter((id) => keep(String(id))));
}

/** The Playlists list as the query shows it: every playlist's row, filtered and sorted (`lib/list-query.ts`). */
export function usePlaylistView(): ListQueryView<PlaylistRowView> {
  const items = useAppStore((state) => state.playlists.items);
  const rows = useMemo(() => items.map(playlistRow), [items]);
  return useListQuery({ list: "playlists", rows, spec: playlistSpec, idOf, retain });
}
