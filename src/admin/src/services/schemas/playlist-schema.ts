import { z } from "zod";
import { lastCounts, lastResult } from "./run-counts-schema";

/* `PlaylistView` (`03` section 7.2c): a file playlist has a `fileName` and no host; a web playlist its address in
 * full (`url`) and its `host`. The last run is joined in from its job. */
export const PlaylistSchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(["file", "url"]),
  url: z.string().optional(),
  host: z.string().optional(),
  fileName: z.string().optional(),
  enabled: z.boolean(),
  channels: z.number(),
  enabledChannels: z.number(),
  online: z.number(),
  offline: z.number(),
  lastRunAt: z.number().optional(),
  lastResult,
  lastCounts,
});

export const PlaylistListSchema = z.object({ items: z.array(PlaylistSchema) });

/** The list as the service reads it: rows stay `unknown` so one unreadable row costs that row, not the list
 *  (`01` section 8). `services/playlists.ts` parses each with `PlaylistSchema`. */
export const PlaylistListLenientSchema = z.object({ items: z.array(z.unknown()) });

const count = z.number().int().min(0);

/** What an import did to the playlist's channels (`03` section 7.2c). */
export const ImportedSchema = z.object({
  created: count,
  updated: count,
  skipped: count,
  refused: count,
  refusalExamples: z.array(z.string()),
});

/** `POST /api/playlists/import` and `POST /api/playlists`: the playlist, whether it is new, and what the import did. */
export const PlaylistImportSchema = PlaylistSchema.extend({ created: z.boolean(), imported: ImportedSchema });

/** `DELETE /api/playlists/:id`: the channels and jobs that went with it. */
export const PlaylistDeletedSchema = z.object({ id: z.number(), deletedChannels: count, deletedJobs: count });

export type AdminPlaylist = z.infer<typeof PlaylistSchema>;
export type ImportedCounts = z.infer<typeof ImportedSchema>;

/** An import's answer as the flows read it: the playlist alone (what the store holds), whether it is new, the counts. */
export interface PlaylistImport {
  readonly playlist: AdminPlaylist;
  readonly created: boolean;
  readonly imported: ImportedCounts;
}

/** The readable playlists and how many rows could not be read. */
export interface PlaylistList {
  readonly items: AdminPlaylist[];
  readonly unreadable: number;
}

export type PlaylistDeleted = z.infer<typeof PlaylistDeletedSchema>;
