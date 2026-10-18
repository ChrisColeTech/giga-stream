// Deleting a playlist (docs/43 section 3.2): its channels and sync job go with it through the foreign keys, in one
// transaction; hand-made channels and other playlists are untouched; a running sync is aborted and awaited.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createAuditService, type AuditService } from "../src/services/audit-service.js";
import { createPlaylistService } from "../src/services/playlist-service.js";
import { createStore } from "../src/store/store.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";
import { M3U, ONE, setupPlaylists, uploadFile } from "./playlist-kit.js";
import { pick } from "./test-app.js";

const stream = (id: string, playlistId: number | null): StreamRecord => ({
  ...NOT_SYNCED, kind: "stream", id, name: id, category: "News", number: null, logoUrl: null, tvgId: null,
  streamUrl: `https://stream.example/${id}.m3u8`, syncName: playlistId === null ? null : id, playlistId, editedFields: [],
  revision: 1, enabled: true, published: true,
});

test("deleting removes the playlist, its channels and its job; hand-made and other playlists' channels stay", async () => {
  const { t, token, api, revision, audit } = await setupPlaylists();
  await uploadFile(t, token, "one.m3u", M3U);
  await uploadFile(t, token, "two.m3u", M3U);
  const hand = await api("POST", "/api/channels", { name: "Mine", category: "X", streamUrl: "https://h.example/a.m3u8" });
  assert.equal(hand.status, 201);
  const before = await revision();
  const gone = await api("DELETE", "/api/playlists/1");
  assert.deepEqual([gone.status, gone.body], [200, { ok: true, data: { id: 1, deletedChannels: 2, deletedJobs: 1 } }]);
  assert.equal(await revision(), before + 1, "one bump");
  const rows = pick((await api("GET", "/api/admin-channels")).body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(rows.map((r) => [r.name, r.playlistId]).sort(), [["ABC", 2], ["ESPN", 2], ["Mine", undefined]].sort());
  const jobs = pick((await api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(jobs.filter((j) => j.type === "playlist").map((j) => j.playlistId), [2]);
  assert.equal((await api("GET", "/api/playlists/1")).status, 404);
  assert.equal((await api("DELETE", "/api/playlists/1")).status, 404);
  const entries = (await audit()).filter((e) => e.action === "playlist.deleted");
  assert.deepEqual(entries.map((e) => e.detail), [{ channels: 2, jobs: 1, host: "one.m3u" }]);
  const again = await uploadFile(t, token, "one.m3u", M3U);
  assert.equal(pick(again.body, "data.id"), 3, "a deleted playlist's id is not reused");
});

test("the foreign keys alone cascade: deleting through the store leaves no orphan and a clean foreign_key_check", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-fk-"));
  const file = path.join(dir, "admin.db");
  try {
    const store = createStore(file);
    const one = store.playlists.insert({ kind: "file", name: "one", fileName: "one.m3u", enabled: true }, 1);
    const two = store.playlists.insert({ kind: "file", name: "two", fileName: "two.m3u", enabled: true }, 1);
    for (const owner of [one, two]) store.jobs.insertPlaylist(owner, 1);
    store.channels.insert(stream("a", one), 1);
    store.channels.insert(stream("b", two), 1);
    store.channels.insert(stream("c", null), 1);
    store.playlists.remove(one);
    assert.deepEqual(store.channels.list().map((c) => c.id), ["b", "c"]);
    assert.deepEqual(store.jobs.list().filter((j) => j.type === "playlist").map((j) => (j.type === "playlist" ? j.playlistId : 0)), [two]);
    store.close();
    const db = new DatabaseSync(file, { readOnly: true });
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failure inside the delete rolls everything back", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-rollback-"));
  try {
    const store = createStore(path.join(dir, "admin.db"));
    const id = store.playlists.insert({ kind: "file", name: "one", fileName: "one.m3u", enabled: true }, 1);
    store.jobs.insertPlaylist(id, 1);
    store.channels.insert(stream("a", id), 1);
    const failing: AuditService = { ...createAuditService(store, () => 1), record: () => { throw new Error("audit down"); } };
    const runner = { stop: async () => false };
    const service = createPlaylistService({ store, audit: failing, runner, allowLoopback: false, onChange: () => undefined });
    await assert.rejects(service.remove(id, {}), /audit down/);
    assert.deepEqual([store.playlists.find(id)?.name, store.channels.list().length, store.jobs.countOfPlaylist(id)], ["one", 1, 1]);
    assert.equal(store.revisions.current(), 0, "the revision bump rolled back too");
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deleting a playlist whose sync is running aborts that run, waits for it, then deletes", async () => {
  const { api, feed, importUrl } = await setupPlaylists();
  await importUrl(ONE);
  const jobId = Number((pick((await api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>).find((j) => j.type === "playlist")?.id);
  const gate = feed.hold(ONE);
  const started = await api("POST", `/api/jobs/${jobId}/run`, {});
  assert.deepEqual([started.status, pick(started.body, "data.running")], [202, true], "started, not awaited");
  await gate.started;
  const gone = await api("DELETE", "/api/playlists/1");
  assert.deepEqual(pick(gone.body, "data"), { id: 1, deletedChannels: 2, deletedJobs: 1 });
  assert.equal(pick((await api("GET", "/api/playlists")).body, "data.items.length"), 0);
  assert.equal((await api("GET", `/api/jobs/${jobId}`)).status, 404, "the run left no job behind");
  assert.equal(feed.asked.length, 2, "the import and the one run");
});
