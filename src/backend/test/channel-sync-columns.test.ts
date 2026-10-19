// The channel repository and the sync-owned columns (docs/43 section 3.1): `update` never writes them, it only clears
// the ones that depend on an address it changes, in the same statement; the joined values are derived, never written.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { Store } from "../src/store/store.js";
import { createStore } from "../src/store/store.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";
import { removeDir, openTestDatabase, runSql } from "./db-kit.js";

const row = (over: Partial<StreamRecord> = {}): StreamRecord => ({
  ...NOT_SYNCED, kind: "stream", id: "a", name: "A", category: "News", number: null, logoUrl: "https://img.example/a.png",
  tvgId: null, streamUrl: "https://s.example/a.m3u8", syncName: "A", playlistId: 1, editedFields: [], revision: 1,
  enabled: true, published: true, ...over,
});

async function withStore(work: (store: Store, setSyncColumns: () => Promise<void>) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-sync-columns-"));
  const file = path.join(dir, "admin.db");
  try {
    const store = await createStore(file);
    await store.playlists.insert({ kind: "url", name: "One", url: "https://one.example/l.m3u", host: "one.example", enabled: true }, 1);
    await store.channels.insert(row(), 1);
    // The sync's own targeted writes arrive in a later wave; here a second connection stands in for them.
    const setSyncColumns = async (): Promise<void> => {
      const db = await openTestDatabase(file);
      await runSql(db, "UPDATE channels SET status = 'offline', checked_at = 50, logo_file = 'f.png', logo_checked_at = 60 WHERE id = 'a'");
      db.close();
    };
    try {
      await work(store, setSyncColumns);
    } finally {
      store.close();
    }
  } finally {
    removeDir(dir);
  }
}

const synced = async (store: Store): Promise<unknown[]> => {
  const found = (await store.channels.find("a")) as StreamRecord;
  return [found.status, found.checkedAt, found.logoFile, found.logoCheckedAt];
};

test("an update writes none of the sync-owned columns, whatever the record in hand says", async () => {
  await withStore(async (store, setSyncColumns) => {
    await setSyncColumns();
    await store.channels.update(row({ name: "Renamed", status: "online", checkedAt: 1, logoFile: "other.png", logoCheckedAt: 2, revision: 2 }));
    assert.deepEqual(await synced(store), ["offline", 50, "f.png", 60]);
    assert.equal((await store.channels.find("a"))?.name, "Renamed");
  });
});

test("a changed stream address clears the verdict, a changed logo address clears the cached file; unchanged keeps both", async () => {
  await withStore(async (store, setSyncColumns) => {
    await setSyncColumns();
    await store.channels.update(row({ category: "Sports" }));
    assert.deepEqual(await synced(store), ["offline", 50, "f.png", 60], "nothing about an address changed");
    await store.channels.update(row({ streamUrl: "https://s.example/a-2.m3u8" }));
    assert.deepEqual(await synced(store), [null, null, "f.png", 60], "the verdict was about the old address");
    await setSyncColumns();
    await store.channels.update(row({ streamUrl: "https://s.example/a-2.m3u8", logoUrl: "https://img.example/new.png" }));
    assert.deepEqual(await synced(store), ["offline", 50, null, null], "the cached copy was of the old logo");
    await setSyncColumns();
    await store.channels.update(row({ streamUrl: "https://s.example/a-2.m3u8", logoUrl: null }));
    assert.deepEqual(await synced(store), ["offline", 50, null, null], "no logo address, no cached copy");
  });
});

test("source, playlist name and published are derived by the read from the playlist, never written", async () => {
  await withStore(async (store) => {
    const read = async () => (await store.channels.find("a")) as StreamRecord;
    assert.deepEqual([(await read()).source, (await read()).playlistName, (await read()).published], ["one.example", "One", true]);
    await store.playlists.update({ id: 1, name: "Renamed", url: "https://one.example/l.m3u", host: "moved.example", enabled: false });
    assert.deepEqual([(await read()).source, (await read()).playlistName, (await read()).published], ["moved.example", "Renamed", false]);
    await store.channels.update(row({ source: "forged", playlistName: "forged", published: true }));
    assert.deepEqual([(await read()).source, (await read()).playlistName, (await read()).published], ["moved.example", "Renamed", false]);
    await store.playlists.insert({ kind: "file", name: "File", fileName: "f.m3u", enabled: true }, 2);
    await store.channels.insert(row({ id: "b", playlistId: 2 }), 2);
    assert.equal(((await store.channels.find("b")) as StreamRecord).source, "f.m3u", "a file playlist's source is its file name");
  });
});