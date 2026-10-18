import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { selectAll } from "@/lib/playlist-rows";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { playlist } from "./support/run-kit";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const row = (id: number, enabled = true): AdminPlaylist =>
  playlist(id, { host: `h${id}.test`, masked: `https://h${id}.test/…`, enabled, channels: id });

beforeEach(() => resetStore());

describe("the playlists slice", () => {
  it("moves through idle, loading, ready and failed, keeping the last rows on a failure", () => {
    assert.equal(state().playlists.status, "idle");
    state().playlistsStartLoad();
    assert.equal(state().playlists.status, "loading");
    state().playlistsLoaded([row(1), row(2)], { 1: { id: 9, enabled: true, running: false } });
    assert.deepEqual([state().playlists.status, state().playlists.items.length], ["ready", 2]);
    assert.equal(state().playlists.jobFor[1]?.id, 9);
    state().playlistsLoadFailed(true);
    assert.deepEqual([state().playlists.status, state().playlists.unreachable, state().playlists.items.length], [
      "failed",
      true,
      2,
    ]);
    state().playlistsLoaded([row(1)], {});
    assert.equal(state().playlists.unreachable, false);
  });

  it("upserts in place, appends a new one, removes, and prunes the ticks of a row that goes", () => {
    state().playlistsLoaded([row(1), row(2)], {});
    state().playlistUpsert({ ...row(1), name: "Renamed" });
    state().playlistUpsert(row(3));
    assert.deepEqual(state().playlists.items.map((item) => item.name), ["Renamed", "List 2", "List 3"]);
    state().playlistTick(2, true);
    state().playlistTick(3, true);
    state().playlistRemove(2);
    assert.deepEqual(state().playlists.ticked, [3]);
  });

  it("ticks all, none, and reports a part as mixed", () => {
    state().playlistsLoaded([row(1), row(2)], {});
    state().playlistsTickAll(true);
    assert.equal(selectAll(state().playlists.items, state().playlists.ticked), true);
    state().playlistTick(1, false);
    assert.equal(selectAll(state().playlists.items, state().playlists.ticked), "mixed");
    state().playlistsTickAll(false);
    assert.equal(selectAll(state().playlists.items, state().playlists.ticked), false);
    state().playlistsSetTicked([2, 99]);
    assert.deepEqual(state().playlists.ticked, [2]);
  });

  it("is reset for a new session, owned by that session's serial", () => {
    state().playlistsLoaded([row(1)], {});
    state().playlistTick(1, true);
    state().playlistsReset(4);
    assert.deepEqual(
      [state().playlists.status, state().playlists.items, state().playlists.ticked, state().playlists.session],
      ["idle", [], [], 4],
    );
  });
});
