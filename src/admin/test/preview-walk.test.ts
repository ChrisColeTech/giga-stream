import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DEFAULT_CHANNEL_QUERY, queryKey } from "@/lib/channel-query";
import { walkDirection, type WalkKey } from "@/lib/preview-keys";
import {
  FIRST_REASON,
  LAST_REASON,
  NOT_LISTED_REASON,
  ONLY_REASON,
  placeOf,
  walkReasons,
  walkStep,
} from "@/lib/preview-walk";
import { createChannelReads } from "@/services/channel-reads";
import type { ChannelsService } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { stream } from "./support/channels-kit";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const holds = () => state().channels;
const rows = (ids: readonly string[]): AdminChannel[] => ids.map((id) => stream(id));

/** The list holding these ids as one page, as a read of the current query leaves it. */
function list(ids: readonly string[], page = 0, total = ids.length): void {
  state().channelsPageLoaded(queryKey(holds().query), page, rows(ids), total, 1);
}
const idOf = (step: ReturnType<typeof walkStep>): string | undefined => (step.kind === "to" ? step.row.id : undefined);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the Preview walk", () => {
  it("goes to the neighbours in the list's order, and the order follows the list's query", () => {
    list(["c", "a", "b"]);
    state().channelsOpenPreview("a");
    assert.deepEqual([idOf(walkStep(holds(), -1)), idOf(walkStep(holds(), 1))], ["c", "b"]);
    assert.equal(placeOf(holds()), 1);

    state().channelsSetQuery({ ...DEFAULT_CHANNEL_QUERY, q: "x" });
    list(["b", "a", "c"]);
    state().channelsOpenPreview("a");
    assert.deepEqual([idOf(walkStep(holds(), -1)), idOf(walkStep(holds(), 1))], ["b", "c"]);
  });

  it("disables Previous at the first channel and Next at the last, each with its reason, and never wraps", () => {
    list(["a", "b", "c"]);
    state().channelsOpenPreview("a");
    assert.deepEqual(walkReasons(holds()), { previous: FIRST_REASON, next: undefined });
    assert.equal(walkStep(holds(), -1).kind, "none");
    state().channelsOpenPreview("c");
    assert.deepEqual(walkReasons(holds()), { previous: undefined, next: LAST_REASON });
    assert.equal(walkStep(holds(), 1).kind, "none");
    state().channelsOpenPreview("b");
    assert.deepEqual(walkReasons(holds()), { previous: undefined, next: undefined });
  });

  it("disables both for a list of one channel, and for a channel the list does not hold", () => {
    list(["a"]);
    state().channelsOpenPreview("a");
    assert.deepEqual(walkReasons(holds()), { previous: ONLY_REASON, next: ONLY_REASON });
    state().channelsOpenPreview("elsewhere");
    assert.deepEqual(walkReasons(holds()), { previous: NOT_LISTED_REASON, next: NOT_LISTED_REASON });
    assert.equal(walkStep(holds(), 1).kind, "none");
  });

  it("moves the request value with a new serial and keeps the window's open, so it stays where it is", () => {
    list(["a", "b"]);
    state().channelsOpenPreview("a");
    const first = holds().preview;
    const next = walkStep(holds(), 1);
    assert.ok(next.kind === "to");
    state().channelsStepPreview(next.row, next.at);
    const after = holds().preview;
    assert.deepEqual([after?.channelId, after?.at, after?.channel?.id], ["b", 1, "b"]);
    assert.deepEqual([after?.serial, after?.opened], [(first?.serial ?? 0) + 1, first?.opened]);
    assert.equal(walkReasons(holds()).next, LAST_REASON, "the place follows the step");
    state().channelsOpenPreview("a");
    assert.equal(holds().preview?.opened, holds().preview?.serial, "an open starts a window");
  });

  it("keeps its place when the window's own read drops the list's pages", () => {
    list(["a", "b", "c"]);
    state().channelsOpenPreview("b");
    state().channelsInvalidate();
    assert.deepEqual(holds().items, []);
    assert.equal(placeOf(holds()), 1);
    assert.deepEqual(walkReasons(holds()), { previous: undefined, next: undefined });
    assert.deepEqual(walkStep(holds(), 1), { kind: "read", page: 0, at: 2 });
  });

  it("reads the neighbour's page through the list's own page read at a page edge, then steps onto it", async () => {
    const all = Array.from({ length: 150 }, (_, i) => `c${String(i).padStart(3, "0")}`);
    list(all.slice(0, 100), 0, 150);
    state().channelsOpenPreview("c099");
    assert.equal(walkReasons(holds()).next, undefined, "Next is offered: the list holds more");
    assert.deepEqual(walkStep(holds(), 1), { kind: "read", page: 1, at: 100 });

    const asked: number[] = [];
    const nope = async (): Promise<never> => {
      throw new Error("unexpected call");
    };
    const service: ChannelsService = {
      list: nope, create: nope, update: nope, remove: nope, rebuild: nope, revert: nope, setEnabled: nope, setStatus: nope,
      liveRows: nope,
      page: async (_query, index) => {
        asked.push(index);
        return { items: rows(all.slice(100)), revision: 1, total: 150, offset: 100, unreadable: 0 };
      },
    };
    await createChannelReads({ service, store: () => state() }).readPage(1);
    assert.deepEqual(asked, [1]);
    const step = walkStep(holds(), 1);
    assert.deepEqual([step.kind, idOf(step), step.kind === "to" && step.at], ["to", "c100", 100]);
    assert.equal(walkStep({ ...holds(), pages: { 1: holds().pages[1] ?? [] } }, -1).kind, "read");
  });

  it("counts the loaded rows as the total while the list does not know it", () => {
    list(["a", "b"]);
    state().channelsOpenPreview("a");
    assert.equal(walkReasons({ ...holds(), total: null }).next, undefined);
  });
});

const key = (over: Partial<WalkKey>): WalkKey => ({
  key: "ArrowRight",
  defaultPrevented: false,
  isComposing: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  inField: false,
  ...over,
});

describe("the walk's keys", () => {
  it("walk on ArrowLeft and ArrowRight", () => {
    assert.deepEqual([walkDirection(key({ key: "ArrowLeft" })), walkDirection(key({}))], [-1, 1]);
  });

  it("leave a text field, the video's controls, a handled key, a composition and a chord alone", () => {
    const others: Partial<WalkKey>[] = [{ inField: true }, { defaultPrevented: true }, { isComposing: true }];
    others.push({ shiftKey: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true });
    for (const over of others) assert.equal(walkDirection(key(over)), null, JSON.stringify(over));
    assert.equal(walkDirection(key({ key: "ArrowUp" })), null);
    assert.equal(walkDirection(key({ key: "a" })), null);
  });
});
