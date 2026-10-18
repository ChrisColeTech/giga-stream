import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { workView } from "@/lib/running-work";
import { createJobFlows } from "@/services/job-flows";
import type { JobsService } from "@/services/jobs";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob => ({
  id,
  name: `Job ${id}`,
  type: "catalog",
  enabled: true,
  schedule: "6h",
  config: { scope: "trending", kind: "movie", pages: 5 },
  running: false,
  createdAt: 1,
  ...extra,
});

function flowsWith(script: Partial<JobsService> = {}) {
  const service: JobsService = {
    list: async () => ({ items: [job(1, { running: true }), job(2), job(3, { running: true })], unreadable: 0 }),
    create: async () => job(9, { running: false }),
    update: async (id, patch) => job(id, { enabled: patch["enabled"] !== false }),
    remove: async (id) => ({ id }),
    run: async (id) => job(id, { running: true }),
    ...script,
  };
  return createJobFlows({
    service,
    playlists: { list: async () => ({ items: [], unreadable: 0 }) },
    store: () => state(),
    audit: { reload: async () => undefined },
  });
}
const syncing = (): number => state().work.syncing;

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the jobs slice and the statusbar's N syncing", () => {
  it("counts the running rows after a load, and the statusbar reads `2 syncing` over the pulsing bar", async () => {
    await flowsWith().load();
    assert.equal(syncing(), 2);
    assert.deepEqual([workView(state().work).readout, workView(state().work).stopReason], [
      "2 syncing",
      "A sync cannot be cancelled.",
    ]);
  });

  it("follows every write: a catalog run started, a refresh that reads it finished, a running job deleted", async () => {
    const flows = flowsWith({ list: async () => ({ items: [job(1), job(2)], unreadable: 0 }) });
    await flows.load();
    assert.equal(syncing(), 0);
    await flows.run(2);
    assert.deepEqual([syncing(), state().notice?.sentence], [1, "Started Job 2."]);
    await flows.refresh();
    assert.equal(syncing(), 0, "a Refresh that reads running: false ends the count; nothing polls");
    await flows.run(1);
    await flows.remove(1);
    assert.equal(syncing(), 0);
  });

  it("keeps the count when a run is refused, and re-reads the list for the kept outcome", async () => {
    let reads = 0;
    const flows = flowsWith({
      list: async () => (reads++, { items: [job(1)], unreadable: 0 }),
      run: async () => Promise.reject(new ApiError("tmdb.unavailable", "TMDB cannot be reached.", 503)),
    });
    await flows.load();
    const result = await flows.run(1);
    assert.deepEqual([result.ok, !result.ok && result.field], [false, "run"]);
    assert.equal(state().notice?.sentence, "TMDB cannot be reached.");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reads, 2);
  });

  it("holds the playlists for the select, and keeps the last list when that read fails", async () => {
    state().jobsPlaylistsLoaded([{ id: 1, name: "L", host: "h", masked: "h/…", enabled: true, channels: 0 }]);
    state().jobsPlaylistsLoaded(null);
    assert.deepEqual([state().jobs.playlists.length, state().jobs.playlistsStatus], [1, "failed"]);
  });

  it("is reset for a new session: rows, ticks and the session's serial", async () => {
    await flowsWith().load();
    state().jobTick(1, true);
    state().jobsReset(5);
    const { items, ticked, status, session } = state().jobs;
    assert.deepEqual([items, ticked, status, session], [[], [], "idle", 5]);
  });

  it("ticks, prunes a gone row's tick and selects all", () => {
    state().jobsLoaded([job(1), job(2)]);
    state().jobsTickAll(true);
    assert.deepEqual(state().jobs.ticked, [1, 2]);
    state().jobRemove(1);
    assert.deepEqual(state().jobs.ticked, [2]);
    state().jobsSetTicked([]);
    assert.deepEqual(state().jobs.ticked, []);
  });
});
