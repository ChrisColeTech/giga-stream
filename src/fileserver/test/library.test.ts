import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send, type FileserverApp } from "./app-fixture.js";

const at = Date.UTC(2026, 9, 16, 12);

/**
 * One local_files row with probe facts and a still, written over the app's database directly (the
 * media.test.ts pattern: real rows without a real scan); the file on disk is real but never read.
 */
function localFile(
  t: FileserverApp,
  name: string,
  input: { height?: number; posterId?: string; addedAt?: number; collectionId?: string } = {},
): string {
  const db = new DatabaseSync(path.join(t.dataDir, "giga-stream.db"));
  try {
    const folderId = crypto.randomUUID();
    const collectionId = input.collectionId ?? crypto.randomUUID();
    const id = crypto.randomUUID();
    const dir = mkdtempSync(path.join(os.tmpdir(), "giga-lib-"));
    writeFileSync(path.join(dir, name), "bytes");
    if (input.collectionId === undefined) {
      db.prepare("INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(collectionId, "Direct", at, at);
    }
    db.prepare("INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)").run(folderId, collectionId, dir, name, at);
    db.prepare(
      "INSERT INTO local_files (id, folder_id, collection_id, path, title, size_bytes, mtime_ms, height, poster_id, playable, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
    ).run(id, folderId, collectionId, path.join(dir, name), name, 5, at, input.height ?? null, input.posterId ?? null, input.addedAt ?? at);
    return id;
  } finally {
    db.close();
  }
}

/** The app pointed at a port nothing listens on, so the backend is honestly unreachable. */
async function closedApp(): Promise<FileserverApp> {
  const t = await makeApp();
  await send(t.app, "PATCH", "/api/settings", { adminUrl: "http://127.0.0.1:1" });
  return t;
}

const idsOf = (body: unknown): string[] =>
  (pick(body, "data.items") as Array<{ ref: { id: string } }>).map((one) => one.ref.id);

test("view=all with type=local lists the files: quality from height, the still, favorite and progress", async () => {
  const t = await closedApp();
  const id = localFile(t, "Concert.mkv", { height: 1080, posterId: "still-1" });
  await send(t.app, "PUT", `/api/favorites/local/${id}`);
  await send(t.app, "PUT", "/api/watch", { item: { kind: "local", id }, positionMs: 30_000, durationMs: 90_000, playbackId: "p1", seq: 1 });
  const page = await send(t.app, "GET", "/api/library?type=local");
  assert.equal(page.status, 200);
  const item = pick(page.body, "data.items.0");
  assert.deepEqual(pick(item, "ref"), { kind: "local", id });
  assert.equal(pick(item, "title"), "Concert.mkv");
  assert.equal(pick(item, "quality"), "1080p");
  assert.equal(pick(item, "posterUrl"), "/api/images/still-1");
  assert.equal(pick(item, "favorite"), true);
  assert.deepEqual(pick(item, "progress"), { positionMs: 30_000, durationMs: 90_000, state: "watching" });
  assert.equal(pick(page.body, "data.titlesAvailable"), false, "no title read was made");
  assert.equal(pick(page.body, "data.total"), 1);
  await t.dispose();
});

test("q and the sorts narrow and order the local rows", async () => {
  const t = await closedApp();
  const alpha = localFile(t, "Alpha.mkv", { addedAt: at });
  const beta = localFile(t, "Beta Concert.mkv", { addedAt: at + 60_000 });
  const q = await send(t.app, "GET", "/api/library?type=local&q=concert");
  assert.deepEqual(idsOf(q.body), [beta]);
  assert.equal(pick(q.body, "data.total"), 1);
  const newest = await send(t.app, "GET", "/api/library?type=local");
  assert.deepEqual(idsOf(newest.body), [beta, alpha], "newest by when it was found (03 section 3.5)");
  assert.deepEqual(pick(newest.body, "data.facets.genres"), []);
  assert.equal(pick(newest.body, "data.facets.years.0"), 2026);
  assert.equal(pick(newest.body, "data.facets.years.length"), 30, "this year back 30");
  const oldest = await send(t.app, "GET", "/api/library?type=local&sort=oldest");
  assert.deepEqual(idsOf(oldest.body), [alpha, beta]);
  const az = await send(t.app, "GET", "/api/library?type=local&sort=az");
  assert.deepEqual(idsOf(az.body), [alpha, beta]);
  await t.dispose();
});

test("the cursor pages a second page", async () => {
  const t = await closedApp();
  for (let n = 0; n < 25; n++) localFile(t, `File ${String(n).padStart(2, "0")}.mkv`, { addedAt: at + n });
  const first = await send(t.app, "GET", "/api/library?type=local");
  assert.equal(pick(first.body, "data.items.length"), 20);
  const cursor = pick(first.body, "data.nextCursor");
  assert.ok(typeof cursor === "string", "the cursor is opaque and carries the position");
  const second = await send(t.app, "GET", `/api/library?type=local&cursor=${encodeURIComponent(String(cursor))}`);
  assert.equal(pick(second.body, "data.items.length"), 5);
  assert.equal(pick(second.body, "data.nextCursor"), undefined);
  assert.equal(pick(second.body, "data.items.0.title"), "File 04.mkv", "newest first, then the rest");
  await t.dispose();
});

test("view=favorites lists the tables' rows; without the backend a title degrades to a skeleton", async () => {
  const t = await closedApp();
  const id = localFile(t, "Concert.mkv", { height: 1080 });
  await send(t.app, "PUT", `/api/favorites/local/${id}`);
  await send(t.app, "PUT", "/api/favorites/title/movie-603");
  const page = await send(t.app, "GET", "/api/library?view=favorites");
  const items = pick(page.body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(items.length, 2);
  const title = items.find((one) => pick(one, "ref.kind") === "title");
  assert.equal(pick(title, "title"), "movie-603", "the id's readable form; title is never empty (03 3.5)");
  assert.deepEqual(pick(title, "genres"), []);
  assert.equal(pick(title, "year"), undefined);
  assert.equal(pick(title, "favorite"), true);
  const local = items.find((one) => pick(one, "ref.kind") === "local");
  assert.equal(pick(local, "quality"), "1080p");
  assert.equal(pick(page.body, "data.trending"), false);
  await t.dispose();
});

test("view=collection answers members and folder files; unknown is 404, a missing id is 422", async () => {
  const t = await closedApp();
  const made = await send(t.app, "POST", "/api/collections", { name: "Lane", type: "local" });
  const collectionId = String(pick(made.body, "data.id"));
  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "title", id: "movie-603" });
  const localId = localFile(t, "Reel.mkv", { height: 720, collectionId });
  const page = await send(t.app, "GET", `/api/library?view=collection&collectionId=${collectionId}`);
  assert.equal(pick(page.body, "data.items.length"), 2);
  assert.equal(pick(page.body, "data.total"), 2);
  const collectionItems = pick(page.body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(
    pick(collectionItems.find((item) => pick(item, "ref.kind") === "title"), "collectionSource"),
    "manual",
  );
  assert.equal(
    pick(collectionItems.find((item) => pick(item, "ref.id") === localId), "collectionSource"),
    "folder",
  );

  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "local", id: localId });
  const both = await send(t.app, "GET", `/api/library?view=collection&collectionId=${collectionId}`);
  assert.equal(pick(both.body, "data.items.length"), 2, "manual and folder paths produce one row");
  const bothLocal = (pick(both.body, "data.items") as Array<Record<string, unknown>>).find(
    (item) => pick(item, "ref.id") === localId,
  );
  assert.equal(pick(bothLocal, "collectionSource"), "manual");

  await send(t.app, "DELETE", `/api/collections/${collectionId}/items/local/${localId}`);
  const revealed = await send(t.app, "GET", `/api/library?view=collection&collectionId=${collectionId}`);
  const revealedLocal = (pick(revealed.body, "data.items") as Array<Record<string, unknown>>).find(
    (item) => pick(item, "ref.id") === localId,
  );
  assert.equal(pick(revealedLocal, "collectionSource"), "folder");

  const all = await send(t.app, "GET", "/api/library?type=local");
  assert.equal(pick(all.body, "data.items.0.collectionSource"), undefined, "source is absent outside collection view");
  const unknown = await send(t.app, "GET", "/api/library?view=collection&collectionId=no-such");
  assert.equal(unknown.status, 404);
  assert.equal(pick(unknown.body, "error.code"), "collection.not_found");
  const missing = await send(t.app, "GET", "/api/library?view=collection");
  assert.equal(missing.status, 422);
  assert.equal(pick(missing.body, "error.code"), "library.invalid");
  await t.dispose();
});

