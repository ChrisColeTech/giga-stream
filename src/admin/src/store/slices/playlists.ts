import type { SliceGet, SliceSet } from "./slice-host";

/** PLACEHOLDER. The Playlists wave replaces this file (it re-exports `store/playlists-slice.ts`); until then the tab has
 *  no state of its own and the registry spreads nothing for it. */
export type PlaylistsSlice = Record<never, never>;

export function createPlaylistsSlice(_set: SliceSet<PlaylistsSlice>, _get: SliceGet<PlaylistsSlice>): PlaylistsSlice {
  return {};
}
