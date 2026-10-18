import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { makeApp, pick, send } from "./app-fixture.js";

const at = Date.UTC(2026, 9, 16, 12);

test("migration and the read boundary keep legacy local titles nonempty and path-free in every view", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-local-title-"));
  const mediaDir = path.join(dataDir, "private", "library");
  const privatePath = path.join(mediaDir, "Legacy Feature.mkv");
  mkdirSync(mediaDir, { recursive: true });
  writeFileSync(privatePath, "bytes");

  const first = await makeApp({ dataDir });
  const collectionId = crypto.randomUUID();
  const folderId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const dbFile = path.join(dataDir, "giga-stream.db");
  const seed = new DatabaseSync(dbFile);
  seed.prepare("INSERT INTO collections (id, name, type, created_at, updated_at) VALUES (?, ?, 'local', ?, ?)")
    .run(collectionId, "Legacy", at, at);
  seed.prepare(
    "INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(folderId, collectionId, mediaDir, "Legacy folder", at);
  seed.prepare(
    `INSERT INTO local_files (id, folder_id, collection_id, path, title, playable, added_at)
     VALUES (?, ?, ?, ?, '', 1, ?)`,
  ).run(fileId, folderId, collectionId, privatePath, at);
  seed.close();
  await send(first.app, "PUT", `/api/favorites/local/${fileId}`);
  await send(first.app, "PUT", "/api/watch", {
    item: { kind: "local", id: fileId }, positionMs: 1, playbackId: "legacy", seq: 1,
  });
  await first.dispose();

  const old = new DatabaseSync(dbFile);
  // Back to a version 4 file: the cache tables of migration 006 are not there yet either.
  old.exec("DROP TABLE cached_title_genres; DROP TABLE cached_titles; DROP TABLE cached_genres;");
  old.exec("DROP TABLE cached_channels; DROP TABLE cache_state;");
  old.exec("PRAGMA user_version = 4");
  old.close();
  const restarted = await makeApp({ dataDir });
  const migrated = new DatabaseSync(dbFile);
  assert.equal((migrated.prepare("PRAGMA user_version").get() as { user_version: number }).user_version, 7);
  assert.equal(
    (migrated.prepare("SELECT title FROM local_files WHERE id = ?").get(fileId) as { title: string }).title,
    "Legacy Feature.mkv",
  );
  migrated.prepare("UPDATE local_files SET title = '   ' WHERE id = ?").run(fileId);
  migrated.close();

  const urls = [
    "/api/library?type=local&q=feature&sort=az",
    "/api/library?view=history",
    "/api/library?view=favorites",
    `/api/library?view=collection&collectionId=${collectionId}`,
  ];
  for (const url of urls) {
    const answer = await send(restarted.app, "GET", url);
    assert.equal(pick(answer.body, "data.items.0.title"), "Legacy Feature.mkv", url);
    assert.deepEqual(pick(answer.body, "data.items.0.ref"), { kind: "local", id: fileId });
    assert.ok(!JSON.stringify(answer.body).includes(dataDir), `${url} exposed a private path`);
  }
  const info = await send(restarted.app, "GET", `/api/media/local/${fileId}/info`);
  assert.equal(pick(info.body, "data.title"), "Legacy Feature.mkv");
  assert.deepEqual(pick((await send(restarted.app, "GET", urls[0] ?? "")).body, "data.facets.genres"), []);
  await restarted.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});
