import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPlayerSession, itemFromLibrary, reducePlayerSession, type PlayerSession } from "@/lib/player-session";
import { viewOf } from "@/lib/player-view";
import type { LibraryItem } from "@/types/library";
import type { PlayerTab } from "@/types/player";

const item = (id: string, kind: "movie" | "tv" | "local" = "movie"): PlayerTab => ({
  id,
  ref: { kind: kind === "local" ? "local" : "title", id },
  kind,
  title: `Title ${id}`,
});

function playing(current: PlayerTab | null = item("movie-603")): PlayerSession {
  return createPlayerSession(current, {});
}

describe("one item at a time", () => {
  it("opening another item replaces the current one", () => {
    const next = reducePlayerSession(playing(item("movie-603")), { type: "open", item: item("movie-27205") });
    assert.equal(next.current?.id, "movie-27205");
  });

  it("opening the item already playing changes nothing", () => {
    const session = playing(item("movie-603"));
    assert.equal(reducePlayerSession(session, { type: "open", item: item("movie-603") }), session);
  });

  it("a library entry opens as the item its reference names", () => {
    const entry: LibraryItem = { ref: { kind: "title", id: "movie-7" }, kind: "movie", title: "Seven", genres: [], favorite: false };
    const next = reducePlayerSession(playing(null), { type: "open", item: itemFromLibrary(entry) });
    assert.equal(next.current?.title, "Seven");
    assert.equal(next.current?.id, "movie-7");
  });
});

describe("closing", () => {
  it("close empties the Player back to its idle state", () => {
    const next = reducePlayerSession(playing(), { type: "close" });
    assert.equal(next.current, null);
    assert.equal(viewOf(next).tab, undefined);
  });

  it("closing an idle Player changes nothing that the panes draw", () => {
    const idle = reducePlayerSession(playing(), { type: "close" });
    assert.equal(reducePlayerSession(idle, { type: "close" }).current, null);
  });
});

describe("episode and season choices", () => {
  const series = item("tv-1396", "tv");

  it("choosing an episode loads it in place and shows its season", () => {
    const next = reducePlayerSession(playing(series), { type: "episode", season: 2, episode: 4 });
    assert.equal(next.current?.subtitle, "S02 E04");
    assert.equal(next.season, 2);
    assert.equal(next.current?.id, "tv-1396");
  });

  it("changing the season alone starts nothing and changes the item not at all", () => {
    const session = playing(series);
    const next = reducePlayerSession(session, { type: "season", season: 3 });
    assert.equal(next.season, 3);
    assert.equal(next.current?.subtitle, undefined);
  });

  it("opening a different item resets the season the browser shows", () => {
    const withSeason = reducePlayerSession(playing(series), { type: "season", season: 3 });
    const next = reducePlayerSession(withSeason, { type: "open", item: item("movie-27205") });
    assert.equal(next.season, undefined);
  });

  it("choosing an episode with nothing open changes nothing", () => {
    const idle = playing(null);
    assert.equal(reducePlayerSession(idle, { type: "episode", season: 1, episode: 1 }).current, null);
  });
});

describe("local favourites, membership and the related fold", () => {
  it("a favourite change is held per item", () => {
    const next = reducePlayerSession(playing(), { type: "favorite", itemId: "movie-1", value: true });
    assert.equal(next.favorites["movie-1"], true);
  });

  it("toggling membership adds, then removes, the collection", () => {
    const added = reducePlayerSession(playing(), { type: "toggleMember", itemId: "movie-1", collectionId: "c-a" });
    assert.deepEqual(added.membership["movie-1"], ["c-a"]);
    const removed = reducePlayerSession(added, { type: "toggleMember", itemId: "movie-1", collectionId: "c-a" });
    assert.deepEqual(removed.membership["movie-1"], []);
  });
});
