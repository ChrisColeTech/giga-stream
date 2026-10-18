import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { EMPTY_NEW_CHANNEL } from "@/lib/channel-body";
import { liveDraft, streamDraft } from "@/lib/channel-draft";
import { createChannelFlows } from "@/services/channel-flows";
import type { ChannelsService } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { live, stream } from "./support/channels-kit";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const notice = (): string | undefined => state().notice?.sentence;
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
    create: unexpected("create"),
    update: unexpected("update"),
    remove: unexpected("remove"),
    rebuild: unexpected("rebuild"),
    revert: unexpected("revert"),
    ...overrides,
  };
  return { service, calls };
}

const flowsOf = (service: ChannelsService) => createChannelFlows({ service, store: () => state() });
const hold = (...items: AdminChannel[]) => state().channelsLoaded(items, 1);

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
    assert.deepEqual(state().channels.items.map((item) => item.id), ["live-1"]);
    assert.equal(notice(), "Drive News is preparing.");
  });

  it("create a stream channel: `Created <name>.`", async () => {
    const flows = flowsOf(fake({ create: async () => stream("ch_1", { name: "Talk" }) }).service);
    await flows.create({ ...EMPTY_NEW_CHANNEL, kind: "stream", name: "Talk", streamUrl: "https://a.b/c" });
    assert.equal(notice(), "Created Talk.");
  });

  it("refuse a bad value before any call, under its row", async () => {
    const { service, calls } = fake();
    const result = await flowsOf(service).create({
      ...EMPTY_NEW_CHANNEL,
      kind: "stream",
      name: "N",
      streamUrl: "http://a.b/c",
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
    assert.equal(notice(), "Saved New.");
    const now = state().channels.items[0];
    assert.ok(now?.kind === "live");
    await flows.save("a", { ...liveDraft(now), mode: "encode" });
    assert.equal(notice(), "New is preparing.");
    assert.deepEqual(sent, [{ name: "New" }, { mode: "encode" }]);
  });

  it("put a refused stream address under its row, and the videos.<n> refusal under Videos", async () => {
    const s = stream("s");
    hold(s, live("v", { folder: undefined, videos: ["D:\\a.mp4"] }));
    const flows = flowsOf(fake({ update: async () => Promise.reject(refuse("channel.invalid", "videos.0")) }).service);
    const local = await flows.save("s", { ...streamDraft(s), streamUrl: "http://plain" });
    assert.deepEqual([!local.ok && local.field, !local.ok && local.sentence], ["streamUrl", "Stream address must be an https address."]);
    const draft = { ...liveDraft(live("v", { folder: undefined, videos: ["D:\\a.mp4"] })), videos: ["D:\\gone.mp4"] };
    const remote = await flows.save("v", draft);
    assert.equal(!remote.ok && remote.field, "videos");
  });

  it("remove a channel, close its open workspace, and remove a gone one on not_found", async () => {
    hold(live("a"), stream("b", { source: "lists.example" }));
    state().openWorkspace("channels", "a");
    const { service } = fake({
      remove: async (id) => (id === "a" ? { id } : Promise.reject(refuse("channel.not_found", undefined, 404))),
      list: async () => ({ items: [], revision: 2, unreadable: 0 }),
    });
    await flowsOf(service).remove("a");
    assert.deepEqual([state().channels.items.map((item) => item.id), state().workspaces.channels], [["b"], null]);
    assert.equal(notice(), "Deleted Channel a.");
    await flowsOf(service).remove("b");
    assert.deepEqual(state().channels.items, []);
  });

  it("rebuild and revert replace the record with the answer", async () => {
    hold(live("a"), stream("s", { source: "lists.example", editedFields: ["name"] }));
    const flows = flowsOf(
      fake({
        rebuild: async () => live("a", { state: "preparing" }),
        revert: async () => stream("s", { source: "lists.example", editedFields: [] }),
      }).service,
    );
    await flows.rebuild("a");
    assert.equal(notice(), "Channel a is preparing.");
    await flows.revert("s");
    const reverted = state().channels.items.find((item) => item.id === "s");
    assert.deepEqual([reverted?.kind === "stream" && reverted.editedFields, notice()], [[], "Reverted Stream s."]);
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
        list: async () => (up ? { items: [live("a")], revision: 3, unreadable: 1 } : Promise.reject(down)),
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
