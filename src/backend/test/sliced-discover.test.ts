// The sliced discover walk (docs/48) against a fake TMDB that enforces page <= 500, 20 rows a page and inclusive date bounds:
// every title of the ground truth is written exactly once, no page 501 is asked, a slice over the limit is split and a
// single day over it stops at page 500, progress counts slices, and a Stop or a re-run leaves a consistent store.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { fractionOf } from "../src/services/job-progress.js";
import { describeRequest } from "../src/services/title-sync-request.js";
import { createStoreRow } from "../src/services/title-store-row.js";
import { detailOf } from "../src/services/title-shapes.js";
import { sliceList, sliceParams, splitSlice } from "../src/services/title-slices.js";
import { createTitleWalk } from "../src/services/title-walk.js";
import { createStore } from "../src/store/store.js";
import type { ProgressUpdate } from "../src/types/job-progress.js";
import { dayOfYear, fakeDiscover, titlesOf, type FakeTitle } from "./sliced-tmdb.js";

const NOW = Date.UTC(2026, 9, 18, 12); // next calendar year is 2027: 130 slices
const SLICES = 130;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const temp: string[] = [];
after(() => temp.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

type Truth = { movie: FakeTitle[]; tv: FakeTitle[] };

/** A walk of `truth` that records what it writes and reports; `stop` aborts its signal. */
function drive(truth: Truth) {
  const tmdb = fakeDiscover(truth);
  const written: string[] = [];
  const reports: ProgressUpdate[] = [];
  const notes: string[] = [];
  const controller = new AbortController();
  const walk = createTitleWalk({
    store: { transaction: (work) => work() },
    tmdb: tmdb.client,
    storeRow: (kind, record) => written.push(`${kind}-${String(record.id)}`) > 0,
    now: () => NOW,
  });
  const run = () => walk({ scope: "discover", pages: 1 }, {
    signal: controller.signal, report: (update) => void reports.push(update), notes,
    seen: { titles: 0, detailed: 0, seasons: 0, enriched: 0 }, shuttingDown: () => false,
  });
  return { tmdb, written, reports, notes, run, stop: (): void => controller.abort() };
}

const idsOf = (kind: "movie" | "tv", titles: FakeTitle[]): string[] =>
  titles.filter((t) => t.date !== "").map((t) => `${kind}-${t.id}`).sort();

/** A bit of every region (before 1900, years, the split year, next year, later) plus a title with no date. */
function mixedTruth(): Truth {
  return {
    movie: [
      ...titlesOf(1, 3, () => "1850-05-05"),
      ...titlesOf(10, 25, (i) => dayOfYear(2000, i * 7)),
      ...titlesOf(100, 10_100, (i) => dayOfYear(2010, i % 365)),
      { id: 20_000, date: "1899-12-31" }, { id: 20_001, date: "1900-01-01" },
      { id: 20_002, date: "2027-12-31" }, { id: 20_003, date: "2028-01-01" }, { id: 20_004, date: "" },
    ],
    tv: [...titlesOf(500_000, 45, (i) => dayOfYear(1995, i * 5)), { id: 600_000, date: "2040-02-02" }, { id: 600_001, date: "" }],
  };
}

test("every title of the ground truth is written exactly once, page 501 is never asked, undated titles are not requested", async () => {
  const truth = mixedTruth();
  const d = drive(truth);
  await d.run();
  assert.deepEqual(d.tmdb.violations, []);
  assert.ok(d.tmdb.requests.every((r) => r.page <= 500));
  assert.deepEqual([...d.written].sort(), [...idsOf("movie", truth.movie), ...idsOf("tv", truth.tv)].sort(), "the id set, once each");
  assert.ok(!d.written.includes("movie-20004") && !d.written.includes("tv-600001"), "a title with no date is not discovered");
  const year2000 = d.tmdb.requests.filter((r) => r.kind === "movie" && r.params.primary_release_year === 2000);
  assert.deepEqual(year2000.map((r) => r.page), [1, 2], "page 1 is asked once and used, then page 2");
});

test("progress counts slices: the total is known up front, a split adds one, done never goes backwards and ends at the total", async () => {
  const d = drive(mixedTruth());
  await d.run();
  const of = (phase: string) => d.reports.filter((r) => r.phase === phase);
  assert.deepEqual(of("movies")[0], { phase: "movies", done: 0, total: SLICES }, "the slice count, before any call");
  assert.deepEqual([...new Set(of("movies").map((r) => r.total))], [SLICES, SLICES + 1], "the 2010 split added one slice");
  assert.deepEqual([...new Set(of("tv").map((r) => r.total))], [SLICES], "no series year needed a split");
  for (const phase of ["movies", "tv"]) {
    const done = of(phase).map((r) => r.done);
    assert.deepEqual(done, [...done].sort((a, b) => a - b), `${phase} done never goes backwards`);
    assert.equal(of(phase).at(-1)?.done, of(phase).at(-1)?.total, `${phase} ends complete`);
  }
  const fractions = d.reports.map(fractionOf);
  const dips = fractions.filter((value, i) => i > 0 && value < (fractions[i - 1] ?? 0));
  assert.ok(dips.length <= 1 && fractions.at(-1) === 0.1, "only the split's momentary dip; the walk ends at its 10%");
});

test("a split makes inclusive, overlap-free halves; a boundary day lands in exactly one", () => {
  assert.deepEqual(splitSlice({ year: 2010 }), [{ from: "2010-01-01", to: "2010-07-02" }, { from: "2010-07-03", to: "2010-12-31" }]);
  assert.deepEqual(splitSlice({ from: "2010-07-03", to: "2010-07-04" }), [
    { from: "2010-07-03", to: "2010-07-03" }, { from: "2010-07-04", to: "2010-07-04" },
  ]);
  const [left, right] = splitSlice({ to: "1899-12-31" }) ?? [];
  assert.ok(left?.from === undefined && right?.to === "1899-12-31", "an open end stays open");
  assert.equal(splitSlice({ from: "2010-05-05", to: "2010-05-05" }), undefined, "a single day cannot be split");
});

test("a split slice walks both halves and the boundary days are written once", async () => {
  const d = drive({ movie: [...titlesOf(1, 10_040, (i) => dayOfYear(2010, i % 365)), { id: 99_999, date: "2010-07-02" }], tv: [] });
  await d.run();
  const written = d.written.filter((w) => w.startsWith("movie-"));
  assert.equal(new Set(written).size, written.length, "no title twice");
  assert.equal(written.length, 10_041);
  assert.equal(d.tmdb.requests.filter((r) => r.params.primary_release_year === 2010).length, 1, "the year is asked once, then split");
});

test("a single day over the limit is walked to page 500, noted, and never loops", async () => {
  const d = drive({ movie: titlesOf(1, 10_100, () => "2015-03-03"), tv: [] });
  await d.run();
  assert.deepEqual(d.tmdb.violations, []);
  assert.equal(d.written.length, 10_000, "the 500 pages TMDB serves");
  assert.equal(d.notes.length, 1);
  assert.match(d.notes[0] ?? "", /movie 2015-03-03/);
  assert.equal(Math.max(...d.tmdb.requests.map((r) => r.page)), 500);
});

test("Stop at the first call stores nothing; Stop mid-walk keeps whole pages; a run after it completes with the full id set", async () => {
  const truth = mixedTruth();
  const first = drive(truth);
  first.tmdb.onRequest((count) => count === 1 && first.stop());
  await assert.rejects(first.run(), { name: "AbortError" });
  assert.deepEqual(first.written, []);

  const second = drive(truth);
  second.tmdb.onRequest((count) => count === 60 && second.stop());
  await assert.rejects(second.run(), { name: "AbortError" });
  assert.ok(second.written.length > 0 && second.written.every((id) => id.startsWith("movie-")), "movies only, no series");

  const third = drive(truth);
  await third.run();
  assert.equal(new Set(third.written).size, idsOf("movie", truth.movie).length + idsOf("tv", truth.tv).length);
});

test("the job's pages does not change a discover walk", async () => {
  const truth = mixedTruth();
  const a = drive(truth);
  await a.run(); // pages: 1
  assert.equal(a.written.length, idsOf("movie", truth.movie).length + idsOf("tv", truth.tv).length);
});

test("the slice list follows the clock, and the parameters follow the kind", () => {
  const slices = sliceList(() => NOW);
  assert.deepEqual([slices.length, slices[0], slices[1], slices.at(-2), slices.at(-1)],
    [SLICES, { to: "1899-12-31" }, { year: 1900 }, { year: 2027 }, { from: "2028-01-01" }]);
  assert.equal(sliceList(() => Date.UTC(2027, 0, 1)).length, SLICES + 1);
  assert.deepEqual(sliceParams("movie", { year: 1999 }, 3),
    { sort_by: "popularity.desc", "vote_count.gte": 50, page: 3, primary_release_year: 1999 });
  assert.deepEqual(sliceParams("tv", { from: "2010-01-01", to: "2010-02-01" }, 1), {
    sort_by: "popularity.desc", "vote_count.gte": 50, page: 1, "first_air_date.gte": "2010-01-01", "first_air_date.lte": "2010-02-01",
  });
  assert.deepEqual(describeRequest({ scope: "discover", pages: 7 }), { scope: "discover", walk: "by year, both kinds, to the last page" });
});

test("a re-run keeps the id set, a stale detail keeps its shape and an edited field survives", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-slices-"));
  temp.push(dir);
  const store = createStore(path.join(dir, "db.sqlite"));
  after(() => store.close());
  let now = NOW;
  const truth: Truth = { movie: titlesOf(1, 45, (i) => dayOfYear(2000, i)), tv: titlesOf(500, 3, () => "1990-01-01") };
  const walk = createTitleWalk({
    store, tmdb: fakeDiscover(truth).client, now: () => now,
    storeRow: createStoreRow({ store, deleted: { isDeleted: () => false }, now: () => now }),
  });
  const pass = () => walk({ scope: "discover" }, {
    signal: new AbortController().signal, report: () => undefined, seen: { titles: 0, detailed: 0, seasons: 0, enriched: 0 },
    shuttingDown: () => false,
  });
  await pass();
  assert.equal(store.titles.counts(FOUR_DAYS_MS).total, 48);

  const detail = detailOf("movie", 5, { id: 5, title: "movie 5", overview: "Plot", release_date: "2000-01-05" });
  store.titles.put({ kind: "movie", tmdbId: 5, payload: detail, popularityScore: 1, popularityReadAt: now, fetchedAt: now });
  store.titles.updateRecord("movie-5", { payload: { ...detail, title: "Mine" }, editedFields: ["title"], tmdbId: 5, enabled: true });

  now += FOUR_DAYS_MS;
  await pass();
  assert.equal(store.titles.counts(FOUR_DAYS_MS).total, 48, "the same id set");
  const after5 = store.titles.find("movie", 5)?.payload as Record<string, unknown>;
  assert.deepEqual([after5.shape, after5.plot, after5.title], ["detail", "Plot", "Mine"]);
});
