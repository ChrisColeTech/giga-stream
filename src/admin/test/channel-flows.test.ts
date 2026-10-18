import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { EMPTY_NEW_CHANNEL } from "@/lib/channel-body";
import { liveDraft, streamDraft } from "@/lib/channel-draft";
import { createChannelFlows } from "@/services/channel-flows";
import type { ChannelsService } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { holdChannels } from "./support/channels-hold";
import { live, stream } from "./support/channels-kit";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const notice = (): string | undefined => state().notice?.sentence;
/* An info sentence is the newest row of the events drawer, never the notice line (`50` section 2.1). */
const lastEvent = (): string | undefined => state().events.at(-1)?.sentence;
const refuse = (code: string, field?: string, status = 422) => new ApiError(code, "Server sentence.", status, { field });

/** A service whose every method is a script; a call records its route. */
function fake(overrides: Partial<ChannelsService> = {}): { service: ChannelsService; calls: string[] } {
  const calls: string[] = [];
  const unexpected = (what: string) => async (): Promise<never> => {
    calls.push(what);
    throw new Error(`unexpected ${what}`);
  };
  const service: ChannelsService = {
    list: unexpected("list"),
    page: unexpected("page"),
    liveRows: unexpected("liveRows"),
    create: unexpected("create"),
    update: unexpected("update"),
    remove: unexpected("remove"),
    rebuild: unexpected("rebuild"),
    revert: unexpected("revert"),
    setEnabled: unexpected("setEnabled"),
    setStatus: unexpected("setStatus"),
    readOne: unexpected("readOne"),
    ...overrides,
  };
  return { service, calls };
}

