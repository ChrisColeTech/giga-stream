// Migration 028 (docs/49 sections 2.4 and 2.7): the nullable `cursor_at` on `sync_jobs`, and the Library update job - made
// once on a database whose first-start seed already ran and that has no `recent` job, never on a fresh one (the seed makes
// it there) and never again once the admin deleted it. Exactly one update job on both paths.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");
const temp: string[] = [];
after(() => temp.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A database as migrations 001 to 027 left it, with the given statements run after them. */
function database027(extra: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-library-update-"));
  temp.push(dir);
  const file = path.join(dir, "admin.db");
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 27) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    db.exec(extra);
  } finally {
    db.close();
  }
  return file;
}

const FILL = `INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at)
  VALUES ('Library fill', 'catalog', 1, '12h', '{"scope":"discover","pages":500}', 3)`;
const SEEDED = "INSERT INTO sync_seed (id, seeded_at) VALUES (1, 1)";

function jobsOf(file: string) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = db.prepare("SELECT name, enabled, schedule, config, cursor_at, last_run_at FROM sync_jobs ORDER BY id").all();
    return { rows: rows.map((row) => ({ ...row })), version: db.prepare("PRAGMA user_version").get()?.user_version };
  } finally {
    db.close();
  }
}

test("028 on a seeded version-27 database adds the cursor column and one enabled 24h Library update; the fill is untouched", () => {
  const file = database027(`${FILL}; ${SEEDED}`);
  createStore(file).close();
  const { rows, version } = jobsOf(file);
  assert.equal(version, 29);
  assert.deepEqual(rows, [
    { name: "Library fill", enabled: 1, schedule: "12h", config: '{"scope":"discover","pages":500}', cursor_at: null, last_run_at: null },
    { name: "Library update", enabled: 1, schedule: "24h", config: '{"scope":"recent","pages":1}', cursor_at: null, last_run_at: null },
  ]);
});

test("a job the admin deletes stays deleted: the migration ran once, a restart does not make it again", () => {
  const file = database027(`${FILL}; ${SEEDED}`);
  const first = createStore(file);
  const update = first.jobs.list().find((job) => job.type === "catalog" && job.config.scope === "recent");
  assert.ok(update !== undefined);
  first.jobs.remove(update.id);
  first.close();
  createStore(file).close();
  assert.deepEqual(jobsOf(file).rows.map((row) => row.name), ["Library fill"]);
});

test("a database whose seed has not run gets none (the seed makes it); one that already has a recent job gains none", () => {
  const unseeded = database027(FILL);
  createStore(unseeded).close();
  assert.deepEqual(jobsOf(unseeded).rows.map((row) => row.name), ["Library fill"]);
  const mine = database027(`${SEEDED}; INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at)
    VALUES ('My update', 'catalog', 0, '6h', '{"scope":"recent","pages":1}', 4)`);
  createStore(mine).close();
  assert.deepEqual(jobsOf(mine).rows.map((row) => [row.name, row.schedule]), [["My update", "6h"]]);
});

test("a fresh database ends with exactly one Library update, made by the seed", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const names = async (): Promise<unknown[]> =>
    (pick((await send(t.app, "GET", "/api/jobs", undefined, token)).body, "data.items") as Array<Record<string, unknown>>)
      .filter((job) => pick(job, "config.scope") === "recent").map((job) => job.name);
  assert.deepEqual(await names(), ["Library update"]);
  await t.dispose();
});
