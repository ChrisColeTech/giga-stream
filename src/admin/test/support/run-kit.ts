import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import type { PlaylistCounts } from "@/services/schemas/run-counts-schema";

/* Playlist and job rows in the backend's own wire shape (`43` sections 3.1 and 3.4), for the Playlists and Jobs tests.
 * Test data only: the app never holds a row it did not read from the backend. */

/** A playlist run's typed counts: all zero, a file playlist, unless overridden. */
export const counts = (extra: Partial<PlaylistCounts> = {}): PlaylistCounts => ({
  created: 0, updated: 0, skipped: 0, refused: 0, source: "file", logosCached: 0, logosFailed: 0, online: 0, offline: 0,
  unchecked: 0, refusalExamples: [], ...extra,
});

/** A web playlist by default. */
export const playlist = (id: number, extra: Partial<AdminPlaylist> = {}): AdminPlaylist => ({
  id,
  name: `List ${id}`,
  kind: "url",
  url: "https://iptv.example.test/list.m3u",
  host: "iptv.example.test",
  enabled: true,
  channels: 3,
  enabledChannels: 0,
  online: 0,
  offline: 0,
  ...extra,
});

/** A file playlist. */
export const filePlaylist = (id: number, extra: Partial<AdminPlaylist> = {}): AdminPlaylist => ({
  id,
  name: `us.m3u`,
  kind: "file",
  fileName: "us.m3u",
  enabled: true,
  channels: 3,
  enabledChannels: 0,
  online: 0,
  offline: 0,
  ...extra,
});

/** A playlist's job, as the backend answers it: named `Sync <playlist>`, config `{ playlistId }`. */
export const playlistJob = (id: number, playlistId: number, extra: Partial<AdminJob> = {}): AdminJob => ({
  id,
  name: `Sync List ${playlistId}`,
  type: "playlist",
  enabled: true,
  schedule: "24h",
  config: { playlistId },
  playlistId,
  playlistName: `List ${playlistId}`,
  running: false,
  createdAt: 1,
  ...extra,
});

export const catalogJob = (id: number, extra: Partial<AdminJob> = {}): AdminJob => ({
  id,
  name: "Library",
  type: "catalog",
  enabled: true,
  schedule: "6h",
  config: { scope: "trending", kind: "movie", pages: 5 },
  running: false,
  createdAt: 1,
  ...extra,
});