const flowsOf = (service: ChannelsService) => createChannelFlows({ service, store: () => state() });
const hold = (...items: AdminChannel[]) => holdChannels(items, 1);
const EMPTY_PAGE = { items: [], revision: 2, total: 0, offset: 0, unreadable: 0 };

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the channel flows", () => {
  it("create a live channel: the answer is inserted, `<name> is preparing.`, the form may clear", async () => {
    const answer = live("live-1", { name: "Drive News", state: "preparing" });
    const flows = flowsOf(fake({ create: async () => answer }).service);
    const result = await flows.create({ ...EMPTY_NEW_CHANNEL, name: "Drive News", folder: "D:\\v" });
    assert.equal(result.ok, true);
    assert.deepEqual([state().channels.live.map((item) => item.id), state().channels.total], [["live-1"], 1]);
    assert.equal(lastEvent(), "Drive News is preparing.");
  });

  it("create a stream channel: `Created <name>.`", async () => {
    const flows = flowsOf(fake({ create: async () => stream("ch_1", { name: "Talk" }) }).service);
    await flows.create({ ...EMPTY_NEW_CHANNEL, kind: "stream", name: "Talk", streamUrl: "https://a.b/c" });
    assert.equal(lastEvent(), "Created Talk.");
  });

  it("refuse a bad value before any call, under its row", async () => {
    const { service, calls } = fake();
    const result = await flowsOf(service).create({
      ...EMPTY_NEW_CHANNEL,
      kind: "stream",
      name: "N",
      streamUrl: "ftp://a.b/c",
    });
    assert.deepEqual([result.ok, !result.ok && result.field, calls], [false, "streamUrl", []]);
  });

  it("puts channel.invalid under its named row, and a taken id on the notice only (no number to blame)", async () => {
    const taken = flowsOf(fake({ create: async () => Promise.reject(refuse("channel.taken", "id", 409)) }).service);
    const result = await taken.create({ ...EMPTY_NEW_CHANNEL, name: "N", folder: "D:\\v" });
    assert.deepEqual([result.ok, !result.ok && result.field], [false, undefined]);
    const missing = flowsOf(fake({ create: async () => Promise.reject(refuse("channel.invalid", "folder")) }).service);
    const folder = await missing.create({ ...EMPTY_NEW_CHANNEL, name: "N", folder: "D:\\nope" });
    assert.deepEqual([!folder.ok && folder.field, notice()], ["folder", "Server sentence."]);
  });

  it("save only what changed; a source change says preparing, a name change says saved; nothing changed calls nothing", async () => {
    const saved = live("a", { name: "Old" });
    hold(saved);
    const sent: unknown[] = [];
    const { service, calls } = fake({
      update: async (_id, patch) => {
        sent.push(patch);
        const name = typeof patch["name"] === "string" ? patch["name"] : "New";
        return live("a", { name, mode: patch["mode"] === "encode" ? "encode" : "loop", state: "preparing" });
      },
    });
    const flows = flowsOf(service);
    assert.deepEqual(await flows.save("a", liveDraft(saved)), { ok: true, value: null });
    assert.deepEqual(calls, []);
    await flows.save("a", { ...liveDraft(saved), name: "New" });
    assert.equal(lastEvent(), "Saved New.");
    const now = state().channels.items[0];
    assert.ok(now?.kind === "live");
    assert.equal(now.name, "New");
    await flows.save("a", { ...liveDraft(now), mode: "encode" });
    assert.equal(lastEvent(), "New is preparing.");
    assert.deepEqual(sent, [{ name: "New" }, { mode: "encode" }]);
  });

  it("put a refused stream address under its row, and the videos.<n> refusal under Videos", async () => {
    const s = stream("s");
    hold(s, live("v", { folder: undefined, videos: ["D:\\a.mp4"] }));
    const flows = flowsOf(fake({ update: async () => Promise.reject(refuse("channel.invalid", "videos.0")) }).service);
    const local = await flows.save("s", { ...streamDraft(s), streamUrl: "ftp://plain" });
    assert.deepEqual([!local.ok && local.field, !local.ok && local.sentence], ["streamUrl", "Stream address must be an http or https address."]);
    const draft = { ...liveDraft(live("v", { folder: undefined, videos: ["D:\\a.mp4"] })), videos: ["D:\\gone.mp4"] };
    const remote = await flows.save("v", draft);
    assert.equal(!remote.ok && remote.field, "videos");
  });

  it("remove a channel, close its open workspace, and remove a gone one on not_found", async () => {
    hold(live("a"), stream("b", { source: "lists.example", playlistId: 3 }));
    state().openWorkspace("channels", "a");
    const { service } = fake({
      remove: async (id) => (id === "a" ? { id } : Promise.reject(refuse("channel.not_found", undefined, 404))),
      page: async () => EMPTY_PAGE,
      liveRows: async () => EMPTY_PAGE,
    });
    await flowsOf(service).remove("a");
    assert.deepEqual([state().channels.items.map((item) => item.id), state().workspaces.channels], [["b"], null]);
    assert.equal(lastEvent(), "Deleted Channel a.");
    await flowsOf(service).remove("b");
    assert.deepEqual(state().channels.items, []);
  });

  it("rebuild and revert replace the record with the answer", async () => {
    hold(live("a"), stream("s", { source: "lists.example", playlistId: 3, editedFields: ["name"] }));
    const flows = flowsOf(
      fake({
        rebuild: async () => live("a", { state: "preparing" }),
        revert: async () => stream("s", { source: "lists.example", playlistId: 3, editedFields: [] }),
      }).service,
    );
    await flows.rebuild("a");
    assert.equal(lastEvent(), "Channel a is preparing.");
    await flows.revert("s");
    const reverted = state().channels.items.find((item) => item.id === "s");
    assert.deepEqual([reverted?.kind === "stream" && reverted.editedFields, lastEvent()], [[], "Reverted Stream s."]);
  });

  it("enable and disable one row with a PATCH of enabled only, and the row and the Preview's copy follow", async () => {
    hold(stream("s"));
    state().channelsOpenPreview("s");
    const sent: unknown[] = [];
    const flows = flowsOf(
      fake({
        update: async (id, patch) => {
          sent.push(patch);
          return stream(id, { name: "Stream s", enabled: false, published: false });
        },
      }).service,
    );
    const result = await flows.setEnabled("s", false);
    assert.deepEqual([result.ok, sent, lastEvent()], [true, [{ enabled: false }], "Saved Stream s."]);
    assert.equal(state().channels.items[0]?.enabled, false);
    assert.equal(state().channels.preview?.channel?.enabled, false);
    assert.equal((await flows.setEnabled("gone", true)).ok, false);
  });

  it("mark a stream channel live or dead: the answered row, with the verdict and its time, replaces the held one", async () => {
    hold(stream("s"));
    state().channelsOpenPreview("s");
    const sent: string[] = [];
    const flows = flowsOf(
      fake({
        setStatus: async (id, status) => {
          sent.push(`${id}:${status}`);
          return stream(id, { name: "Stream s", status, checkedAt: 77 });
        },
      }).service,
    );
    assert.equal((await flows.mark("s", "dead")).ok, true);
    assert.deepEqual([sent, lastEvent()], [["s:dead"], "Marked Stream s dead."]);
    const row = state().channels.items[0];
    assert.deepEqual([row?.kind === "stream" && row.status, row?.kind === "stream" && row.checkedAt], ["dead", 77]);
    const window = state().channels.preview?.channel;
    assert.equal(window?.kind === "stream" && window.status, "dead");
  });

  it("say a refused or unreachable mark once and keep the row as it was", async () => {
    hold(stream("s"));
    const refused = flowsOf(fake({ setStatus: async () => Promise.reject(refuse("channel.not_stream")) }).service);
    const result = await refused.mark("s", "live");
    assert.deepEqual([result.ok, notice()], [false, "Server sentence."]);
    const row = state().channels.items[0];
    assert.equal(row?.kind === "stream" && row.status, undefined, "the row is as it was");
    const down = flowsOf(fake({ setStatus: async () => Promise.reject(refuse("backend.unreachable", undefined, 0)) }).service);
    await down.mark("s", "live");
    assert.equal(state().channels.unreachable, true);
  });

  it("drop an answer that arrives after the session changed", async () => {
    let answer: (channel: AdminChannel) => void = () => undefined;
    const flows = flowsOf(fake({ create: () => new Promise((resolve) => (answer = resolve)) }).service);
    const pending = flows.create({ ...EMPTY_NEW_CHANNEL, name: "N", folder: "D:\\v" });
    useAppStore.setState({ serial: state().serial + 1 });
    answer(live("late"));
    assert.deepEqual(await pending, { ok: false, sentence: "", dropped: true });
    assert.deepEqual(state().channels.items, []);
  });

  it("mark the backend unreachable on a transport failure, until a read works", async () => {
    const down = refuse("backend.unreachable", undefined, 0);
    let up = false;
    const flows = flowsOf(
      fake({
        page: async () => (up ? { items: [live("a")], revision: 3, total: 2, offset: 0, unreadable: 1 } : Promise.reject(down)),
        liveRows: async () => EMPTY_PAGE,
      }).service,
    );
    await flows.load();
    assert.deepEqual([state().channels.status, state().channels.unreachable], ["failed", true]);
    up = true;
    await flows.refresh();
    assert.deepEqual([state().channels.status, state().channels.unreachable], ["ready", false]);
    assert.equal(notice(), "1 channel could not be read.");
  });
});
