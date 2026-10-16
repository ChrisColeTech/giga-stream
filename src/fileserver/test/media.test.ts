import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send } from "./app-fixture.js";

const at = Date.UTC(2026, 9, 16, 12);

interface FileRef {
  id: string;
  collectionId: string;
  etag: string;
  bytes: Buffer;
}

/** One local_files row over a real file on disk, written through `node:sqlite` (03 section 3.10). */
function plan(dataDir: string, bytes: Buffer): FileRef {
  const folderId = crypto.randomUUID();
  const collectionId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const folder = mkdtempSync(path.join(os.tmpdir(), "giga-media-"));
  const fileName = "the-video.mkv";
  writeFileSync(path.join(folder, fileName), bytes);
  const db = new DatabaseSync(path.join(dataDir, "giga-stream.db"));
  try {
    db.prepare("INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(collectionId, "Direct", at, at);
    db.prepare("INSERT INTO collection_folders (id, collection_id, path, name, created_at) VALUES (?, ?, ?, ?, ?)").run(folderId, collectionId, folder, "DirectFolder", at);
    db.prepare(
      `INSERT INTO local_files (id, folder_id, collection_id, path, title, size_bytes, mtime_ms, duration_ms, width, height,
         video_codec, audio_codec, container, playable, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(fileId, folderId, collectionId, fileName, fileName, bytes.byteLength, at, 90_000, 1920, 1080, "h264", "aac", "matroska", at);
    return { id: fileId, collectionId, etag: `"local-${fileId}-${bytes.byteLength}-${at}"`, bytes };
  } finally {
    db.close();
  }
}

/** Overwrites the row's identity on disk: a new name (gone) or a folder standing at the path. */
function rewrite(dataDir: string, id: string, change: (db: DatabaseSync, folderDir: string) => void): void {
  const db = new DatabaseSync(path.join(dataDir, "giga-stream.db"));
  try {
    const folder = db.prepare("SELECT f.path FROM local_files lf JOIN collection_folders f ON f.id = lf.folder_id WHERE lf.id = ?").get(id) as { path: string };
    change(db, folder.path);
  } finally {
    db.close();
  }
}

test("info answers the Player's details, never a path", async () => {
  const t = await makeApp();
  const bytes = Buffer.from("the whole file, byte for byte");
  const ref = plan(t.dataDir, bytes);
  const answer = await send(t.app, "GET", `/api/media/local/${ref.id}/info`);
  assert.deepEqual(pick(answer.body, "data"), {
    id: ref.id,
    title: "the-video.mkv",
    durationMs: 90_000,
    sizeBytes: bytes.byteLength,
    width: 1920,
    height: 1080,
    videoCodec: "h264",
    audioCodec: "aac",
    container: "matroska",
    playable: true,
    collectionIds: [ref.collectionId],
    folderName: "DirectFolder",
  });
  await t.dispose();
});

test("a full GET answers the bytes with Accept-Ranges and a strong ETag", async () => {
  const t = await makeApp();
  const bytes = Buffer.from("the whole file, byte for byte");
  const ref = plan(t.dataDir, bytes);
  const answer = await t.app.inject({ method: "GET", url: `/api/media/local/${ref.id}` });
  assert.equal(answer.statusCode, 200);
  assert.deepEqual(answer.body, bytes.toString("utf-8"));
  assert.equal(answer.headers["accept-ranges"], "bytes");
  assert.equal(answer.headers.etag, ref.etag);
  assert.equal(String(answer.headers["content-length"]), String(bytes.byteLength));
  await t.dispose();
});

test("one byte range is served as 206 with a Content-Range; open and suffix ranges behave", async () => {
  const t = await makeApp();
  const bytes = Buffer.from("0123456789");
  const ref = plan(t.dataDir, bytes);
  const answer = await t.app.inject({ method: "GET", url: `/api/media/local/${ref.id}`, headers: { range: "bytes=2-5" } });
  assert.equal(answer.statusCode, 206);
  assert.equal(answer.body, "2345");
  assert.equal(answer.headers["content-range"], `bytes 2-5/${bytes.byteLength}`);
  assert.equal(String(answer.headers["content-length"]), "4");
  assert.equal(
    (await t.app.inject({ method: "GET", url: `/api/media/local/${ref.id}`, headers: { range: "bytes=7-" } })).body,
    "789",
  );
  assert.equal(
    (await t.app.inject({ method: "GET", url: `/api/media/local/${ref.id}`, headers: { range: "bytes=-3" } })).body,
    "789",
  );
  await t.dispose();
});

test("If-Range with the exact ETag ranges; anything else answers the whole file", async () => {
  const t = await makeApp();
  const bytes = Buffer.from("0123456789");
  const ref = plan(t.dataDir, bytes);
  const ranged = await t.app.inject({
    method: "GET",
    url: `/api/media/local/${ref.id}`,
    headers: { range: "bytes=0-2", "if-range": ref.etag },
  });
  assert.equal(ranged.statusCode, 206);
  assert.equal(ranged.body, "012");
  const stale = await t.app.inject({
    method: "GET",
    url: `/api/media/local/${ref.id}`,
    headers: { range: "bytes=0-2", "if-range": '"local-other"' },
  });
  assert.equal(stale.statusCode, 200);
  assert.equal(stale.body, bytes.toString("utf-8"));
  await t.dispose();
});

test("a malformed, multi or unsatisfiable range is 416 playback.range_invalid", async () => {
  const t = await makeApp();
  const ref = plan(t.dataDir, Buffer.from("0123456789"));
  for (const range of ["0-2", "bytes=0-2,4-5", "bytes=abc-", "bytes=-", "bytes=99-", "bytes=-0"]) {
    const answer = await t.app.inject({ method: "GET", url: `/api/media/local/${ref.id}`, headers: { range } });
    assert.equal(answer.statusCode, 416, range);
    assert.equal(JSON.parse(answer.body).error.code, "playback.range_invalid");
  }
  await t.dispose();
});

test("HEAD answers the head of a 206; unknown ids and files gone from disk are 404", async () => {
  const t = await makeApp();
  const ref = plan(t.dataDir, Buffer.from("0123456789"));
  const head = await t.app.inject({ method: "HEAD", url: `/api/media/local/${ref.id}`, headers: { range: "bytes=0-2" } });
  assert.equal(head.statusCode, 206);
  assert.equal(head.body, "");
  assert.equal(String(head.headers["content-length"]), "3");

  assert.equal(pick((await send(t.app, "GET", "/api/media/local/no-such-id/info")).body, "error.code"), "media.not_found");
  rewrite(t.dataDir, ref.id, (db, folder) => {
    mkdirSync(path.join(folder, "a-directory.mkv"));
    db.prepare("UPDATE local_files SET path = 'a-directory.mkv' WHERE id = ?").run(ref.id);
  });
  assert.equal((await t.app.inject({ method: "GET", url: `/api/media/local/${ref.id}` })).statusCode, 404);
  await t.dispose();
});

test("an unplayable row answers `error` with the marker code", async () => {
  const t = await makeApp();
  const ref = plan(t.dataDir, Buffer.from("0123456789"));
  rewrite(t.dataDir, ref.id, (db) => {
    db.prepare(
      "UPDATE local_files SET playable = 0, probe_error_code = 'media.unplayable', probe_error_message = 'no streams' WHERE id = ?",
    ).run(ref.id);
  });
  const answer = await send(t.app, "GET", `/api/media/local/${ref.id}/info`);
  assert.deepEqual(pick(answer.body, "data.error"), { code: "media.unplayable", message: "no streams" });
  await t.dispose();
});
