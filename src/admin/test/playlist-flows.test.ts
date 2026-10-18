import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { draftOf, startReplace } from "@/lib/playlist-draft";
import type { JobsService } from "@/services/jobs";
import { createPlaylistFlows } from "@/services/playlist-flows";
import type { PlaylistsService } from "@/services/playlists";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const SECRET = "https://iptv.example.test/get.php?password=hunter2";
const state = () => useAppStore.getState();
const row = (id: number, extra: Partial<AdminPlaylist> = {}): AdminPlaylist => ({
  id,
  name: `List ${id}`,
  host: "iptv.example.test",
  masked: "iptv.example.test/…",
  enabled: true,
  channels: 2,
  ...extra,
});
const job = (id: number, playlistId: number): AdminJob => ({
  id,
  name: `Job ${id}`,
  type: "playlist",
  enabled: true,
  schedule: "off",
  config: { playlistId, dryRun: false, prune: false },
  running: false,
  createdAt: 1,
});

function rig(script: Partial<PlaylistsService> = {}, jobScript: Partial<JobsService> = {}) {
  const calls: string[] = [];
  const reloads: Array<number | undefined> = [];
  const service: PlaylistsService = {
    list: async () => (calls.push("list"), { items: [row(1), row(2)], unreadable: 0 }),
    create: async (input) => (calls.push("create"), row(3, { name: String(input["name"] ?? "iptv.example.test") })),
    update: async (id, patch) => (calls.push(`update:${id}`), row(id, { enabled: patch["enabled"] !== false })),
    remove: async (id) => (calls.push(`remove:${id}`), { id, released: 7 }),
    ...script,
  };
  const jobs: Pick<JobsService, "list" | "run"> = {
    list: async () => ({ items: [job(5, 1)], unreadable: 0 }),
    run: async (id) => (calls.push(`run:${id}`), job(id, 1)),
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

  it("create: upserts, says Created, and the address reaches no notice, event or state", async () => {
    const { flows, reloads } = rig();
    const result = await flows.create({ name: "Main", address: SECRET });
    assert.equal(result.ok, true);
    assert.equal(notice(), "Created Main.");
    assert.deepEqual(reloads, [10]);
    assert.equal(state().stale.jobs, true);
    assert.ok(!everything().includes("hunter2"));
  });

  it("create refuses a non-https address under Address before sending, and a 422 under its field", async () => {
    const { flows, calls } = rig({
      create: async () => Promise.reject(new ApiError("playlist.invalid", "Not accepted.", 422, { field: "address" })),
    });
    assert.deepEqual(await flows.create({ name: "", address: "http://x.test/a" }), {
      ok: false,
      field: "address",
      sentence: "Address must be an https address.",
    });
    assert.deepEqual(calls, []);
    const refused = await flows.create({ name: "", address: SECRET });
    assert.deepEqual([refused.ok, !refused.ok && refused.field], [false, "address"]);
    assert.equal(state().notice?.tone, "warn");
    assert.ok(!everything().includes("hunter2"));
  });

  it("save: sends only the changes, a replaced address once, and says Saved", async () => {
    const { flows, calls } = rig();
    await flows.load();
    const unchanged = await flows.save(1, startReplace(draftOf(row(1))));
    assert.deepEqual([unchanged.ok, unchanged.ok && unchanged.value], [true, null]);
    const saved = await flows.save(1, { ...startReplace(draftOf(row(1))), address: SECRET });
    assert.equal(saved.ok, true);
    assert.deepEqual(calls.filter((call) => call.startsWith("update")), ["update:1"]);
    assert.equal(notice(), "Saved List 1.");
    assert.ok(!everything().includes("hunter2"));
  });

  it("remove: says the channels kept, marks Jobs and Channels stale, and closes its open workspace", async () => {
    const { flows } = rig();
    await flows.load();
    state().openWorkspace("playlists", "1");
    await flows.remove(1);
    assert.equal(notice(), "Deleted List 1; 7 channels kept.");
    assert.deepEqual([state().stale.jobs, state().stale.channels], [true, true]);
    assert.equal(state().workspaces.playlists, null);
    assert.deepEqual(state().playlists.items.map((item) => item.id), [2]);
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
    const { flows } = rig({ create: async () => (await gate, row(3)) });
    const pending = flows.create({ name: "", address: SECRET });
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
