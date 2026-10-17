// The one-shot importer of an existing live-server.db (docs/26 decision D13), run here on databases the test makes.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { DatabaseSync } from "node:sqlite";

import { planImport, runLiveServerImport } from "../src/services/live-server-import-service.js";
import { itemOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
const folder = (): string => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-import-"));
  roots.push(dir);
  return dir;
};

interface LegacyRow {
  id: string;
  number: number;
  category: string;
  mode: string;
  captions: number;
  variants: string;
  folder: string | null;
}
const NEWS: LegacyRow = { id: "news", number: 1, category: "News", mode: "loop", captions: 1, variants: '["360p","720p"]', folder: null };
const HOME: LegacyRow = { id: "home", number: 5, category: "Entertainment", mode: "encode", captions: 0, variants: '["360p","720p","1080p"]', folder: "/v/home" };

/** The old live server's schema (its migration 001) with these channels in it; `news` lists two videos. */
function legacyDatabase(dir: string, rows: LegacyRow[] = [NEWS, HOME]): string {
  const file = path.join(dir, "live-server.db");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE channels (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, number INTEGER NOT NULL UNIQUE,
    mode TEXT NOT NULL, captions INTEGER NOT NULL, variants TEXT NOT NULL, folder TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE channel_videos (channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE, position INTEGER NOT NULL,
    path TEXT NOT NULL, PRIMARY KEY (channel_id, position));`);
  const add = db.prepare("INSERT INTO channels VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)");
  for (const r of rows) add.run(r.id, `Name of ${r.id}`, r.category, r.number, r.mode, r.captions, r.variants, r.folder);
  if (rows.some((r) => r.id === "news")) {
    const video = db.prepare("INSERT INTO channel_videos VALUES ('news', ?, ?)");
    video.run(0, "/v/news-2.mp4");
    video.run(1, "/v/news-1.mp4");
  }
  db.close();
  return file;
}

const options = (source: string, target: string, dryRun = false) => ({ source, target, dryRun, now: () => 1_000 });

test("a dry run reads both databases and writes nothing, not even the target file", () => {
  const dir = folder();
  const target = path.join(dir, "admin.db");
  const summary = runLiveServerImport(options(legacyDatabase(dir), target, true));
  assert.deepEqual(summary, { inserted: ["news", "home"], skipped: [], dryRun: true });
  assert.equal(existsSync(target), false);
});

test("the import writes each channel as a live row with its settings and videos, and is idempotent", async () => {
  const dir = folder();
  const target = path.join(dir, "admin.db");
  const source = legacyDatabase(dir);
  assert.deepEqual(runLiveServerImport(options(source, target)).inserted, ["news", "home"]);
  const again = runLiveServerImport(options(source, target));
  assert.deepEqual(again.inserted, []);
  assert.deepEqual(again.skipped.map((skip) => skip.id), ["news", "home"]);
  assert.deepEqual(runLiveServerImport(options(source, target, true)).inserted, []);

  const t = await makeApp({ dataDir: dir });
  const token = (await signIn(t.app)).access;
  await t.live.settled();
  const admin = (await send(t.app, "GET", "/api/admin-channels", undefined, token)).body;
  const news = itemOf(admin, "news");
  assert.deepEqual(
    [news.kind, news.name, news.category, news.number, news.mode, news.captions, news.variants, news.videos, news.folder],
    ["live", "Name of news", "News", "1", "loop", true, ["360p", "720p"], ["/v/news-2.mp4", "/v/news-1.mp4"], undefined],
  );
  const home = itemOf(admin, "home");
  assert.deepEqual(
    [home.number, home.mode, home.captions, home.variants, home.folder, home.videos],
    ["5", "encode", false, ["360p", "720p", "1080p"], "/v/home", undefined],
  );
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.revision"), 2);
  const audit = await send(t.app, "GET", "/api/audit", undefined, token);
  const actions = (pick(audit.body, "data.items") as Array<Record<string, unknown>>).map((entry) => entry.action);
  assert.equal(actions.filter((action) => action === "channel.imported").length, 2);
  await t.dispose();
});

test("a channel whose number a live row already holds is skipped with the reason", () => {
  const dir = folder();
  const target = path.join(dir, "admin.db");
  runLiveServerImport(options(legacyDatabase(dir), target));
  const other = legacyDatabase(folder(), [{ ...NEWS, id: "other" }, { ...HOME, id: "fresh", number: 6 }]);
  const summary = runLiveServerImport(options(other, target));
  assert.deepEqual(summary.inserted, ["fresh"]);
  assert.deepEqual(summary.skipped, [{ id: "other", reason: "number 1 is held by news" }]);
});

test("the plan keeps a number once per run and skips what the target holds", () => {
  const record = (id: string, number: string) => ({
    kind: "live" as const, id, name: id, category: "News", number, logoUrl: null, revision: 0,
    live: { mode: "loop" as const, captions: false, variants: ["360p" as const, "720p" as const], folder: null, videos: ["/a"] },
  });
  const plan = planImport(
    [record("a", "1"), record("b", "1"), record("c", "2"), record("d", "3")],
    { ids: new Set(["c"]), liveNumbers: new Map([["3", "z"]]) },
  );
  assert.deepEqual(plan.insert.map((r) => r.id), ["a"]);
  assert.deepEqual(plan.skipped, [
    { id: "b", reason: "number 1 is held by a" },
    { id: "c", reason: "already in the backend" },
    { id: "d", reason: "number 3 is held by z" },
  ]);
});
