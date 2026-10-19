// The Library update's two store questions (docs/49 section 2), asked of a real database: which of a window's TMDB ids are
// stored titles worth refreshing (one set-based query), and the `refresh` queue (no age clause, the changed ids forced, an
// empty set widens nothing). Plus the pure pieces: the phase weights, the request words and the first phase.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "./db-kit.js";
import test, { after } from "node:test";

import { createJobProgress, fractionOf } from "../src/services/job-progress.js";
import { describeRequest } from "../src/services/title-sync-request.js";
import { firstPhase } from "../src/services/title-walk.js";
import { createStore, type Store } from "../src/store/store.js";

const dirs: string[] = [];
after(() => dirs.forEach((dir) => removeDir(dir)));
const newStore = async (): Promise<Store> => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-update-queue-"));
  dirs.push(dir);
  return createStore(path.join(dir, "admin.db"));
};

const NOW = 1_000_000;
const detail = (extra: Record<string, unknown> = {}) => ({ shape: "detail", ...extra });
const put = async (store: Store, kind: "movie" | "tv", tmdbId: number, payload: unknown, fetchedAt = NOW, popularity = 1): Promise<void> =>
  store.titles.put({ kind, tmdbId, payload, popularityScore: popularity, popularityReadAt: NOW, fetchedAt });
const ids = async (store: Store, changed: string[] = [], omdb = false) =>
  (await store.titles.update.refreshQueue(changed, 3, omdb, NOW - 5)).map((item) => [item.id, item.force]);

test("storedAmong answers the enabled, TMDB, not-deleted titles of the kind from one set, however large", async () => {
  const store = await newStore();
  for (const id of [1, 2, 3, 4]) await put(store, "movie", id, detail());
  await put(store, "tv", 1, detail());
  const off = await store.titles.find("movie", 2);
  await store.titles.updateRecord("movie-2", { payload: off?.payload, editedFields: [], tmdbId: 2, enabled: false });
  await store.deletedTitles.record("movie", 3, "gone", NOW);
  await store.titles.insertManual({ id: "custom-1", kind: "movie", tmdbId: 5, payload: {}, at: NOW });
  assert.deepEqual(await store.titles.update.storedAmong("movie", [1, 2, 3, 4, 5, 6]), [1, 4]);
  assert.deepEqual(await store.titles.update.storedAmong("tv", [1, 4]), [1]);
  assert.deepEqual(await store.titles.update.storedAmong("movie", []), []);
  const many = Array.from({ length: 60_000 }, (_, i) => i + 10_000_000);
  assert.deepEqual(await store.titles.update.storedAmong("movie", [...many, 4]), [4], "60,000 ids are one parameter");
  store.close();
});

test("the refresh queue has no age clause: only a list-only title, an episode-less season, a changed id and an OMDb gap", async () => {
  const store = await newStore();
  await put(store, "movie", 1, detail(), 0, 9); // a detail from the beginning of time: no age clause, so not queued
  await put(store, "movie", 2, { shape: "list" }, NOW, 8);
  await put(store, "tv", 3, detail({ seasons: [{ season: 0 }, { season: 1, episodesAt: 5, episodes: [] }, { season: 2 }] }), 0, 7);
  await put(store, "tv", 4, detail({ seasons: [{ season: 1, episodesAt: 5, episodes: [] }] }), 0, 6);
  assert.deepEqual(await ids(store), [["movie-2", false], ["tv-3", false]], "popularity order; the specials never count");
  assert.deepEqual(await ids(store, []), await ids(store), "an empty changed set widens nothing");
  assert.deepEqual(await ids(store, ["movie-1", "tv-4", "movie-404"]), [
    ["movie-1", true], ["movie-2", false], ["tv-3", false], ["tv-4", true],
  ], "the changed ids that are stored are forced; one that is not stored is nothing");
  store.close();
});

test("the refresh queue leaves out disabled titles, manual ones and a title that failed three runs - forced or not", async () => {
  const store = await newStore();
  for (const id of [1, 2, 3]) await put(store, "movie", id, detail());
  const two = await store.titles.find("movie", 2);
  await store.titles.updateRecord("movie-2", { payload: two?.payload, editedFields: [], tmdbId: 2, enabled: false });
  for (let i = 0; i < 3; i++) await store.titles.queue.noteDetailFailure("movie-3", NOW);
  await store.titles.insertManual({ id: "custom-1", kind: "movie", tmdbId: 9, payload: { shape: "list" }, at: NOW });
  assert.deepEqual(await ids(store, ["movie-1", "movie-2", "movie-3", "custom-1"]), [["movie-1", true]]);
  store.close();
});

test("with OMDb on, a detail with a gap and no fresh block is queued (not forced); with it off, it is not", async () => {
  const store = await newStore();
  await put(store, "movie", 1, detail({ imdbId: "tt1", plot: "", genres: [{ id: 1 }], rating: 7, runtimeMs: 60_000 }));
  await put(store, "movie", 2, detail({ imdbId: "tt2", plot: "Whole", genres: [{ id: 1 }], rating: 7, runtimeMs: 60_000 }));
  assert.deepEqual(await ids(store), []);
  assert.deepEqual(await ids(store, [], true), [["movie-1", false]], "the gap title only; movie-2 has nothing to fill");
  await store.titles.queue.setOmdbFailure("movie-1", NOW);
  assert.deepEqual(await ids(store, [], true), [], "a recent miss waits out the window");
  store.close();
});

test("the Library update's phases weigh 0-10%, 10-20% and 20-100%; the fill's are unchanged; the bar never goes back", () => {
  const at = (phase: string, done: number, total: number): number => fractionOf({ phase, done, total });
  assert.deepEqual([at("recent", 0, 4), at("recent", 4, 4), at("airing", 0, 9), at("airing", 9, 9)], [0, 0.1, 0.1, 0.2]);
  assert.deepEqual([at("refresh", 0, 5), at("refresh", 5, 5)].map((n) => Math.round(n * 100)), [20, 100]);
  assert.deepEqual([at("movies", 1, 1), at("details", 0, 3)], [0.05, 0.1], "the fill is as it was");
  const progress = createJobProgress({ now: () => 0 });
  const seen: number[] = [];
  progress.subscribe((event) => event.type === "progress" && seen.push(fractionOf(event.progress)));
  const report = progress.start(1, "recent");
  for (const update of [
    { phase: "recent", done: 2, total: 4 }, { phase: "recent", done: 4, total: 4 }, { phase: "airing", done: 0, total: 0 },
    { phase: "airing", done: 3, total: 3 }, { phase: "refresh", done: 0, total: 2 }, { phase: "refresh", done: 2, total: 2 },
  ]) report(update);
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b), "monotonic across the three phases");
  assert.equal(seen.at(-1), 1);
});

test("the first phase and the audited words of a Library update", () => {
  assert.deepEqual([firstPhase({ scope: "recent" }), firstPhase({ scope: "discover" }), firstPhase({ scope: "popular" })], ["recent", "movies", "list"]);
  assert.deepEqual(describeRequest({ scope: "recent", since: 5 }), {
    scope: "recent", walk: "recent discover, then airing series, then a refresh", since: 5,
  });
  assert.equal(Object.hasOwn(describeRequest({ scope: "recent" }), "since"), false);
});
