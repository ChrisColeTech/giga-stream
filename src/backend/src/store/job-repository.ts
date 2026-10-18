import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const Row = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(["playlist", "catalog"]),
  enabled: z.number().int(),
  schedule: z.string(),
  config: z.string(),
  last_run_at: z.number().int().nullable(),
  last_outcome: z.string().nullable(),
  last_counts: z.string().nullable(),
  created_at: z.number().int(),
});

export interface PlaylistJobConfig {
  playlistId: number;
  dryRun: boolean;
  prune: boolean;
}

export interface CatalogJobConfig {
  scope: "trending" | "popular" | "discover";
  /** Not set on a discover job: the walk covers both kinds (`03` section 7.6b). */
  kind?: "movie" | "tv";
  pages: number;
}

/** A sync job record (docs/26 section 3.11): what it syncs, when, and how its last run went. */
interface JobBase {
  id: number;
  name: string;
  enabled: boolean;
  /** `"6h"`, `"30m"`, `"24h"` and so on, or `"off"`. */
  schedule: string;
  lastRunAt?: number;
  lastOutcome?: string;
  lastCounts?: Record<string, unknown>;
  createdAt: number;
}
export interface PlaylistJob extends JobBase {
  type: "playlist";
  config: PlaylistJobConfig;
}
export interface CatalogJob extends JobBase {
  type: "catalog";
  config: CatalogJobConfig;
}
export type JobRecord = PlaylistJob | CatalogJob;

const PlaylistConfig = z.object({ playlistId: z.number().int(), dryRun: z.boolean(), prune: z.boolean() });
const CatalogConfig = z.object({
  scope: z.enum(["trending", "popular", "discover"]),
  kind: z.enum(["movie", "tv"]).optional(),
  pages: z.number().int(),
});
const Counts = z.record(z.unknown());

function toJob(row: unknown): JobRecord {
  const r = Row.parse(row);
  const base = {
    id: r.id,
    name: r.name,
    enabled: r.enabled === 1,
    schedule: r.schedule,
    ...(r.last_run_at !== null && { lastRunAt: r.last_run_at }),
    ...(r.last_outcome !== null && { lastOutcome: r.last_outcome }),
    ...(r.last_counts !== null && { lastCounts: Counts.parse(JSON.parse(r.last_counts)) }),
    createdAt: r.created_at,
  };
  const config: unknown = JSON.parse(r.config);
  if (r.type === "playlist") return { ...base, type: "playlist", config: PlaylistConfig.parse(config) };
  return { ...base, type: "catalog", config: CatalogConfig.parse(config) };
}

const COLUMNS = "id, name, type, enabled, schedule, config, last_run_at, last_outcome, last_counts, created_at";

/** The sync jobs (docs/26 section 3.11), in the order they were made. */
export function createJobRepository(db: DatabaseSync) {
  const all = db.prepare(`SELECT ${COLUMNS} FROM sync_jobs ORDER BY id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM sync_jobs WHERE id = ?`);
  const insert = db.prepare("INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const update = db.prepare("UPDATE sync_jobs SET name = ?, enabled = ?, schedule = ?, config = ? WHERE id = ?");
  const record = db.prepare("UPDATE sync_jobs SET last_run_at = ?, last_outcome = ?, last_counts = ? WHERE id = ?");
  const remove = db.prepare("DELETE FROM sync_jobs WHERE id = ?");
  const removeOfPlaylist = db.prepare(
    "DELETE FROM sync_jobs WHERE type = 'playlist' AND json_extract(config, '$.playlistId') = ?",
  );
  const count = db.prepare("SELECT COUNT(*) AS n FROM sync_jobs");
  const seeded = db.prepare("SELECT seeded_at FROM sync_seed WHERE id = 1");
  const markSeeded = db.prepare("INSERT OR IGNORE INTO sync_seed (id, seeded_at) VALUES (1, ?)");

  return {
    list: (): JobRecord[] => all.all().map(toJob),
    find(id: number): JobRecord | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toJob(row);
    },
    count: (): number => z.object({ n: z.number() }).parse(count.get()).n,
    insert(job: { name: string; type: "playlist" | "catalog"; enabled: boolean; schedule: string; config: unknown }, at: number): number {
      return Number(insert.run(job.name, job.type, job.enabled ? 1 : 0, job.schedule, JSON.stringify(job.config), at).lastInsertRowid);
    },
    update(job: JobRecord): void {
      update.run(job.name, job.enabled ? 1 : 0, job.schedule, JSON.stringify(job.config), job.id);
    },
    recordRun(id: number, at: number, outcome: string, counts: Record<string, unknown> | null): void {
      record.run(at, outcome, counts === null ? null : JSON.stringify(counts), id);
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
    /** A playlist went: the jobs that synced it go with it. */
    removeOfPlaylist(playlistId: number): void {
      removeOfPlaylist.run(playlistId);
    },
    /** Whether the environment has already seeded the first playlists and jobs. */
    isSeeded: (): boolean => seeded.get() !== undefined,
    markSeeded(at: number): void {
      markSeeded.run(at);
    },
  };
}

export type JobRepository = ReturnType<typeof createJobRepository>;
