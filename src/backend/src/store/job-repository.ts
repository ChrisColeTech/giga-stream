import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { PLAYLIST_JOB_DEFAULT_SCHEDULE } from "../constants/limits.js";
import { RUN_RESULTS, RunCountsSchema, type RunCounts, type RunResult } from "../types/job-counts.js";

const Row = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  type: z.enum(["playlist", "catalog"]),
  enabled: z.number().int(),
  schedule: z.string(),
  config: z.string(),
  playlist_id: z.number().int().nullable(),
  last_run_at: z.number().int().nullable(),
  last_result: z.enum(RUN_RESULTS).nullable(),
  last_counts: z.string().nullable(),
  created_at: z.number().int(),
});

export interface CatalogJobConfig {
  scope: "trending" | "popular" | "discover";
  /** Not set on a discover job: the walk covers both kinds (`03` section 7.6b). */
  kind?: "movie" | "tv";
  pages: number;
}

/** A sync job record (docs/43 section 3.1): when it runs, and how its last run went (typed, never a sentence). */
interface JobBase {
  id: number;
  enabled: boolean;
  /** `"6h"`, `"30m"`, `"24h"` and so on, or `"off"`. */
  schedule: string;
  lastRunAt?: number;
  lastResult?: RunResult;
  lastCounts?: RunCounts;
  createdAt: number;
}
/** A playlist's one job: part of the playlist, with no name of its own (the view says `Sync <playlist name>`). */
export interface PlaylistJob extends JobBase {
  type: "playlist";
  playlistId: number;
}
export interface CatalogJob extends JobBase {
  type: "catalog";
  name: string;
  config: CatalogJobConfig;
}
export type JobRecord = PlaylistJob | CatalogJob;

const CatalogConfig = z.object({
  scope: z.enum(["trending", "popular", "discover"]),
  kind: z.enum(["movie", "tv"]).optional(),
  pages: z.number().int(),
});

/** A stored result of an older shape is absent, never an error (docs/43 section 6). */
function countsOf(text: string | null): RunCounts | undefined {
  if (text === null) return undefined;
  try {
    const parsed = RunCountsSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function toJob(row: unknown): JobRecord {
  const r = Row.parse(row);
  const counts = countsOf(r.last_counts);
  const base = {
    id: r.id,
    enabled: r.enabled === 1,
    schedule: r.schedule,
    ...(r.last_run_at !== null && { lastRunAt: r.last_run_at }),
    ...(r.last_result !== null && { lastResult: r.last_result }),
    ...(counts !== undefined && { lastCounts: counts }),
    createdAt: r.created_at,
  };
  if (r.type === "playlist") {
    if (r.playlist_id === null) throw new Error(`job ${r.id} is a playlist job without a playlist`);
    return { ...base, type: "playlist", playlistId: r.playlist_id };
  }
  return { ...base, type: "catalog", name: r.name ?? "", config: CatalogConfig.parse(JSON.parse(r.config)) };
}

const COLUMNS = "id, name, type, enabled, schedule, config, playlist_id, last_run_at, last_result, last_counts, created_at";

/** The sync jobs (docs/43 section 3.1), in the order they were made. */
export function createJobRepository(db: DatabaseSync) {
  const all = db.prepare(`SELECT ${COLUMNS} FROM sync_jobs ORDER BY id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM sync_jobs WHERE id = ?`);
  const ofPlaylist = db.prepare(`SELECT ${COLUMNS} FROM sync_jobs WHERE playlist_id = ?`);
  const insertCatalog = db.prepare(
    "INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES (?, 'catalog', ?, ?, ?, ?)",
  );
  const insertPlaylist = db.prepare(
    "INSERT INTO sync_jobs (type, enabled, schedule, config, playlist_id, created_at) VALUES ('playlist', 1, ?, '{}', ?, ?)",
  );
  const update = db.prepare("UPDATE sync_jobs SET name = ?, enabled = ?, schedule = ?, config = ? WHERE id = ?");
  const record = db.prepare("UPDATE sync_jobs SET last_run_at = ?, last_result = ?, last_counts = ? WHERE id = ?");
  const remove = db.prepare("DELETE FROM sync_jobs WHERE id = ?");
  const countOfPlaylist = db.prepare("SELECT COUNT(*) AS n FROM sync_jobs WHERE playlist_id = ?");
  const count = db.prepare("SELECT COUNT(*) AS n FROM sync_jobs");
  const seeded = db.prepare("SELECT seeded_at FROM sync_seed WHERE id = 1");
  const markSeeded = db.prepare("INSERT OR IGNORE INTO sync_seed (id, seeded_at) VALUES (?, ?)");
  const total = (statement: ReturnType<DatabaseSync["prepare"]>, ...args: number[]): number =>
    z.object({ n: z.number() }).parse(statement.get(...args)).n;

  return {
    list: (): JobRecord[] => all.all().map(toJob),
    find(id: number): JobRecord | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toJob(row);
    },
    /** The one job of a playlist (the table's partial `UNIQUE` guarantees at most one). */
    findOfPlaylist(playlistId: number): PlaylistJob | undefined {
      const row = ofPlaylist.get(playlistId);
      const job = row === undefined ? undefined : toJob(row);
      return job?.type === "playlist" ? job : undefined;
    },
    count: (): number => total(count),
    countOfPlaylist: (playlistId: number): number => total(countOfPlaylist, playlistId),
    insertCatalog(job: { name: string; enabled: boolean; schedule: string; config: CatalogJobConfig }, at: number): number {
      return Number(insertCatalog.run(job.name, job.enabled ? 1 : 0, job.schedule, JSON.stringify(job.config), at).lastInsertRowid);
    },
    /** A playlist's job, made with the playlist: enabled, `24h`, never run (due once the start grace has passed). */
    insertPlaylist: (playlistId: number, at: number): number =>
      Number(insertPlaylist.run(PLAYLIST_JOB_DEFAULT_SCHEDULE, playlistId, at).lastInsertRowid),
    update(job: JobRecord): void {
      const [name, config] = job.type === "catalog" ? [job.name, JSON.stringify(job.config)] : [null, "{}"];
      update.run(name, job.enabled ? 1 : 0, job.schedule, config, job.id);
    },
    /** Keeps a run: when it ended, how it went, and its typed counts (validated here, so no sentence is ever stored). */
    recordRun(id: number, at: number, result: RunResult, counts: RunCounts): void {
      record.run(at, result, JSON.stringify(RunCountsSchema.parse(counts)), id);
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
    /** Whether the environment has already seeded the catalog job. */
    isSeeded: (): boolean => seeded.get() !== undefined,
    markSeeded(at: number): void {
      markSeeded.run(1, at);
    },
  };
}

export type JobRepository = ReturnType<typeof createJobRepository>;
