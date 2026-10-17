import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { resumeOf, viewOf } from "@/lib/player-view";
import { createPlayerSession, itemFromLibrary } from "@/lib/player-session";
import { markOf, withWatchMark, type MarkedEntry } from "@/lib/watch-marks";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";

const movie: LibraryItem = {
  ref: { kind: "title", id: "movie-1" }, kind: "movie", title: "Heat", genres: [], favorite: false,
  watchId: "w-old", progress: { positionMs: 1_000, durationMs: 100_000, state: "watching" },
};
const entry: MarkedEntry = {
  watchId: "w-new", item: movie.ref, positionMs: 60_000, durationMs: 100_000, state: "watching",
};

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("watch marks", () => {
  it("replace an item's snapshot progress and watch id with what was just written", () => {
    const merged = withWatchMark(movie, markOf(entry));
    assert.deepEqual(merged?.progress, { positionMs: 60_000, durationMs: 100_000, state: "watching" });
    assert.equal(merged?.watchId, "w-new");
    assert.equal(withWatchMark(movie, undefined), movie);
    assert.equal(withWatchMark(undefined, markOf(entry)), undefined);
  });

  it("carry the exact episode of a series entry", () => {
    const mark = markOf({ ...entry, season: 2, episode: 5 });
    assert.deepEqual([mark.progress?.season, mark.progress?.episode], [2, 5]);
  });

  it("give Resume the position just written, not the snapshot's, and nothing after a removal", () => {
    const store = useAppStore.getState();
    const session = createPlayerSession(itemFromLibrary(movie));
    const resumeWith = () => {
      const mark = useAppStore.getState().watchMarks["title:movie-1"];
      return resumeOf(viewOf(session, store.marks, { item: withWatchMark(movie, mark) }));
    };
    assert.equal(resumeWith()?.positionMs, 1_000);
    store.rememberWatch(entry);
    assert.equal(resumeWith()?.positionMs, 60_000);
    store.forgetWatch("w-new");
    assert.equal(resumeWith(), undefined);
  });

  it("offer no resume for a row that Play created and nothing has played yet", () => {
    const opened = { ...movie, progress: { positionMs: 0, state: "watching" as const } };
    assert.equal(resumeOf(viewOf(createPlayerSession(itemFromLibrary(opened)), { favourites: {}, memberships: {} }, { item: opened })), undefined);
  });
});

describe("the watch slice", () => {
  it("remembers the newest entry per item and tombstones a removed entry's item", () => {
    const store = useAppStore.getState();
    store.rememberWatch(entry);
    store.rememberWatch({ ...entry, positionMs: 70_000 });
    assert.equal(useAppStore.getState().watchMarks["title:movie-1"]?.progress?.positionMs, 70_000);
    store.forgetWatch("w-new");
    assert.deepEqual(useAppStore.getState().watchMarks["title:movie-1"], {});
  });

  it("forgets a snapshot's watch id that was only ever in a Library read", () => {
    const store = useAppStore.getState();
    store.rememberLibraryItems([movie]);
    store.forgetWatch("w-old");
    assert.deepEqual(useAppStore.getState().watchMarks["title:movie-1"], {});
  });

  it("clearing history tombstones every remembered item with progress and every mark", () => {
    const store = useAppStore.getState();
    store.rememberLibraryItems([movie, { ...movie, ref: { kind: "local", id: "f1" }, progress: undefined }]);
    store.rememberWatch({ ...entry, item: { kind: "local", id: "f2" } });
    store.forgetAllWatch();
    assert.deepEqual(Object.keys(useAppStore.getState().watchMarks).sort(), ["local:f2", "title:movie-1"]);
    assert.equal(useAppStore.getState().watchMarks["local:f2"]?.progress, undefined);
  });
});
