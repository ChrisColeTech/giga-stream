import { pruneIds, upsertById, withTick, withoutId } from "@/lib/playlist-rows";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The Playlists tab's data, a slice of the one store (`38` section 6). Facts only: no promise, no timer; the flows
 * (`services/playlist-flows.ts`) read the backend and hand the answers here. `jobFor` is the job that syncs each
 * playlist, read from the jobs list once per load (the service, never the Jobs slice), so `Sync now` knows its reasons before the
 * press. `session` is the sign-in serial the data belongs to: the load hook resets the slice when a new session starts,
 * so nothing of one account is shown to the next. The address never reaches this slice. */

export type PlaylistsStatus = "idle" | "loading" | "ready" | "failed";

/** The job a `Sync now` runs for a playlist. */
export interface PlaylistJobLink {
  readonly id: number;
  readonly enabled: boolean;
  readonly running: boolean;
}

export interface PlaylistsState {
  readonly status: PlaylistsStatus;
  readonly items: readonly AdminPlaylist[];
  readonly unreachable: boolean;
  readonly ticked: readonly number[];
  readonly jobFor: Readonly<Record<number, PlaylistJobLink>>;
  readonly session: number;
}

export const NO_PLAYLISTS: PlaylistsState = {
  status: "idle",
  items: [],
  unreachable: false,
  ticked: [],
  jobFor: {},
  session: 0,
};

export interface PlaylistsSlice {
  playlists: PlaylistsState;
  /** A new session: back to the start, owned by `session`. */
  playlistsReset: (session: number) => void;
  playlistsStartLoad: () => void;
  /** A read answered: the items and the jobs map replace the old, `unreachable` clears, gone rows lose their ticks. */
  playlistsLoaded: (items: readonly AdminPlaylist[], jobFor: Readonly<Record<number, PlaylistJobLink>>) => void;
  /** A read failed: the last items stay. */
  playlistsLoadFailed: (unreachable: boolean) => void;
  playlistUpsert: (playlist: AdminPlaylist) => void;
  playlistRemove: (id: number) => void;
  playlistTick: (id: number, on: boolean) => void;
  playlistsTickAll: (on: boolean) => void;
  /** Leaves exactly these ids ticked (a bulk run unticks the rows it finished). */
  playlistsSetTicked: (ids: readonly number[]) => void;
  playlistsMarkUnreachable: (unreachable: boolean) => void;
}

export function createPlaylistsSlice(set: SliceSet<PlaylistsSlice>, get: SliceGet<PlaylistsSlice>): PlaylistsSlice {
  const patch = (next: Partial<PlaylistsState>): void => set({ playlists: { ...get().playlists, ...next } });
  const withItems = (items: readonly AdminPlaylist[]): Partial<PlaylistsState> => ({
    items,
    ticked: pruneIds(get().playlists.ticked, items),
  });
  return {
    playlists: NO_PLAYLISTS,
    playlistsReset: (session) => set({ playlists: { ...NO_PLAYLISTS, session } }),
    playlistsStartLoad: () => patch({ status: "loading" }),
    playlistsLoaded: (items, jobFor) => patch({ status: "ready", unreachable: false, jobFor, ...withItems(items) }),
    playlistsLoadFailed: (unreachable) => patch({ status: "failed", unreachable }),
    playlistUpsert: (playlist) => patch(withItems(upsertById(get().playlists.items, playlist))),
    playlistRemove: (id) => patch(withItems(withoutId(get().playlists.items, id))),
    playlistTick: (id, on) => patch({ ticked: withTick(get().playlists.ticked, id, on) }),
    playlistsTickAll: (on) => patch({ ticked: on ? get().playlists.items.map((item) => item.id) : [] }),
    playlistsSetTicked: (ids) => patch({ ticked: pruneIds(ids, get().playlists.items) }),
    playlistsMarkUnreachable: (unreachable) => patch({ unreachable }),
  };
}
