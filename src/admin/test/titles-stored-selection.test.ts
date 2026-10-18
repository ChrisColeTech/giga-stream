import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { loadedState, matchingOffer, selectedCount } from "@giga/ui/lib/list-selection";
import { planTitleBulk } from "@/lib/title-bulk";
import { loadedRows } from "@/lib/title-paged";
import { START_STORED } from "@/lib/title-stored-query";
import { NO_CATALOG_JOB, SYNC_RUNNING, enabledCatalogJobs, syncPlan, syncReason } from "@/lib/title-sync";
import type { AdminJob } from "@/services/schemas/job-schema";
import { createTitleBulkCall } from "@/services/title-bulk";
import { createTitleFlows } from "@/services/title-flows";
import { resolveMatching } from "@/services/title-resolve";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";
import { fakeStored, serviceOf, titleRowOf } from "./support/titles-stored-kit";

const state = () => useAppStore.getState();
const stored = () => state().titlesStored;
const ids = (): string[] => {
  const selection = stored().selection;
  return selection.mode === "ids" ? [...selection.ids].sort() : [];
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  resetStore();
  signInForTest();
  state().titlesReset(state().serial);
});

describe("selection across pages", () => {
  it("keeps the ticks of a page that was left, counts them, and the All box ticks the rows loaded", async () => {
    const fake = fakeStored(250);
    const flows = createTitleFlows({ service: serviceOf({ listStored: fake.listStored }), store: () => state(), audit: { reload: async () => undefined } });
    await flows.loadStored();
    state().storedTick(titleRowOf("movie-1"), true);
    flows.needRange(200, 249);
    await tick();
    state().storedTick(titleRowOf("movie-205"), true);
    assert.deepEqual(ids(), ["movie-1", "movie-205"]);
    assert.equal(selectedCount(stored().selection, 250), 2);
    assert.equal(Object.keys(stored().picked).length, 2, "the ticked rows are kept as they were seen");

    state().storedTickLoaded(true);
    const loaded = loadedRows(stored().paged).map((row) => row.id);
    assert.equal(loadedState(stored().selection, loaded), true);
    assert.equal(ids().length, 150, "the other ticks stay, the loaded rows join them");
    assert.equal(matchingOffer(stored().selection, loaded, 250), 250, "Select all 250 matching stands");

    state().storedSelectAllMatching();
    assert.equal(selectedCount(stored().selection, 250), 250);
    state().storedTick(titleRowOf("movie-7"), false);
    assert.equal(selectedCount(stored().selection, 250), 249, "an unticked row is an exception");
  });

  it("returns an all-matching selection to nothing when the query changes, and keeps ids ticks", async () => {
    const fake = fakeStored(30);
    const flows = createTitleFlows({ service: serviceOf({ listStored: fake.listStored }), store: () => state(), audit: { reload: async () => undefined } });
    await flows.loadStored();
    state().storedSelectAllMatching();
    await flows.changeStored((query) => ({ ...query, kind: "movie" }));
    assert.deepEqual([stored().selection.mode, ids()], ["ids", []]);
    state().storedTick(titleRowOf("movie-2"), true);
    await flows.changeStored((query) => ({ ...query, kind: "tv" }));
    assert.deepEqual(ids(), ["movie-2"]);
  });

  it("plans a bulk verb over ticked rows that are no longer loaded, with the shared rules", () => {
    state().storedTick(titleRowOf("movie-1", { state: "manual" }), true);
    state().storedTick(titleRowOf("movie-900", { enabled: false }), true);
    const rows = Object.values(stored().picked);
    const enable = planTitleBulk("enable", rows, ids());
    assert.deepEqual(enable.runnable.map((item) => item.id), ["movie-900"]);
    assert.deepEqual(enable.refused.map((item) => item.id), ["movie-1"]);
    assert.equal(planTitleBulk("revert", rows, ids()).refused.length, 2, "a manual title and an unedited synced one");
    assert.equal(planTitleBulk("delete", rows, ids()).runnable.length, 2, "Delete runs on manual and synced alike");
  });

  it("a deleted row leaves the ticks and the total falls by one", async () => {
    const fake = fakeStored(5);
    const flows = createTitleFlows({ service: serviceOf({ listStored: fake.listStored }), store: () => state(), audit: { reload: async () => undefined } });
    await flows.loadStored();
    state().storedTick(titleRowOf("movie-1"), true);
    const call = createTitleBulkCall({ service: serviceOf({}), store: () => state() })("delete");
    assert.equal(await call({ id: "movie-1", label: "T movie-1" }), null);
    assert.deepEqual([ids(), stored().paged.total], [[], 4]);
  });
});

describe("select all matching resolves the whole result", () => {
  it("reads the pages at limit 200 in order and drops the unticked rows", async () => {
    const fake = fakeStored(450);
    const rows = await resolveMatching(serviceOf({ listStored: fake.listStored }), START_STORED, new Set(["movie-3", "movie-444"]));
    assert.deepEqual(fake.calls.map((call) => [call.offset, call.limit]), [[0, 200], [200, 200], [400, 200]]);
    assert.equal(rows.length, 448);
    assert.ok(!rows.some((row) => row.id === "movie-3" || row.id === "movie-444"));
  });

  it("stops when the session ended and keeps the query it was asked for", async () => {
    const fake = fakeStored(450);
    let pages = 0;
    const rows = await resolveMatching(serviceOf({ listStored: fake.listStored }), { ...START_STORED, kind: "tv" }, new Set(), () => pages++ < 1);
    assert.equal(rows.length, 200);
    assert.equal(fake.calls[0]?.query.kind, "tv");
  });
});

const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob => ({
  id,
  name: `Job ${id}`,
  type: "catalog",
  enabled: true,
  schedule: "24h",
  config: { scope: "trending", kind: "movie", pages: 5 },
  running: false,
  createdAt: 1,
  ...extra,
});

describe("Sync now", () => {
  const idle = { jobs: null, syncing: 0, busy: false, unreachable: false };

  it("runs the enabled catalog jobs only, named as the Jobs tab names them", () => {
    const jobs = [job(1), job(2, { enabled: false }), job(3, { type: "playlist", config: { playlistId: 1, dryRun: false, prune: false } })];
    assert.deepEqual(enabledCatalogJobs(jobs).map((one) => one.id), [1]);
    assert.deepEqual(syncPlan(jobs).runnable, [{ id: 1, label: "Job 1" }]);
  });

  it("gives its reason in priority order: unreachable, a run going, then no enabled catalog job", () => {
    assert.equal(syncReason(idle), undefined, "the Jobs list is read at the press when unknown");
    assert.equal(syncReason({ ...idle, jobs: [job(1, { enabled: false })] }), NO_CATALOG_JOB);
    assert.equal(syncReason({ ...idle, jobs: [job(1, { running: true })] }), SYNC_RUNNING);
    assert.equal(syncReason({ ...idle, syncing: 1 }), SYNC_RUNNING);
    assert.equal(syncReason({ ...idle, busy: true, jobs: [] }), SYNC_RUNNING, "running outranks no job");
    assert.match(syncReason({ ...idle, unreachable: true, busy: true }) ?? "", /cannot be reached/);
  });
});
