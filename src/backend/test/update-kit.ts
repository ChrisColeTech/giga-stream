// An app on the Library update's fake TMDB (docs/49): job 2 is the seeded Library update, its schedule off so nothing starts
// by itself. `run` starts it by hand and waits for it to end; `advance` moves the clock and signs in again; `read` is a
// read-only look at the database (the cursor, the audit trail), which no route shows.
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { until } from "./playlist-kit.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";
import { updateTmdb, type Dated, type UpdateTmdb } from "./update-tmdb.js";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** The test clock starts 2026-10-16 12:00 UTC (`test-app.ts`). */
export const TODAY = "2026-10-16";
export const daysAgo = (days: number): string => new Date(Date.UTC(2026, 9, 16) - days * DAY_MS).toISOString().slice(0, 10);

export async function updateApp(data: { movie?: Dated[]; tv?: Dated[] }, config: Record<string, unknown> = {}) {
  const tmdb: UpdateTmdb = await updateTmdb({ movie: data.movie ?? [], tv: data.tv ?? [] });
  const t: TestApp = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base, ...config } });
  let token = (await signIn(t.app)).access;
  const api = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => send(t.app, method, url, body, token);
  await api("PATCH", "/api/jobs/2", { schedule: "off" });
  const job = async (): Promise<Record<string, unknown>> => pick((await api("GET", "/api/jobs/2")).body, "data") as Record<string, unknown>;
  const finished = (): Promise<void> => until(async () => (await job()).running === false, "the run to end");
  async function run(): Promise<Record<string, unknown>> {
    const started = await api("POST", "/api/jobs/2/run");
    if (started.status !== 202) throw new Error(`run refused: ${started.status} ${JSON.stringify(started.body)}`);
    await finished();
    return job();
  }
  function read<T>(sql: string): T[] {
    const db = new DatabaseSync(path.join(t.dataDir, DATABASE_FILE_NAME), { readOnly: true });
    try {
      return db.prepare(sql).all().map((row) => ({ ...row }) as T);
    } finally {
      db.close();
    }
  }
  return {
    t, tmdb, api, job, finished, run, read,
    advance: async (ms: number): Promise<void> => {
      t.clock.advance(ms);
      token = (await signIn(t.app)).access;
    },
    cursor: (): number | null => read<{ cursor_at: number | null }>("SELECT cursor_at FROM sync_jobs WHERE id = 2")[0]?.cursor_at ?? null,
    /** The audit details of every sync entry, oldest first. */
    audits: (): Array<Record<string, unknown>> =>
      read<{ detail: string }>("SELECT detail FROM audit_log WHERE action LIKE 'sync.%' ORDER BY id")
        .map((row) => JSON.parse(row.detail) as Record<string, unknown>),
    plotOf: async (id: string): Promise<unknown> => pick((await api("GET", `/api/titles/${id}`)).body, "data.plot"),
    shapeOf: async (id: string): Promise<unknown> => pick((await api("GET", `/api/titles/${id}`)).body, "data.shape"),
  };
}

export type UpdateApp = Awaited<ReturnType<typeof updateApp>>;