test("view=history is the watch entries, newest first, one row per entry with its watch id", async () => {
  const t = await closedApp();
  const one = localFile(t, "One.mkv");
  await send(t.app, "PUT", "/api/watch", { item: { kind: "local", id: one }, positionMs: 10, playbackId: "p1", seq: 1 });
  t.clock.advance(5_000);
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "movie-603" }, season: 1, episode: 2, positionMs: 2_400_000, durationMs: 3_600_000, playbackId: "p2", seq: 1 });
  const page = await send(t.app, "GET", "/api/library?view=history");
  const items = pick(page.body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(items.length, 2);
  assert.equal(pick(items[0], "title"), "movie-603", "the skeleton facts; the newest entry first");
  assert.equal(pick(items[0], "watchId") !== undefined, true, "history rows keep their watch id");
  assert.deepEqual(pick(items[0], "progress"), { positionMs: 2_400_000, durationMs: 3_600_000, state: "watching", season: 1, episode: 2 });
  assert.equal(pick(items[1], "title"), "One.mkv");
  await t.dispose();
});

test("facets over a list view keep the chosen values listed even when nothing matches", async () => {
  const t = await closedApp();
  const id = localFile(t, "Concert.mkv");
  await send(t.app, "PUT", "/api/watch", { item: { kind: "local", id }, positionMs: 1, playbackId: "p", seq: 1 });
  const page = await send(t.app, "GET", "/api/library?view=history&genre=Nothing&year=1999");
  assert.deepEqual(pick(page.body, "data.items"), []);
  assert.deepEqual(pick(page.body, "data.facets.genres"), ["Nothing"]);
  assert.deepEqual(pick(page.body, "data.facets.years"), [1999]);
  await t.dispose();
});

