import { ALL_PLAYLISTS, PLAYLIST_OPTIONS_MAX, type QueryOption } from "@/constants/channel-query-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

/** The Channels list's Playlist select (`43` section 4.1): `All playlists`, then the playlist names (at most twenty).
 *  The playlist the query holds is always listed, so the select never shows a filter that is not the one applied. Pure. */
export function playlistChoices(items: readonly AdminPlaylist[], selected: string): readonly QueryOption<string>[] {
  const listed = items.slice(0, PLAYLIST_OPTIONS_MAX).map((one) => ({ value: String(one.id), label: one.name }));
  const held = selected !== "" && !listed.some((one) => one.value === selected);
  const chosen = items.find((one) => String(one.id) === selected);
  const extra = held ? [{ value: selected, label: chosen?.name ?? `Playlist ${selected}` }] : [];
  return [{ value: "", label: ALL_PLAYLISTS }, ...listed, ...extra];
}
