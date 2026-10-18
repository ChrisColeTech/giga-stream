import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { TOO_MANY_TO_SWITCH } from "@/constants/channel-copy";
import { bulkCountsSummary } from "@/lib/bulk-plan";
import { CHANNEL_SWITCH_MAX, overSwitchLimit, planChannelBulk } from "@/lib/channel-bulk";
import { heldTicked } from "@/lib/channel-list";
import { createChannelSwitch } from "@/services/channel-switch";
import { channels } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { live, stream } from "./support/channels-kit";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const OFF = stream("e", { enabled: false });
const ROWS = [stream("a"), stream("b"), stream("c"), OFF, live("l")];

beforeEach(() => {
  resetStore();
  signInForTest();
});

function tick(rows: readonly AdminChannel[]): void {
  state().channelsTickRows(rows);
}

/** The plan the Channels strip builds: over the rows the tab holds whole for the ticked ids. */
const planOf = (verb: "enable" | "disable", ids: readonly string[]) =>
  planChannelBulk(verb, heldTicked(state().channels.held, ids), ids);

function harness(over: Partial<Parameters<typeof createChannelSwitch>[0]["service"]> = {}) {
  const asked: Array<{ ids: readonly string[]; enabled: boolean }> = [];
  const singles: string[] = [];
  let reread = 0;
  const run = createChannelSwitch({
    service: {
      setEnabled: async (ids, enabled) => {
        asked.push({ ids, enabled });
        return { changed: 2, unchanged: 1, skipped: 0 };
      },
      update: async (id, patch) => {
        singles.push(id);
        return live(id, { enabled: patch.enabled === true });
      },
      ...over,
    },
    store: () => state(),
    reread: async () => {
      reread += 1;
    },
  });
  return { run, asked, singles, rereads: () => reread };
}

describe("PATCH /api/channels from the service", () => {
  it("sends { enabled, ids } once and reads { changed, unchanged, skipped }", async () => {
    await withBackend(
      () => success({ changed: 3, unchanged: 1, skipped: 2 }),
      async (calls) => {
        const answer = await channels.setEnabled(["a", "b"], false);
        assert.deepEqual([calls.length, calls[0]?.method, calls[0]?.url], [1, "PATCH", "/api/channels"]);
        assert.deepEqual(calls[0]?.body, { enabled: false, ids: ["a", "b"] });
        assert.deepEqual(answer, { changed: 3, unchanged: 1, skipped: 2 });
      },
    );
  });

  it("carries a refusal and answers bad_response for an answer it cannot read", async () => {
    await withBackend(
      () => json({ ok: false, error: { code: "channel.invalid", message: "ids" } }, 422),
      async () => assert.rejects(channels.setEnabled(["a"], true), { code: "channel.invalid", status: 422 }),
    );
    await withBackend(
      () => success({ nope: 1 }),
      async () => assert.rejects(channels.setEnabled(["a"], true), { code: "backend.bad_response" }),
    );
  });
});

describe("Disable and Enable as one call", () => {
  it("send every runnable stream row in ONE call, the live row on its own, and say one summary with the skips", async () => {
    tick(ROWS);
    const { run, asked, singles, rereads } = harness();
    await run(false, planOf("disable", state().channels.ticked));
    assert.deepEqual(asked, [{ ids: ["a", "b", "c"], enabled: false }]);
    assert.deepEqual(singles, ["l"]);
    /* 2 changed in the call + the live row; 1 unchanged in the call + the row that was already disabled. */
    assert.equal(state().events.at(-1)?.sentence, "Disabled 3 channels; 2 skipped.");
    assert.deepEqual(state().channels.ticked, ["e"], "the finished rows are unticked; the skipped one stays");
    assert.deepEqual([rereads(), state().work.syncing], [1, 0]);
  });

  it("make no live call when only stream rows are ticked, and no call at all when nothing can run", async () => {
    tick([stream("a"), stream("b")]);
    const first = harness();
    await first.run(true, planOf("enable", ["a", "b"]));
    assert.deepEqual([first.asked.length, first.singles.length], [0, 0], "a and b are enabled: the plan refuses both");
    assert.equal(state().events.at(-1)?.sentence, "Enabled 0 channels; 2 skipped.");
    assert.equal(first.rereads(), 0);

    state().channelsTickAll(false);
    tick([stream("a", { enabled: false }), stream("b", { enabled: false })]);
    const none = harness();
    await none.run(true, planOf("enable", ["a", "b"]));
    assert.deepEqual([none.asked.length, none.singles.length], [1, 0]);
    assert.deepEqual(none.asked[0], { ids: ["a", "b"], enabled: true });
    assert.equal(none.rereads(), 1);
    assert.equal(state().events.at(-1)?.sentence, "Enabled 2 channels; 1 skipped.");
  });

  it("report a refused call as failed rows, keep them ticked, and mark an unreachable backend", async () => {
    tick([stream("a"), stream("b")]);
    const { run, rereads } = harness({
      setEnabled: async () => {
        throw new ApiError("backend.unreachable", "The admin backend cannot be reached.", 0);
      },
    });
    await run(false, planOf("disable", ["a", "b"]));
    assert.equal(state().notice?.sentence, "Disabled 0 channels; 2 failed.");
    assert.equal(state().notice?.tone, "warn");
    assert.deepEqual(state().channels.ticked, ["a", "b"]);
    assert.equal(state().channels.unreachable, true);
    assert.equal(rereads(), 1);
  });

  it("stay silent when the session ended under the call", async () => {
    tick([stream("a")]);
    const { run } = harness({
      setEnabled: async () => {
        state().signOut();
        return { changed: 1, unchanged: 0, skipped: 0 };
      },
    });
    await run(false, planOf("disable", ["a"]));
    assert.equal(state().notice?.sentence, undefined);
  });
});

describe("the 5,000 id limit", () => {
  it("is exceeded only by stream rows (no client chunking): the verb is disabled with its reason", () => {
    const rows = Array.from({ length: CHANNEL_SWITCH_MAX + 1 }, (_, i) => stream(`s${i}`));
    const ids = rows.map((row) => row.id);
    assert.equal(overSwitchLimit(planChannelBulk("disable", rows, ids), rows), true);
    assert.equal(overSwitchLimit(planChannelBulk("disable", rows.slice(1), ids.slice(1)), rows), false);
    const lives = Array.from({ length: CHANNEL_SWITCH_MAX + 1 }, (_, i) => live(`l${i}`));
    assert.equal(overSwitchLimit(planChannelBulk("disable", lives, lives.map((row) => row.id)), lives), false);
    assert.equal(TOO_MANY_TO_SWITCH, "Tick at most 5,000 channels to enable or disable.");
  });

  it("words a counted run like the runner does, with thousands separated", () => {
    const words = { past: "Disabled", noun: "channel", nouns: "channels" };
    assert.equal(bulkCountsSummary(words, { done: 4800, failed: 0, skipped: 200 }).sentence, "Disabled 4,800 channels; 200 skipped.");
    assert.equal(bulkCountsSummary(words, { done: 1, failed: 0, skipped: 0 }).sentence, "Disabled 1 channel.");
  });
});
