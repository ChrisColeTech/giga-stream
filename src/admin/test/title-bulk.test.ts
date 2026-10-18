import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { planTitleBulk, syncedCount, titleBulkReason, titleBulkWords } from "@/lib/title-bulk";
import { START_VIEW } from "@/lib/title-query";
import { createBulkRunner } from "@/services/bulk-run";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { createTitleBulkCall } from "@/services/title-bulk";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: "movie",
  title: id,
  state: "synced",
  enabled: true,
  ...extra,
});
const MANUAL = row("custom-1", { state: "manual" });
const SYNCED = row("movie-1");
const EDITED = row("movie-2", { state: "edited", editedFields: ["plot"] });
const OFF = row("movie-3", { enabled: false });
const LIST = [MANUAL, SYNCED, EDITED, OFF];
const ALL = LIST.map((one) => one.id);
const IDLE = { busy: false, unreachable: false };
const ids = (plan: { runnable: ReadonlyArray<{ id: string }> }): string[] => plan.runnable.map((item) => item.id);

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the titles plan over mixed rows", () => {
  it("Enable and Disable skip what is already in that state", () => {
    const enable = planTitleBulk("enable", LIST, ALL);
    assert.deepEqual([ids(enable), enable.refused[0]?.reason], [["movie-3"], "Already enabled."]);
    const disable = planTitleBulk("disable", LIST, ALL);
    const expected = [["custom-1", "movie-1", "movie-2"], "Already disabled."];
    assert.deepEqual([ids(disable), disable.refused[0]?.reason], expected);
  });

  it("Revert skips a manual title and an unedited synced one, with their reasons", () => {
    const plan = planTitleBulk("revert", LIST, ALL);
    assert.deepEqual(ids(plan), ["movie-2"]);
    assert.deepEqual(plan.refused.map((r) => r.reason), [
      "A title made by hand has no TMDB copy to go back to.",
      "Nothing was edited.",
      "Nothing was edited.",
    ]);
    const none = planTitleBulk("revert", LIST, ["custom-1"]);
    assert.equal(titleBulkReason(none, 1, IDLE), "A title made by hand has no TMDB copy to go back to.");
  });

  it("Delete runs on manual and synced titles alike and counts the synced ones", () => {
    const plan = planTitleBulk("delete", LIST, ALL);
    assert.deepEqual([ids(plan), plan.refused.length, syncedCount(plan, LIST)], [ALL, 0, 3]);
  });

  it("disables a verb until a row is ticked", () => {
    assert.equal(titleBulkReason(planTitleBulk("delete", LIST, []), 0, IDLE), "Tick a row first");
    assert.equal(titleBulkReason(planTitleBulk("delete", LIST, ALL), 4, { busy: true, unreachable: false }), "Saving.");
  });
});

describe("a Delete run through the shared runner", () => {
  it("one DELETE per row, one failure does not stop the rest, the summary says the synced ones stay deleted", async () => {
    state().titlesLoaded(START_VIEW, { items: LIST, page: 1, totalPages: 1, totalResults: 4 });
    state().titlesTickAll(true);
    const removed: string[] = [];
    const call = createTitleBulkCall({
      service: {
        remove: async (id) => {
          removed.push(id);
          if (id === "movie-2") throw new ApiError("title.not_found", "That title does not exist.", 404);
          return { id };
        },
        update: async () => Promise.reject(new Error("unused")),
        revert: async () => Promise.reject(new Error("unused")),
      },
      store: () => useAppStore.getState(),
    });
    const plan = planTitleBulk("delete", state().titles.items, state().titles.ticked);
    let rereads = 0;
    await createBulkRunner(() => useAppStore.getState()).run({
      words: titleBulkWords("delete", syncedCount(plan, state().titles.items)),
      area: "Title",
      plan,
      perform: call("delete"),
      finish: (outcome) =>
        state().titlesSetTicked(state().titles.ticked.filter((id) => !outcome.done.some((d) => d.id === id))),
      reread: async () => void (rereads += 1),
    });
    assert.deepEqual(removed, ALL);
    assert.equal(
      state().notice?.sentence,
      "Deleted 3 titles; 3 were synced and stay deleted until restored under Deleted titles; 1 failed.",
    );
    const left = state().titles.items.map((t) => t.id);
    assert.deepEqual([rereads, state().titles.ticked, left], [1, ["movie-2"], ["movie-2"]]);
  });

  it("words a delete with no synced title plainly, and one synced title in the singular", () => {
    assert.deepEqual(titleBulkWords("delete", 0), { past: "Deleted", noun: "title", nouns: "titles" });
    assert.match(titleBulkWords("delete", 1).nouns, /; 1 was synced and stays deleted until restored under Deleted titles$/);
  });
});
