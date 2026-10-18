// Migration 025 (docs/44 section 3.4): the four retired seeded per-slice catalog jobs go, by name and scope; the Library fill
// is made only on a database whose first-start seed already ran and that has no discover job; a fresh database gets its
// one Library fill from the seed, not from the migration.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");
const SLICES: Array<[string, string, string]> = [
  ["Trending movies", "trending", "movie"], ["Trending series", "trending", "tv"],
  ["Popular movies", "popular", "movie"], ["Popular series", "popular", "tv"],
];

/** A database as migrations 001 to 024 left it: a playlist and its job, the four per-slice jobs, and optionally more. */
function database024(dir: string, options: { seeded: boolean; extra?: string }): string {
  const file = path.join(dir, "admin.db");
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 24) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    db.exec(`INSERT INTO playlists (id, name, kind, file_name, enabled, created_at) VALUES (1, 'one', 'file', 'one.m3u', 1, 1);
      INSERT INTO sync_jobs (type, enabled, schedule, config, playlist_id, created_at) VALUES ('playlist', 1, '24h', '{}', 1, 2);`);
    const insert = db.prepare("INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES (?, 'catalog', 0, 'off', ?, 3)");
    for (const [name, scope, kind] of SLICES) insert.run(name, JSON.stringify({ scope, kind, pages: 5 }));
    if (options.extra) db.exec(options.extra);
    if (options.seeded) db.exec("INSERT INTO sync_seed (id, seeded_at) VALUES (1, 1)");
  } finally {
    db.close();
  }
  return file;
}

function migrated(options: { seeded: boolean; extra?: string }) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-library-fill-"));
  try {
    const file = database024(dir, options);
    createStore(file).close();
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const jobs = db.prepare("SELECT name, type, enabled, schedule, config, playlist_id, last_result, created_at FROM sync_jobs ORDER BY id")
        .all().map((row) => ({ ...row }));
      return { version: Number(db.prepare("PRAGMA user_version").get()?.user_version), jobs, check: db.prepare("PRAGMA foreign_key_check").all() };
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FILL = { name: "Library fill", type: "catalog", enabled: 1, schedule: "off", config: '{"scope":"discover","pages":500}', playlist_id: null, last_result: null };

test("a version-24 database with the four per-slice jobs and a playlist job ends with the playlist job and one Library fill", () => {
  const { version, jobs, check } = migrated({ seeded: true });
  assert.equal(version, 25);
  assert.deepEqual(jobs.map((j) => [j.name, j.type]), [[null, "playlist"], ["Library fill", "catalog"]]);
  assert.deepEqual({ ...jobs[1], created_at: undefined }, { ...FILL, created_at: undefined });
  assert.ok(Number(jobs[1]?.created_at) > 1_700_000_000_000, "created now, in milliseconds");
  assert.deepEqual(check, []);
});

test("a database that already has a discover job keeps it and gains none; the four slices still go", () => {
  const mine = `INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at)
    VALUES ('My fill', 'catalog', 1, '12h', '{"scope":"discover","pages":40}', 4)`;
  const { jobs } = migrated({ seeded: true, extra: mine });
  assert.deepEqual(jobs.map((j) => j.name), [null, "My fill"]);
  assert.deepEqual([jobs[1]?.schedule, jobs[1]?.config], ["12h", '{"scope":"discover","pages":40}']);
});

test("a database whose seed has not run gets no Library fill from the migration (the seed makes it)", () => {
  assert.deepEqual(migrated({ seeded: false }).jobs.map((j) => j.name), [null]);
});

test("only the seeded slices go: a renamed one, a near-name and one with a config that is not JSON stay", () => {
  const extra = `INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES
    ('My trending', 'catalog', 1, '6h', '{"scope":"trending","kind":"movie","pages":3}', 4),
    ('Trending movies ', 'catalog', 1, 'off', '{"scope":"trending","kind":"movie","pages":3}', 5);
    INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES ('Popular movies', 'catalog', 1, 'off', 'not json', 6)`;
  const { jobs } = migrated({ seeded: true, extra });
  assert.deepEqual(jobs.map((j) => j.name), [null, "My trending", "Trending movies ", "Popular movies", "Library fill"]);
});

test("a fresh database ends with exactly one Library fill, made by the seed with 500 pages", async () => {
  const t = await makeApp({ config: { TMDB_SYNC_SCHEDULE: "12h" } });
  const token = (await signIn(t.app)).access;
  const jobs = pick((await send(t.app, "GET", "/api/jobs", undefined, token)).body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(jobs.map((j) => [j.name, j.schedule, j.config]), [["Library fill", "12h", { scope: "discover", pages: 500 }]]);
});
