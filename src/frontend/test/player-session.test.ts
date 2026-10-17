import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAYER_TAB_LIMIT } from "@/lib/player-copy";
import { createPlayerSession, reducePlayerSession, tabFromItem, type PlayerSession } from "@/lib/player-session";
import { viewOf } from "@/lib/player-view";
import type { LibraryItem } from "@/types/library";
import type { PlayerTab } from "@/types/player";

const tab = (n: number): PlayerTab => ({
  id: `tab-${n}`,
  ref: { kind: "title", id: `movie-${n}` },
  kind: "movie",
  title: `Film ${n}`,
});

function start(count: number, active = 1): PlayerSession {
  const tabs = Array.from({ length: count }, (_, index) => tab(index + 1));
  return createPlayerSession(tabs, `tab-${active}`, {});
}

describe("opening tabs", () => {
  it("opening a title that already has a tab activates that tab and adds none", () => {
    const session = start(3, 1);
    const next = reducePlayerSession(session, { type: "open", tab: tab(2) });
    assert.equal(next.tabs.length, 3);
    assert.equal(next.activeId, "tab-2");
  });

  it("opening a new title adds it and makes it active", () => {
    const next = reducePlayerSession(start(2), { type: "open", tab: tab(9) });
    assert.deepEqual(
      next.tabs.map((entry) => entry.id),
      ["tab-1", "tab-2", "tab-9"],
    );
    assert.equal(next.activeId, "tab-9");
  });

  it("a thirteenth tab closes the least recently used inactive tab, never the active one", () => {
    let session = start(PLAYER_TAB_LIMIT, 1);
    /* Touch every tab except tab-3, so tab-3 is the least recently used inactive one. */
    for (const id of ["tab-2", "tab-4", "tab-5", "tab-6", "tab-7", "tab-8", "tab-9", "tab-10", "tab-11", "tab-12"]) {
      session = reducePlayerSession(session, { type: "activate", id });
    }
    session = reducePlayerSession(session, { type: "activate", id: "tab-1" });
    const next = reducePlayerSession(session, { type: "open", tab: tab(99) });
    assert.equal(next.tabs.length, PLAYER_TAB_LIMIT);
    assert.equal(next.tabs.some((entry) => entry.id === "tab-3"), false);
    assert.equal(next.tabs.some((entry) => entry.id === "tab-1"), true);
    assert.equal(next.activeId, "tab-99");
  });

  it("the open tab cannot exceed the limit", () => {
    let session = start(PLAYER_TAB_LIMIT, 1);
    for (let n = 100; n < 110; n += 1) {
      session = reducePlayerSession(session, { type: "open", tab: tab(n) });
    }
    assert.equal(session.tabs.length, PLAYER_TAB_LIMIT);
  });

  it("a related item opens the tab its reference names", () => {
    const item: LibraryItem = { ref: { kind: "title", id: "movie-7" }, kind: "movie", title: "Seven", genres: [], favorite: false };
    const next = reducePlayerSession(start(1), { type: "open", tab: tabFromItem(item) });
    assert.equal(next.tabs.at(-1)?.title, "Seven");
    assert.equal(next.tabs.at(-1)?.id, "tab-movie-7");
  });
});

describe("closing tabs", () => {
  it("closing the active tab activates the one that took its place", () => {
    const next = reducePlayerSession(start(3, 2), { type: "close", id: "tab-2" });
    assert.deepEqual(
      next.tabs.map((entry) => entry.id),
      ["tab-1", "tab-3"],
    );
    assert.equal(next.activeId, "tab-3");
  });

  it("closing the last tab in the strip activates the one before it", () => {
    const next = reducePlayerSession(start(3, 3), { type: "close", id: "tab-3" });
    assert.equal(next.activeId, "tab-2");
  });

  it("closing the only tab leaves no active tab", () => {
    const next = reducePlayerSession(start(1, 1), { type: "close", id: "tab-1" });
    assert.equal(next.tabs.length, 0);
    assert.equal(next.activeId, null);
    assert.equal(viewOf(next).tab, undefined);
  });

  it("closing an inactive tab keeps the active one", () => {
    const next = reducePlayerSession(start(3, 2), { type: "close", id: "tab-1" });
    assert.equal(next.activeId, "tab-2");
  });

  it("close others keeps only the named tab and activates it", () => {
    const next = reducePlayerSession(start(3, 1), { type: "closeOthers", id: "tab-3" });
    assert.deepEqual(
      next.tabs.map((entry) => entry.id),
      ["tab-3"],
    );
    assert.equal(next.activeId, "tab-3");
  });
});

describe("episode and season choices", () => {
  it("choosing an episode rewrites the tab subtitle and shows the season", () => {
    const next = reducePlayerSession(start(1), { type: "episode", id: "tab-1", season: 2, episode: 4 });
    assert.equal(next.tabs[0]?.subtitle, "S02 E04");
    assert.equal(next.seasonByTab["tab-1"], 2);
  });

  it("changing the season alone changes no tab and no active tab", () => {
    const session = start(2, 1);
    const next = reducePlayerSession(session, { type: "season", id: "tab-2", season: 3 });
    assert.equal(next.tabs[1]?.subtitle, undefined);
    assert.equal(next.activeId, "tab-1");
    assert.equal(next.seasonByTab["tab-2"], 3);
  });
});

describe("local favourites and membership", () => {
  it("a favourite change is held per item", () => {
    const next = reducePlayerSession(start(1), { type: "favorite", itemId: "movie-1", value: true });
    assert.equal(next.favorites["movie-1"], true);
  });

  it("toggling membership adds, then removes, the collection", () => {
    const added = reducePlayerSession(start(1), { type: "toggleMember", itemId: "movie-1", collectionId: "c-a" });
    assert.deepEqual(added.membership["movie-1"], ["c-a"]);
    const removed = reducePlayerSession(added, { type: "toggleMember", itemId: "movie-1", collectionId: "c-a" });
    assert.deepEqual(removed.membership["movie-1"], []);
  });

  it("the related band folds and unfolds", () => {
    const folded = reducePlayerSession(start(1), { type: "toggleRelated" });
    assert.equal(folded.relatedFolded, true);
    assert.equal(reducePlayerSession(folded, { type: "toggleRelated" }).relatedFolded, false);
  });
});
