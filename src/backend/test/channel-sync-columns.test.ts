// The channel repository and the sync-owned columns (docs/43 section 3.1): `update` never writes them, it only clears
// the ones that depend on an address it changes, in the same statement; the joined values are derived, never written.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createStore } from "../src/store/store.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";

const row = (over: Partial<StreamRecord> = {}): StreamRecord => ({
  ...NOT_SYNCED, kind: "stream", id: "a", name: "A", category: "News", number: null, logoUrl: "https://img.example/a.png",
  tvgId: null, streamUrl: "https://s.example/a.m3u8", syncName: "A", playlistId: 1, editedFields: [], revision: 1,
  enabled: true, published: true, ...over,
});

function withStore(work: (store: ReturnType<typeof createStore>, setSyncColumns: () => void) => void): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-sync-columns-"));
  const file = path.join(dir, "admin.db");
  try {
    const store = createStore(file);
    store.playlists.insert({ kind: "url", name: "One", url: "https://one.example/l.m3u", host: "one.example", enabled: true }, 1);
    store.channels.insert(row(), 1);
    // The sync's own targeted writes arrive in a later wave; here a second connection stands in for them.
    const setSyncColumns = (): void => {
      const db = new DatabaseSync(file);
      db.exec("UPDATE channels SET status = 'offline', checked_at = 50, logo_file = 'f.png', logo_checked_at = 60 WHERE id = 'a'");
      db.close();
    };
    try {
      work(store, setSyncColumns);
    } finally {
      store.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const synced = (store: ReturnType<typeof createStore>) => {
  const found = store.channels.find("a") as StreamRecord;
  return [found.status, found.checkedAt, found.logoFile, found.logoCheckedAt];
};

test("an update writes none of the sync-owned columns, whatever the record in hand says", () => {
  withStore((store, setSyncColumns) => {
    setSyncColumns();
    store.channels.update(row({ name: "Renamed", status: "online", checkedAt: 1, logoFile: "other.png", logoCheckedAt: 2, revision: 2 }));
    assert.deepEqual(synced(store), ["offline", 50, "f.png", 60]);
    assert.equal(store.channels.find("a")?.name, "Renamed");
  });
});

test("a changed stream address clears the verdict, a changed logo address clears the cached file; unchanged keeps both", () => {
  withStore((store, setSyncColumns) => {
    setSyncColumns();
    store.channels.update(row({ category: "Sports" }));
    assert.deepEqual(synced(store), ["offline", 50, "f.png", 60], "nothing about an address changed");
    store.channels.update(row({ streamUrl: "https://s.example/a-2.m3u8" }));
    assert.deepEqual(synced(store), [null, null, "f.png", 60], "the verdict was about the old address");
    setSyncColumns();
    store.channels.update(row({ streamUrl: "https://s.example/a-2.m3u8", logoUrl: "https://img.example/new.png" }));
    assert.deepEqual(synced(store), ["offline", 50, null, null], "the cached copy was of the old logo");
    setSyncColumns();
    store.channels.update(row({ streamUrl: "https://s.example/a-2.m3u8", logoUrl: null }));
    assert.deepEqual(synced(store), ["offline", 50, null, null], "no logo address, no cached copy");
  });
});

test("source, playlist name and published are derived by the read from the playlist, never written", () => {
  withStore((store) => {
    const read = () => store.channels.find("a") as StreamRecord;
    assert.deepEqual([read().source, read().playlistName, read().published], ["one.example", "One", true]);
    store.playlists.update({ id: 1, name: "Renamed", url: "https://one.example/l.m3u", host: "moved.example", enabled: false });
    assert.deepEqual([read().source, read().playlistName, read().published], ["moved.example", "Renamed", false]);
    store.channels.update(row({ source: "forged", playlistName: "forged", published: true }));
    assert.deepEqual([read().source, read().playlistName, read().published], ["moved.example", "Renamed", false]);
    store.playlists.insert({ kind: "file", name: "File", fileName: "f.m3u", enabled: true }, 2);
    store.channels.insert(row({ id: "b", playlistId: 2 }), 2);
    assert.equal((store.channels.find("b") as StreamRecord).source, "f.m3u", "a file playlist's source is its file name");
  });
});
