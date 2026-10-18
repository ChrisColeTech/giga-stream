import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { previewChannel } from "@/lib/channel-list";
import { queryKey } from "@/lib/channel-query";
import { createPreviewSession } from "@/lib/preview-session";
import { createChannelReads } from "@/services/channel-reads";
import type { ChannelsService } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { stream } from "./support/channels-kit";
import { resetStore, signInForTest } from "./support/store";

/* The Preview reads ONE channel (`36` section 8.2): never the list, never a replaced slice, never dropped pages. */

const state = () => useAppStore.getState();

/** A service that counts every route the Preview could touch; only `readOne` answers. */
function counting(answer: (id: string) => Promise<AdminChannel>) {
  const calls = { list: 0, page: 0, liveRows: 0, readOne: [] as string[] };
  const nope = async (): Promise<never> => {
    throw new Error("unexpected call");
  };
  const service: ChannelsService = {
    create: nope, update: nope, remove: nope, rebuild: nope, revert: nope, setEnabled: nope, setStatus: nope,
    list: async () => {
      calls.list += 1;
      return nope();
    },
    page: async () => {
      calls.page += 1;
      return nope();
    },
    liveRows: async () => {
      calls.liveRows += 1;
      return nope();
    },
    readOne: async (id) => {
      calls.readOne.push(id);
      return answer(id);
    },
  };
  return { service, calls };
}

/** The window's session as the hook builds it, over the reads. */
function session(service: ChannelsService, id: string) {
  const reads = createChannelReads({ service, store: () => state() });
  return createPreviewSession(() => reads.readOne(id), () => undefined);
}

const rows = (ids: readonly string[]): AdminChannel[] => ids.map((id) => stream(id));

beforeEach(() => {
  resetStore();
  signInForTest();
  state().channelsPageLoaded(queryKey(state().channels.query), 0, rows(["a", "b", "c"]), 500, 1);
  state().channelsOpenPreview("b");
});

describe("the Preview's one-channel reads", () => {
  it("reads exactly one channel on open and one on each Retry, never the list, and the pages survive", async () => {
    const { service, calls } = counting(async (id) => stream(id, { name: "Fresh" }));
    const opened = session(service, "b");
    await opened.open();
    await opened.retry();
    await opened.retry();
    assert.deepEqual(calls.readOne, ["b", "b", "b"]);
    assert.deepEqual([calls.list, calls.page, calls.liveRows], [0, 0, 0], "the list routes are never called");
    assert.deepEqual(state().channels.items.map((row) => row.id), ["a", "b", "c"], "the loaded pages stay");
    assert.equal(state().channels.items[1]?.name, "Fresh", "the one row is replaced by id");
    assert.equal(state().channels.total, 500);
  });

  it("keeps a row the list does not hold as the window's own copy, without dropping any page", async () => {
    state().channelsOpenPreview("far");
    const { service } = counting(async (id) => stream(id, { name: "Far away" }));
    await session(service, "far").open();
    assert.equal(previewChannel(state().channels, "far")?.name, "Far away");
    assert.deepEqual(state().channels.items.map((row) => row.id), ["a", "b", "c"]);
    assert.equal(state().channels.total, 500, "the list's total did not move");
  });

  it("says `missing` for a channel the backend does not know, once, and leaves the other pages", async () => {
    const { service } = counting(async () =>
      Promise.reject(new ApiError("channel.not_found", "That channel does not exist.", 404)),
    );
    const result = await createChannelReads({ service, store: () => state() }).readOne("b");
    assert.equal(result.ok, false);
    assert.equal(previewChannel(state().channels, "b"), undefined);
    assert.equal(state().notice, null, "the window's own line says it, so the read says nothing");
    assert.deepEqual(state().channels.items.map((row) => row.id), ["a", "c"]);
  });

  it("marks the backend unreachable and says so once on a transport failure, keeping the held row", async () => {
    const down = new ApiError("backend.unreachable", "The admin backend cannot be reached.", 0);
    const { service } = counting(async () => Promise.reject(down));
    await createChannelReads({ service, store: () => state() }).readOne("b");
    assert.equal(state().channels.unreachable, true);
    assert.equal(previewChannel(state().channels, "b")?.id, "b");
  });
});
