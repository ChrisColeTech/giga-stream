// Deleted titles (`37` section 4.4): the service routes, the flows' notices, the bulk Restore through the shared runner
// and the pure plan and words. No server: the backend is a fake fetch.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { createBulkRunner } from "@/services/bulk-run";
import { deletedName, planRestore, RESTORE_WORDS, restoreReason } from "@/lib/title-restore";
import type { AdminDeletedTitle, AdminTitleRow } from "@/services/schemas/title-schema";
import { createTitleFlows } from "@/services/title-flows";
import { createTitleRestoreCall } from "@/services/title-bulk";
import { titles, type TitlesService } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const gone = (id: string, title?: string): AdminDeletedTitle => ({
  id,
  kind: id.startsWith("tv") ? "tv" : "movie",
  tmdbId: Number(id.split("-")[1]),
  ...(title !== undefined && { title }),
  deletedAt: Date.UTC(2026, 9, 17, 12),
});
const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: "movie",
  title: id,
  state: "synced",
  ...extra,
});

function rig(script: Partial<TitlesService> = {}) {
  const calls: string[] = [];
  const service: TitlesService = {
    list: async () => ({ items: [], page: 1, totalPages: 1, totalResults: 0, unreadable: 0 }),
    search: async () => Promise.reject(new Error("unused")),
    detail: async () => Promise.reject(new Error("unused")),
    create: async () => Promise.reject(new Error("unused")),
    update: async () => Promise.reject(new Error("unused")),
    remove: async (id) => (calls.push(`remove:${id}`), { id }),
    revert: async () => Promise.reject(new Error("unused")),
    listDeleted: async () => (calls.push("listDeleted"), [gone("movie-603", "The Matrix")]),
    restore: async (id) => (calls.push(`restore:${id}`), { id }),
    ...script,
  };
  const audit = { reload: async () => undefined };
  return { flows: createTitleFlows({ service, store: () => useAppStore.getState(), audit }), calls };
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the service", () => {
  it("lists the deleted titles with the bearer and restores one by id", async () => {
    await withBackend(
      (call) =>
        call.method === "DELETE"
          ? success({ id: "movie-603" })
          : success({ items: [gone("movie-603", "The Matrix"), gone("tv-1399")] }),
      async (calls) => {
        const list = await titles.listDeleted();
        assert.deepEqual(list.map((one) => [one.id, one.title]), [["movie-603", "The Matrix"], ["tv-1399", undefined]]);
        assert.deepEqual([calls[0]?.url, calls[0]?.headers["authorization"]], ["/api/titles/deleted", "Bearer a"]);
        assert.deepEqual(await titles.restore("movie-603"), { id: "movie-603" });
        assert.deepEqual([calls[1]?.method, calls[1]?.url], ["DELETE", "/api/titles/deleted/movie-603"]);
      },
    );
  });
});

describe("the flows", () => {
  it("load the list, and a restore says what happened and drops the row", async () => {
    const { flows, calls } = rig();
    assert.equal((await flows.loadDeleted()).ok, true);
    assert.deepEqual([state().titles.deleted.status, state().titles.deleted.items.map((one) => one.id)], ["ready", ["movie-603"]]);
    assert.equal((await flows.restore("movie-603")).ok, true);
    assert.equal(state().notice?.sentence, "Restored The Matrix. It returns on the next browse or sync.");
    assert.deepEqual([state().titles.deleted.items, calls.at(-1)], [[], "restore:movie-603"]);
  });

  it("name a title with no kept text by its id", async () => {
    const { flows } = rig({ listDeleted: async () => [gone("tv-1399")] });
    await flows.loadDeleted();
    await flows.restore("tv-1399");
    assert.equal(state().notice?.sentence, "Restored tv-1399. It returns on the next browse or sync.");
  });

  it("a restore that finds nothing says why and reads the list again", async () => {
    const { flows, calls } = rig({
      restore: async () => Promise.reject(new ApiError("title.not_found", "That title does not exist.", 404)),
    });
    await flows.loadDeleted();
    const result = await flows.restore("movie-603");
    assert.deepEqual([result.ok, state().notice?.sentence], [false, "That title does not exist."]);
    assert.equal(calls.filter((call) => call === "listDeleted").length, 2);
  });

  it("deleting a synced title reads the deleted list; deleting one made by hand does not", async () => {
    const { flows, calls } = rig();
    state().titlesLoaded(state().titles.view, {
      items: [row("movie-603"), row("custom-1", { state: "manual" })],
      page: 1,
      totalPages: 1,
      totalResults: 2,
    });
    await flows.remove("custom-1");
    assert.ok(!calls.includes("listDeleted"));
    await flows.remove("movie-603");
    assert.ok(calls.includes("listDeleted"));
  });

  it("Refresh reads the deleted list too", async () => {
    const { flows, calls } = rig();
    await flows.refresh();
    assert.ok(calls.includes("listDeleted"));
  });
});

describe("the bulk Restore", () => {
  const items = [gone("movie-1", "One"), gone("movie-2", "Two"), gone("tv-3")];

  it("plans every ticked row, in list order, named by title or id; nothing is skipped", () => {
    const plan = planRestore(items, ["tv-3", "movie-1"]);
    assert.deepEqual(plan.runnable.map((one) => [one.id, one.label]), [["movie-1", "One"], ["tv-3", "tv-3"]]);
    assert.deepEqual(plan.refused, []);
    assert.equal(deletedName(items[2] as AdminDeletedTitle), "tv-3");
  });

  it("is disabled with the shared reasons", () => {
    assert.equal(restoreReason(0, { busy: false, unreachable: false }), "Tick a row first");
    assert.equal(restoreReason(2, { busy: true, unreachable: false }), "Saving.");
    assert.equal(restoreReason(2, { busy: false, unreachable: true }), "The admin backend cannot be reached.");
    assert.equal(restoreReason(2, { busy: false, unreachable: false }), undefined);
  });

  it("runs one DELETE per row, a failure does not stop the rest, and the summary says they return", async () => {
    state().titlesDeletedLoaded(items);
    state().titlesDeletedTickAll(true);
    const restored: string[] = [];
    const call = createTitleRestoreCall({
      service: {
        restore: async (id) => {
          restored.push(id);
          if (id === "movie-2") throw new ApiError("title.not_found", "That title does not exist.", 404);
          return { id };
        },
      },
      store: () => useAppStore.getState(),
    });
    let rereads = 0;
    await createBulkRunner(() => useAppStore.getState()).run({
      words: RESTORE_WORDS,
      area: "Title",
      plan: planRestore(state().titles.deleted.items, state().titles.deleted.ticked),
      perform: call,
      finish: (outcome) =>
        state().titlesDeletedSetTicked(state().titles.deleted.ticked.filter((id) => !outcome.done.some((d) => d.id === id))),
      reread: async () => void (rereads += 1),
    });
    assert.deepEqual(restored, ["movie-1", "movie-2", "tv-3"]);
    assert.equal(state().notice?.sentence, "Restored 2 titles; they return on the next browse or sync; 1 failed.");
    const left = state().titles.deleted;
    assert.deepEqual([rereads, left.ticked, left.items.map((one) => one.id)], [1, ["movie-2"], ["movie-2"]]);
  });
});
