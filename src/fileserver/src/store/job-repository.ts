import { z } from "zod";

import { SETTLED_JOB_HISTORY } from "../constants/media-files.js";
import { JobKindSchema, JobStateSchema, SETTLED_JOB_STATES, type Job, type JobKind, type JobState } from "../types/job.js";
import type { Database } from "./database.js";

const JobRow = z.object({
  id: z.string(),
  kind: JobKindSchema,
  label: z.string(),
  state: JobStateSchema,
  percent: z.number().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.number(),
  started_at: z.number().nullable(),
  finished_at: z.number().nullable(),
});

/** Identifiers only, never a path (the 001 header note; the brief's port note). */
export type JobRequest = { folderId: string } | { localFileId: string };

export interface NewJob {
  id: string;
  kind: JobKind;
  label: string;
  request: JobRequest;
  createdAt: number;
}

export type JobSettlement = {
  state: Extract<JobState, "done" | "failed" | "cancelled" | "interrupted">;
  at: number;
  error?: { code: string; message: string };
  percent?: number;
};

export interface JobRepository {
  insert(job: NewJob): void;
  /** The row's stored `request` ids; `null` when the row carries none this fileserver knows. */
  requestOf(id: string): JobRequest | null;
  find(id: string): Job | null;
  /** Every job, newest first (`GET /api/jobs`, 3.9). */
  list(): Job[];
  /** Unsettled jobs plus the `SETTLED_JOB_HISTORY` most recent settled ones (the state answer, 4). */
  listRecent(): Job[];
  setRunning(id: string, at: number): void;
  setPercent(id: string, percent: number): void;
  setCancelling(id: string): void;
  settle(id: string, settlement: JobSettlement): void;
  /** True when a row was removed. */
  remove(id: string): boolean;
  /** Start recovery: every unfinished job becomes `interrupted`; none resumes (3.9). */
  interruptUnfinished(at: number, error: { code: string; message: string }): number;
}

const COLUMNS = "id, kind, label, state, percent, error_code, error_message, created_at, started_at, finished_at";
const UNSETTLED = SETTLED_JOB_STATES.map((state) => `'${state}'`).join(", ");

function toSummary(row: z.infer<typeof JobRow>): Job {
  const job: Job = {
    id: row.id,
    kind: row.kind,
    label: row.label,
    state: row.state,
    createdAt: row.created_at,
    ...(row.percent !== null && { percent: row.percent }),
    ...(row.error_code !== null && { error: { code: row.error_code, message: row.error_message ?? "" } }),
    ...(row.started_at !== null && { startedAt: row.started_at }),
    ...(row.finished_at !== null && { finishedAt: row.finished_at }),
  };
  return job;
}

const RequestSchema = z.union([z.object({ folderId: z.string().min(1) }), z.object({ localFileId: z.string().min(1) })]);

export function createJobRepository(db: Database): JobRepository {
  const insert = db.prepare("INSERT INTO jobs (id, kind, label, state, request, created_at) VALUES (?, ?, ?, 'queued', ?, ?)");
  const selectOne = db.prepare(`SELECT ${COLUMNS}, request FROM jobs WHERE id = ?`);
  const selectAll = db.prepare(`SELECT ${COLUMNS} FROM jobs ORDER BY created_at DESC, rowid DESC`);
  const selectRecent = db.prepare(
    `SELECT * FROM (SELECT ${COLUMNS} FROM jobs WHERE state NOT IN (${UNSETTLED}) ORDER BY created_at DESC, rowid DESC)
     UNION ALL
     SELECT * FROM (SELECT ${COLUMNS} FROM jobs WHERE state IN (${UNSETTLED}) ORDER BY created_at DESC, rowid DESC LIMIT ?)`,
  );
  const setRunning = db.prepare("UPDATE jobs SET state = 'running', started_at = ? WHERE id = ?");
  const setPercent = db.prepare("UPDATE jobs SET percent = ? WHERE id = ?");
  const setCancelling = db.prepare("UPDATE jobs SET state = 'cancelling' WHERE id = ?");
  const settle = db.prepare(
    `UPDATE jobs SET state = ?, finished_at = ?, error_code = ?, error_message = ?,
       percent = COALESCE(?, percent) WHERE id = ?`,
  );
  const remove = db.prepare("DELETE FROM jobs WHERE id = ?");
  const interrupt = db.prepare(
    `UPDATE jobs SET state = 'interrupted', finished_at = ?, error_code = ?, error_message = ?
     WHERE state IN ('queued', 'running', 'cancelling')`,
  );

  return {
    insert(job) {
      insert.run(job.id, job.kind, job.label, JSON.stringify(job.request ?? null), job.createdAt);
    },

    requestOf(id) {
      const row = selectOne.get(id) as { request?: unknown } | undefined;
      if (!row) return null;
      try {
        const parsed = RequestSchema.safeParse(JSON.parse(String(row.request ?? "null")));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },

    find(id) {
      const row = JobRow.safeParse(selectOne.get(id));
      return row.success ? toSummary(row.data) : null;
    },

    list() {
      const jobs: Job[] = [];
      for (const raw of selectAll.all()) {
        const row = JobRow.safeParse(raw);
        if (row.success) jobs.push(toSummary(row.data));
      }
      return jobs;
    },

    listRecent() {
      const jobs: Job[] = [];
      for (const raw of selectRecent.all(SETTLED_JOB_HISTORY)) {
        const row = JobRow.safeParse(raw);
        if (row.success) jobs.push(toSummary(row.data));
      }
      return jobs;
    },

    setRunning(id, at) {
      setRunning.run(at, id);
    },
    setPercent(id, value) {
      setPercent.run(value, id);
    },
    setCancelling(id) {
      setCancelling.run(id);
    },
    settle(id, settlement) {
      settle.run(
        settlement.state,
        settlement.at,
        settlement.error?.code ?? null,
        settlement.error?.message ?? null,
        settlement.percent ?? null,
        id,
      );
    },
    remove(id) {
      return Number(remove.run(id).changes) > 0;
    },
    interruptUnfinished(at, error) {
      return Number(interrupt.run(at, error.code, error.message).changes);
    },
  };
}
