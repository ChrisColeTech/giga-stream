import { z } from "zod";

/** The counts one run answers and audits (docs/03 section 7.2c). */
export interface PlaylistSyncCounts {
  created: number;
  updated: number;
  skipped: number;
  refused: number;
  removed: number;
  /** Sync-owned rows whose entry vanished but that an admin edited: `prune` keeps them (docs/26 section 3.10). */
  kept: number;
  /** Entries an admin deleted from the sync, skipped instead of created again. */
  ignored: number;
}

/** A channel an admin deleted from the sync, shown so it can be restored (`GET /api/playlist-sync/ignored`). */
export interface IgnoredEntry {
  id: number;
  host: string;
  tvgId?: string;
  syncName?: string;
  name: string;
  createdAt: number;
}

/** A playlist as a read shows it: never its full address (docs/26 section 3.11). */
export interface PlaylistRef {
  id: number;
  host: string;
  masked: string;
}

/** The `202` body of `POST /api/playlist-sync`. */
export interface PlaylistSyncAnswer extends PlaylistSyncCounts {
  refusalExamples: string[];
  createdIds: string[];
}

/** The answer of `GET /api/playlist-sync`. */
export interface PlaylistSyncStatus {
  running: boolean;
  startedAt?: number;
  lastRunAt?: number;
  lastOutcome?: string;
  counts?: PlaylistSyncCounts;
  schedule: string;
  playlists: PlaylistRef[];
}

/** `POST /api/playlist-sync` body: `{ dryRun?, prune? }`; a dry run writes nothing. */
export const PlaylistSyncBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    prune: z.boolean().optional(),
  })
  .strict();
export type PlaylistSyncBody = z.infer<typeof PlaylistSyncBodySchema>;
