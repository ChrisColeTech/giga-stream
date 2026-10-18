import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { CHANNEL_BULK_WORDS, channelBulkReason, planChannelBulk } from "@/lib/channel-bulk";
import { createBulkRunner } from "@/services/bulk-run";
import { createChannelBulkCall } from "@/services/channel-bulk";
import { useAppStore } from "@/store/app-store";
import { live, stream } from "./support/channels-kit";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const ITEMS = [live("a"), live("b", { enabled: false }), stream("c"), stream("d", { enabled: false })];
const ALL = ["a", "b", "c", "d"];
const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);
const OPEN = { working: false, unreachable: false };

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the channels' bulk verbs", () => {
  it("Enable skips the enabled rows, Disable the disabled ones, each with its reason", () => {
    const enable = planChannelBulk("enable", ITEMS, ALL);
    assert.deepEqual([ids(enable.runnable), enable.refused.map((row) => row.reason)], [["b", "d"], ["Already enabled.", "Already enabled."]]);
    const disable = planChannelBulk("disable", ITEMS, ALL);
    assert.deepEqual([ids(disable.runnable), disable.refused[0]?.reason], [["a", "c"], "Already disabled."]);
  });

  it("Rebuild runs only enabled live rows: a stream row and a disabled row are skipped with their reasons", () => {
    const plan = planChannelBulk("rebuild", ITEMS, ALL);
    assert.deepEqual(ids(plan.runnable), ["a"]);
    assert.deepEqual(
      plan.refused.map((row) => [row.id, row.reason]),
      [
        ["b", "Enable the channel to rebuild it."],
        ["c", "A stream channel has nothing to rebuild."],
        ["d", "A stream channel has nothing to rebuild."],
      ],
    );
  });

  it("Delete skips nothing; the plan follows list order and only the ticked rows", () => {
    assert.deepEqual(ids(planChannelBulk("delete", ITEMS, ["d", "a"]).runnable), ["a", "d"]);
  });

  it("disable a verb with its reason: nothing ticked, a run going, unreachable, all skipped", () => {
    const none = planChannelBulk("enable", ITEMS, []);
    assert.equal(channelBulkReason("enable", none, 0, OPEN), "Tick a row first");
    const plan = planChannelBulk("enable", ITEMS, ["b"]);
    assert.equal(channelBulkReason("enable", plan, 1, { working: true, unreachable: false }), "Working.");
    assert.equal(channelBulkReason("enable", plan, 1, { working: false, unreachable: true }), "The admin backend cannot be reached.");
    assert.equal(channelBulkReason("enable", plan, 1, OPEN), undefined);
    const enabled = planChannelBulk("enable", ITEMS, ["a", "c"]);
    assert.equal(channelBulkReason("enable", enabled, 2, OPEN), "Every ticked channel is already enabled.");
    const disabled = planChannelBulk("disable", ITEMS, ["b"]);
    assert.equal(channelBulkReason("disable", disabled, 1, OPEN), "Every ticked channel is already disabled.");
    const streams = planChannelBulk("rebuild", ITEMS, ["c"]);
    assert.equal(channelBulkReason("rebuild", streams, 1, OPEN), "A stream channel has nothing to rebuild.");
  });

  it("run through the shared runner: one forced failure keeps the rest, one summary, the work count back to zero", async () => {
    state().channelsLoaded([live("a"), live("b"), live("c")], 1);
    const routes: string[] = [];
    const call = createChannelBulkCall({
      service: {
        update: async () => Promise.reject(new Error("unused")),
        remove: async () => Promise.reject(new Error("unused")),
        rebuild: async (id) => {
          routes.push(id);
          if (id === "b") throw new ApiError("channel.invalid", "A disabled channel is not running; enable it first.", 422);
          return live(id, { state: "preparing" });
        },
      },
      store: () => state(),
    });
    let reread = 0;
    const plan = planChannelBulk("rebuild", state().channels.items, ["a", "b", "c"]);
    const outcome = await createBulkRunner(() => state()).run({
      words: CHANNEL_BULK_WORDS.rebuild,
      area: "Channel",
      plan,
      perform: call("rebuild"),
      finish: () => undefined,
      reread: async () => {
        reread += 1;
      },
    });
    assert.deepEqual(routes, ["a", "b", "c"]);
    assert.deepEqual([ids(outcome?.done ?? []), outcome?.failed.map((row) => row.sentence)], [
      ["a", "c"],
      ["A disabled channel is not running; enable it first."],
    ]);
    assert.equal(state().notice?.sentence, "Rebuilding 2 channels; 1 failed.");
    assert.deepEqual([reread, state().work.syncing], [1, 0]);
    const held = state().channels.items.find((item) => item.id === "a");
    assert.equal(held?.kind === "live" ? held.state : undefined, "preparing");
  });
});
