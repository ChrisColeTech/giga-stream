import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { START_VIEW, withSort } from "@/lib/title-query";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const row = (id: string, extra: Partial<AdminTitleRow> = {}): AdminTitleRow => ({
  id,
  kind: "movie",
  title: id,
  state: "synced",
  ...extra,
});
const page = (items: AdminTitleRow[], totalPages = 3) => ({ items, page: 1, totalPages, totalResults: items.length });

beforeEach(() => resetStore());

describe("the titles slice", () => {
  it("starts on page 1 with both kinds, Newest, idle", () => {
    assert.deepEqual([state().titles.status, state().titles.view], ["idle", START_VIEW]);
  });

  it("loads a page for a view and keeps the ticks of rows still on it", () => {
    state().titlesLoaded(START_VIEW, page([row("a"), row("b")]));
    state().titleTick("a", true);
    state().titleTick("b", true);
    const next = withSort(START_VIEW, "az");
    state().titlesSetView(next);
    state().titlesLoaded(next, page([row("b"), row("c")], 5));
    assert.deepEqual([state().titles.ticked, state().titles.totalPages, state().titles.shown], [["b"], 5, next]);
  });

  it("a failed read of another view shows the skeleton; of the shown view keeps the rows", () => {
    state().titlesLoaded(START_VIEW, page([row("a")]));
    state().titlesLoadFailed(START_VIEW, false);
    assert.deepEqual([state().titles.status, state().titles.items.length], ["failed", 1]);
    state().titlesLoadFailed(withSort(START_VIEW, "oldest"), true);
    assert.deepEqual([state().titles.items.length, state().titles.unreachable], [0, true]);
  });

  it("upserts in place or at the top, removes, ticks all", () => {
    state().titlesLoaded(START_VIEW, page([row("a"), row("b")]));
    state().titleUpsert(row("b", { title: "B2" }));
    state().titleUpsert(row("custom-1", { state: "manual" }));
    assert.deepEqual(state().titles.items.map((t) => t.title), ["custom-1", "a", "B2"]);
    state().titlesTickAll(true);
    state().titleRemove("a");
    const a = state().titles.items.find((t) => t.id === "a");
    assert.deepEqual([a?.deleted, a?.stored], [true, false], "a synced title's Browse row stays, reading deleted");
    state().titleRemove("custom-1");
    assert.deepEqual(state().titles.items.map((t) => t.id), ["a", "b"], "a hand-made title has no TMDB row");
    assert.deepEqual(state().titles.ticked, ["a", "b"]);
  });

  it("keeps a detail only for the workspace that asked", () => {
    state().titleDetailStart("movie-1");
    state().titleDetailLoaded({ ...row("movie-2"), plot: "x" });
    assert.equal(state().titles.detail?.value, null);
    state().titleDetailLoaded({ ...row("movie-1"), plot: "y" });
    assert.deepEqual([state().titles.detail?.status, state().titles.detail?.value?.plot], ["ready", "y"]);
    state().titleDetailFailed("movie-1");
    assert.equal(state().titles.detail?.status, "failed");
  });

  it("resets for a new session", () => {
    state().titlesLoaded(START_VIEW, page([row("a")]));
    state().titlesReset(3);
    assert.deepEqual([state().titles.items, state().titles.session, state().titles.view], [[], 3, START_VIEW]);
    assert.equal(state().titles.preview, null);
  });

  it("takes the preview window's request value, raising the serial at every open, and clears it on close", () => {
    state().titlesOpenPreview("movie-1");
    assert.deepEqual(state().titles.preview, { titleId: "movie-1", serial: 1, opened: 1 });
    state().titlesOpenPreview("tv-2");
    assert.deepEqual(state().titles.preview, { titleId: "tv-2", serial: 2, opened: 2 });
    state().titlesClosePreview();
    assert.equal(state().titles.preview, null);
  });
});
