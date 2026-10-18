import { notConnected } from "./not-connected";
import type { AdminPlaylist } from "./schemas/playlist-schema";
import type { RecordService } from "./service-types";

/** The Playlists routes (`29` section 9.4). NOT CONNECTED: refuses until the Playlists worker wires it. */
export type PlaylistsService = RecordService<AdminPlaylist, number>;

export const playlists: PlaylistsService = {
  list: () => notConnected("playlists.list"),
  create: () => notConnected("playlists.create"),
  update: () => notConnected("playlists.update"),
  remove: () => notConnected("playlists.remove"),
};
