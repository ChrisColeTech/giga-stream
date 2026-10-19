import { z } from "zod";

import { PLAYLIST_JOB_DEFAULT_SCHEDULE } from "../constants/limits.js";
import type { Database } from "./database.js";
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
  cursor_at: z.number().int().nullable(),
});

export type CatalogJobConfig =
  | { scope: "trending" | "popular"; kind: "all" | "movie" | "tv"; pages: number }
  | { scope: "discover" | "recent" };

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
  /** Where a Library update's next `airing` window starts (`49` section 2.4); absent until a run ended `ok`. */
  cursorAt?: number;
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

const CatalogConfig = z.discriminatedUnion("scope", [
  z.object({
    scope: z.enum(["trending", "popular"]),
    kind: z.enum(["all", "movie", "tv"]),
    pages: z.number().int(),
  }).strict(),
  z.object({ scope: z.enum(["discover", "recent"]) }).strict(),
]);

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
    ...(r.cursor_at !== null && { cursorAt: r.cursor_at }),
  };
  if (r.type === "playlist") {
    if (r.playlist_id === null) throw new Error(`job ${r.id} is a playlist job without a playlist`);
    return { ...base, type: "playlist", playlistId: r.playlist_id };
  }
  return { ...base, type: "catalog", name: r.name ?? "", config: CatalogConfig.parse(JSON.parse(r.config)) };
}

const COLUMNS = "id, name, type, enabled, schedule, config, playlist_id, last_run_at, last_result, last_counts, created_at, cursor_at";

const SQL = {
  all: `SELECT ${COLUMNS} FROM sync_jobs ORDER BY id`,
  one: `SELECT ${COLUMNS} FROM sync_jobs WHERE id = ?`,
  ofPlaylist: `SELECT ${COLUMNS} FROM sync_jobs WHERE playlist_id = ?`,
  insertCatalog: "INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES (?, 'catalog', ?, ?, ?, ?)",
  insertPlaylist: "INSERT INTO sync_jobs (type, enabled, schedule, config, playlist_id, created_at) VALUES ('playlist', 1, ?, '{}', ?, ?)",
  update: "UPDATE sync_jobs SET name = ?, enabled = ?, schedule = ?, config = ? WHERE id = ?",
  record: "UPDATE sync_jobs SET last_run_at = ?, last_result = ?, last_counts = ? WHERE id = ?",
  recordWithCursor: "UPDATE sync_jobs SET last_run_at = ?, last_result = ?, last_counts = ?, cursor_at = ? WHERE id = ?",
  remove: "DELETE FROM sync_jobs WHERE id = ?",
  countOfPlaylist: "SELECT COUNT(*) AS n FROM sync_jobs WHERE playlist_id = ?",
  count: "SELECT COUNT(*) AS n FROM sync_jobs",
  seeded: "SELECT seeded_at FROM sync_seed WHERE id = 1",
  markSeeded: "INSERT OR IGNORE INTO sync_seed (id, seeded_at) VALUES (?, ?)",
};

/** The sync jobs (docs/43 section 3.1), in the order they were made. */
export function createJobRepository(db: Database) {
  const countOf = async (sql: string, ...args: number[]): Promise<number> =>
    z.object({ n: z.number() }).parse((await db.execute({ sql, args })).rows[0]).n;

  return {
    list: async (): Promise<JobRecord[]> => (await db.execute(SQL.all)).rows.map(toJob),
    find: async (id: number): Promise<JobRecord | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [id] })).rows[0];
      return row === undefined ? undefined : toJob(row);
    },
    /** The one job of a playlist (the table's partial `UNIQUE` guarantees at most one). */
    findOfPlaylist: async (playlistId: number): Promise<PlaylistJob | undefined> => {
      const row = (await db.execute({ sql: SQL.ofPlaylist, args: [playlistId] })).rows[0];
      const job = row === undefined ? undefined : toJob(row);
      return job?.type === "playlist" ? job : undefined;
    },
    count: (): Promise<number> => countOf(SQL.count),
    countOfPlaylist: (playlistId: number): Promise<number> => countOf(SQL.countOfPlaylist, playlistId),
    async insertCatalog(
      job: { name: string; enabled: boolean; schedule: string; config: CatalogJobConfig },
      at: number,
    ): Promise<number> {
      const result = await db.execute({
        sql: SQL.insertCatalog,
        args: [job.name, job.enabled ? 1 : 0, job.schedule, JSON.stringify(job.config), at],
      });
      return Number(result.lastInsertRowid);
    },
    /** A playlist's job, made with the playlist: enabled, `24h`, never run (due once the start grace has passed). */
    insertPlaylist: async (playlistId: number, at: number): Promise<number> => {
      const result = await db.execute({
        sql: SQL.insertPlaylist,
        args: [PLAYLIST_JOB_DEFAULT_SCHEDULE, playlistId, at],
      });
      return Number(result.lastInsertRowid);
    },
    update: async (job: JobRecord): Promise<void> => {
      const [name, config] = job.type === "catalog" ? [job.name, JSON.stringify(job.config)] : [null, "{}"];
      await db.execute({ sql: SQL.update, args: [name, job.enabled ? 1 : 0, job.schedule, config, job.id] });
    },
    /**
     * Keeps a run: when it ended, how it went, and its typed counts (validated here, so no sentence is ever stored).
     * `cursorAt` is written only when given (a Library update that ended `ok`, `49` section 2.4); otherwise it stays.
     */
    recordRun(id: number, at: number, result: RunResult, counts: RunCounts, cursorAt?: number): Promise<void> {
      const text = JSON.stringify(RunCountsSchema.parse(counts));
      return cursorAt === undefined
        ? db.execute({ sql: SQL.record, args: [at, result, text, id] }).then(() => undefined)
        : db.execute({ sql: SQL.recordWithCursor, args: [at, result, text, cursorAt, id] }).then(() => undefined);
    },
    remove: async (id: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [id] })).rowsAffected > 0,
    /** Whether the environment has already seeded the catalog job. */
    isSeeded: async (): Promise<boolean> => (await db.execute(SQL.seeded)).rows[0] !== undefined,
    markSeeded: async (at: number): Promise<void> => {
      await db.execute({ sql: SQL.markSeeded, args: [1, at] });
    },
  };
}

export type JobRepository = ReturnType<typeof createJobRepository>;
