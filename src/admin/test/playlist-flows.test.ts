import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { draftOf, type NewPlaylistDraft } from "@/lib/playlist-draft";
import type { JobsService } from "@/services/jobs";
import { createPlaylistFlows } from "@/services/playlist-flows";
import type { PlaylistsService } from "@/services/playlists";
import type { PlaylistImport } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { filePlaylist, playlist as row, playlistJob as job } from "./support/run-kit";
import { resetStore, signInForTest } from "./support/store";

const SECRET = "https://iptv.example.test/get.php?password=hunter2";
const state = () => useAppStore.getState();
const m3u = new File(["#EXTM3U\n"], "us.m3u");
const FILE: NewPlaylistDraft = { source: "file", file: m3u, address: "" };
const WEB: NewPlaylistDraft = { source: "url", file: null, address: SECRET };
const imported = (name: string, created = true, counts = { created: 3, updated: 0 }): PlaylistImport => ({
  playlist: filePlaylist(3, { name }),
  created,
  imported: { ...counts, skipped: 0, refused: 0, refusalExamples: [] },
});

function rig(script: Partial<PlaylistsService> = {}, jobScript: Partial<JobsService> = {}) {
  const calls: string[] = [];
  const reloads: Array<number | undefined> = [];
  const service: PlaylistsService = {
    list: async () => (calls.push("list"), { items: [row(1), row(2)], unreadable: 0 }),
    create: async () => (calls.push("create"), imported("iptv.example.test")),
    importFile: async (file) => (calls.push(`file:${file.name}`), imported(file.name)),
    update: async (id, patch) => (calls.push(`update:${id}`), row(id, { enabled: patch["enabled"] !== false })),
    remove: async (id) => (calls.push(`remove:${id}`), { id, deletedChannels: 7, deletedJobs: 1 }),
    ...script,
  };
  const jobs: Pick<JobsService, "list" | "run"> = {
    list: async () => ({ items: [job(5, 1)], unreadable: 0 }),
    run: async (id) => (calls.push(`run:${id}`), job(id, 1, { running: true })),
    ...jobScript,
  };
  const audit = { reload: async (limit?: number) => void reloads.push(limit) };
  const flows = createPlaylistFlows({ service, jobs, store: () => state(), audit });
  return { flows, calls, reloads };
}
const notice = (): string => state().notice?.sentence ?? "";
const everything = (): string => JSON.stringify({ ...state(), tokens: null });

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the playlist flows", () => {
  it("load the list with the jobs behind Sync now", async () => {
    const { flows } = rig();
    await flows.load();
    assert.deepEqual(state().playlists.items.map((item) => item.id), [1, 2]);
    assert.deepEqual(state().playlists.jobFor[1], { id: 5, enabled: true, running: false });
  });

  it("import a file: sends the chosen file, says the counts, and marks Channels and Jobs stale", async () => {
    const { flows, calls, reloads } = rig();
    const result = await flows.importPlaylist(FILE);
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["file:us.m3u"]);
    assert.equal(notice(), "Imported us.m3u: 3 channels, all disabled. Enable them on the Channels tab.");
    assert.deepEqual([state().stale.channels, state().stale.jobs], [true, true]);
    assert.deepEqual(state().playlists.items.map((item) => item.id), [3], "the playlist alone, not the import's extra keys");
    assert.equal("imported" in (state().playlists.items[0] ?? {}), false);
    assert.deepEqual(reloads, [10]);
  });

  it("import a web address: sends the address through create, and it reaches no notice, event or state", async () => {
    const { flows, calls } = rig();
    const result = await flows.importPlaylist(WEB);
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["create"]);
    assert.match(notice(), /^Imported iptv\.example\.test: 3 channels, all disabled\./);
    assert.ok(!everything().includes("hunter2"));
  });

  it("import the same file again: says what changed instead of claiming every channel is new", async () => {
    const { flows } = rig({ importFile: async () => imported("us.m3u", false, { created: 0, updated: 0 }) });
    await flows.importPlaylist(FILE);
    assert.equal(notice(), "Imported us.m3u again: 0 created, 0 updated.");
  });

  it("refuses with no file chosen under File, and a non-https address under Address, before sending", async () => {
    const { flows, calls } = rig();
    assert.deepEqual(await flows.importPlaylist({ ...FILE, file: null }), {
      ok: false, field: "file", sentence: "Choose a file first.",
    });
    assert.deepEqual(await flows.importPlaylist({ ...WEB, address: "http://x.test/a" }), {
      ok: false, field: "address", sentence: "Address must be an https address.",
    });
    assert.deepEqual(calls, []);
  });

  it("puts the backend's refusals under their rows: url under Address, file under File, taken as a notice", async () => {
    const refuse = (code: string, status: number, field?: string) =>
      Promise.reject(new ApiError(code, "Not accepted.", status, field === undefined ? {} : { field }));
    const web = rig({ create: async () => refuse("playlist.invalid", 422, "url") });
    const unreachable = await web.flows.importPlaylist(WEB);
    assert.deepEqual([unreachable.ok, !unreachable.ok && unreachable.field], [false, "address"]);
    assert.ok(!everything().includes("hunter2"));
    const file = rig({ importFile: async () => refuse("playlist.invalid", 422, "file") });
    const bad = await file.flows.importPlaylist(FILE);
    assert.deepEqual([bad.ok, !bad.ok && bad.field], [false, "file"]);
    const taken = rig({ importFile: async () => refuse("playlist.taken", 409) });
    const held = await taken.flows.importPlaylist(FILE);
    assert.deepEqual([held.ok, !held.ok && held.field, !held.ok && held.sentence], [false, undefined, "Not accepted."]);
    assert.equal(state().notice?.tone, "warn");
    assert.deepEqual([state().stale.channels, state().playlists.items.length], [false, 0], "a refusal creates nothing");
  });

  it("save: sends only the changes, an edited address once as `url`, and says Saved", async () => {
    const { flows, calls } = rig();
    await flows.load();
    const unchanged = await flows.save(1, draftOf(row(1)));
    assert.deepEqual([unchanged.ok, unchanged.ok && unchanged.value], [true, null]);
    const bad = await flows.save(1, { ...draftOf(row(1)), address: "http://iptv.example.test/a.m3u" });
    assert.deepEqual([bad.ok, !bad.ok && bad.field], [false, "address"], "the address rule refuses it before any call");
    assert.deepEqual(calls.filter((call) => call.startsWith("update")), []);
    const saved = await flows.save(1, { ...draftOf(row(1)), address: SECRET });
    assert.equal(saved.ok, true);
    assert.deepEqual(calls.filter((call) => call.startsWith("update")), ["update:1"]);
    assert.equal(notice(), "Saved List 1.");
    assert.equal(state().stale.channels, true, "a playlist's enabled switch changes what players read");
    assert.ok(!everything().includes("hunter2"));
  });

  it("remove: says the channels that went with it, marks Jobs and Channels stale, and closes its open workspace", async () => {
    const { flows } = rig();
    await flows.load();
    state().openWorkspace("playlists", "1");
    await flows.remove(1);
    assert.equal(notice(), "Deleted List 1 and 7 channels.");
    assert.deepEqual([state().stale.jobs, state().stale.channels], [true, true]);
    assert.equal(state().workspaces.playlists, null);
    assert.deepEqual(state().playlists.items.map((item) => item.id), [2]);
  });

  it("Sync now starts the playlist's job; the run is not awaited", async () => {
    const { flows, calls } = rig();
    await flows.load();
    const tally = { channels: 0, jobs: 0 };
    assert.equal(await flows.bulkCall("sync", tally)({ id: 1, label: "List 1" }), null);
    assert.equal(await flows.bulkCall("sync", tally)({ id: 2, label: "List 2" }), "This playlist has no job to run.");
    assert.deepEqual(calls.filter((call) => call.startsWith("run")), ["run:5"]);
  });

  it("bulk Delete adds each answer's deleted channels and jobs to the tally", async () => {
    const { flows } = rig();
    await flows.load();
    const tally = { channels: 0, jobs: 0 };
    await flows.bulkCall("delete", tally)({ id: 1, label: "List 1" });
    await flows.bulkCall("delete", tally)({ id: 2, label: "List 2" });
    assert.deepEqual(tally, { channels: 14, jobs: 2 });
  });

  it("a not_found save closes the workspace and reads the list again", async () => {
    const missing = new ApiError("playlist.not_found", "Gone.", 404);
    const { flows, calls } = rig({ update: async () => Promise.reject(missing) });
    await flows.load();
    state().openWorkspace("playlists", "1");
    await flows.save(1, { ...draftOf(row(1)), enabled: false });
    assert.equal(state().workspaces.playlists, null);
    assert.equal(calls.filter((call) => call === "list").length, 2);
  });

  it("drops an answer that lands after the session changed", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { flows } = rig({ importFile: async () => (await gate, imported("us.m3u")) });
    const pending = flows.importPlaylist(FILE);
    state().signOut();
    release();
    const result = await pending;
    assert.deepEqual([result.ok, !result.ok && result.dropped], [false, true]);
    assert.equal(state().playlists.items.length, 0);
  });

  it("a transport failure marks the backend unreachable", async () => {
    const { flows } = rig({ list: async () => Promise.reject(new ApiError("backend.unreachable", "Down.")) });
    await flows.load();
    assert.deepEqual([state().playlists.status, state().playlists.unreachable], ["failed", true]);
  });
});
