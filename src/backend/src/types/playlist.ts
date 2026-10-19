import { z } from "zod";

import { ADDRESS_MAX, PLAYLIST_NAME_MAX } from "../constants/limits.js";
import type { RunCounts, RunResult } from "./job-counts.js";

export const PlaylistNameSchema = z.string().trim().min(1).max(PLAYLIST_NAME_MAX);
const url = z.string().trim().min(1).max(ADDRESS_MAX);

/** `POST /api/admin/playlists`, the web-address import: a typed name is kept as typed (`409 playlist.taken` when held). */
export const PlaylistInputSchema = z
  .object({ url, name: PlaylistNameSchema.optional(), enabled: z.boolean().optional() })
  .strict();
export type PlaylistInput = z.infer<typeof PlaylistInputSchema>;

/** `PATCH /api/admin/playlists/:id`: rename, enable, or - for a web playlist only - rotate its address. */
export const PlaylistPatchSchema = z
  .object({ name: PlaylistNameSchema.optional(), url: url.optional(), enabled: z.boolean().optional() })
  .strict();
export type PlaylistPatch = z.infer<typeof PlaylistPatchSchema>;

/**
 * A playlist as a read answers it (docs/03 section 7.2c): a web playlist's address in full, and its host; the last
 * run is joined in from its one sync job.
 */
export interface PlaylistView {
  id: number;
  name: string;
  kind: "file" | "url";
  url?: string;
  host?: string;
  fileName?: string;
  enabled: boolean;
  channels: number;
  enabledChannels: number;
  online: number;
  offline: number;
  lastRunAt?: number;
  lastResult?: RunResult;
  lastCounts?: RunCounts;
}

/** What an import did to the playlist's channels. */
export interface ImportCounts {
  created: number;
  updated: number;
  skipped: number;
  refused: number;
  refusalExamples: string[];
}

/** The answer of an import: the playlist, whether it is new, and what the import did. */
export interface ImportAnswer extends PlaylistView {
  created: boolean;
  imported: ImportCounts;
}

export interface PlaylistDeleted {
  id: number;
  deletedChannels: number;
  deletedJobs: number;
}