test("continue answers the watching rows, most recently watched first, at most ten", async () => {
  const t = await closedApp();
  const ids: string[] = [];
  for (let n = 0; n < 12; n++) {
    ids.push(localFile(t, `Part ${String(n).padStart(2, "0")}.mkv`));
    await send(t.app, "PUT", "/api/watch", { item: { kind: "local", id: ids[n] }, positionMs: 100 + n, durationMs: 90_000, playbackId: `p${n}`, seq: 1 });
    t.clock.advance(1_000);
  }
  await send(t.app, "PUT", "/api/watch", { item: { kind: "local", id: localFile(t, "Done.mkv") }, positionMs: 89_500, durationMs: 90_000, playbackId: "done", seq: 1 });
  const page = await send(t.app, "GET", "/api/library/continue");
  const items = pick(page.body, "data.items") as Array<{ title?: string }>;
  assert.equal(items.length, 10, "at most ten (06 section 4.2)");
  assert.ok(!items.some((one) => one.title === "Done.mkv"), "the watched item is not watching");
  assert.equal(items[0]?.title, "Part 11.mkv", "most recently watched first");
  assert.equal(items[9]?.title, "Part 02.mkv");
  await t.dispose();
});

test("trending while titles are unavailable is 422 library.invalid", async () => {
  const t = await closedApp();
  const refused = await send(t.app, "GET", "/api/library?sort=trending");
  assert.equal(refused.status, 422);
  assert.equal(pick(refused.body, "error.code"), "library.invalid");
  await t.dispose();
});
