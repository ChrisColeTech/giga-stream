// Migration 028 (docs/49 sections 2.4 and 2.7): the nullable `cursor_at` on `sync_jobs`, and the Library update job - made
// once on a database whose first-start seed already ran and that has no `recent` job, never on a fresh one (the seed makes
// it there) and never again once the admin deleted it. Exactly one update job on both paths.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");
const temp: string[] = [];
after(() => temp.forEach((dir) => removeDir(dir)));

/** A database as migrations 001 to 027 left it, with the given statements run after them. */
async function database027(extra: string): Promise<string> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-library-update-"));
  temp.push(dir);
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 27) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    await runSql(db, extra);
  } finally {
    db.close();
  }
  return file;
}

const FILL = `INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at)
  VALUES ('Library fill', 'catalog', 1, '12h', '{"scope":"discover","pages":500}', 3)`;
const SEEDED = "INSERT INTO sync_seed (id, seeded_at) VALUES (1, 1)";

async function jobsOf(file: string) {
  const db = await openTestDatabase(file);
  try {
    const rows = await queryRows(db, "SELECT name, enabled, schedule, config, cursor_at, last_run_at FROM sync_jobs ORDER BY id");
    return { rows, version: (await queryRow(db, "PRAGMA user_version"))?.user_version };
  } finally {
    db.close();
  }
}

test("028 on a seeded version-27 database adds the cursor column and one enabled 24h Library update; the fill is untouched", async () => {
  const file = await database027(`${FILL}; ${SEEDED}`);
  (await createStore(file)).close();
  const { rows, version } = await jobsOf(file);
  assert.equal(version, 30);
  assert.deepEqual(rows, [
    { name: "Library fill", enabled: 1, schedule: "12h", config: '{"scope":"discover"}', cursor_at: null, last_run_at: null },
    { name: "Library update", enabled: 1, schedule: "24h", config: '{"scope":"recent"}', cursor_at: null, last_run_at: null },
  ]);
});

test("a job the admin deletes stays deleted: the migration ran once, a restart does not make it again", async () => {
  const file = await database027(`${FILL}; ${SEEDED}`);
  const first = await createStore(file);
  const update = (await first.jobs.list()).find((job) => job.type === "catalog" && job.config.scope === "recent");
  assert.ok(update !== undefined);
  await first.jobs.remove(update.id);
  first.close();
  (await createStore(file)).close();
  assert.deepEqual((await jobsOf(file)).rows.map((row) => row.name), ["Library fill"]);
});

test("a database whose seed has not run gets none (the seed makes it); one that already has a recent job gains none", async () => {
  const unseeded = await database027(FILL);
  (await createStore(unseeded)).close();
  assert.deepEqual((await jobsOf(unseeded)).rows.map((row) => row.name), ["Library fill"]);
  const mine = await database027(`${SEEDED}; INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at)
    VALUES ('My update', 'catalog', 0, '6h', '{"scope":"recent","pages":1}', 4)`);
  (await createStore(mine)).close();
  assert.deepEqual((await jobsOf(mine)).rows.map((row) => [row.name, row.schedule]), [["My update", "6h"]]);
});

test("a fresh database ends with exactly one Library update, made by the seed", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const names = async (): Promise<unknown[]> =>
    (pick((await send(t.app, "GET", "/api/admin/jobs", undefined, token)).body, "data.items") as Array<Record<string, unknown>>)
      .filter((job) => pick(job, "config.scope") === "recent").map((job) => job.name);
  assert.deepEqual(await names(), ["Library update"]);
  await t.dispose();
});