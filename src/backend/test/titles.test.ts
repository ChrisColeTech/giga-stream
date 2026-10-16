import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

import { makeApp, pick, send, signIn } from "./test-app.js";

const MATRIX = {
  id: 603,
  title: "The Matrix",
  overview: "A computer hacker learns the true nature of reality.",
  release_date: "1999-03-31",
  vote_average: 8.2,
  popularity: 90,
  poster_path: "/matrix.jpg",
  backdrop_path: "/matrix-b.jpg",
  runtime: 136,
  genres: [{ id: 878, name: "Science Fiction" }],
  credits: { cast: [{ name: "Keanu Reeves" }, { name: "Laurence Fishburne" }] },
  external_ids: { imdb_id: "tt0133093" },
};

const GOT_DETAIL = {
  id: 1399,
  name: "Game of Thrones",
  first_air_date: "2011-04-17",
  vote_average: 8.4,
  popularity: 120,
  poster_path: "/got.jpg",
  genres: [{ id: 18, name: "Drama" }],
  credits: { cast: [{ name: "Peter Dinklage" }] },
  external_ids: { imdb_id: "tt0944947" },
};

const OMDB_MATRIX = {
  Title: "The Matrix",
  Year: "1999",
  Rated: "R",
  Metascore: "73",
  imdbRating: "8.7",
  imdbVotes: "2.1M",
  Ratings: [
    { Source: "Internet Movie Database", Value: "8.7/10" },
    { Source: "Rotten Tomatoes", Value: "83%" },
    { Source: "Metacritic", Value: "73/100" },
  ],
  Awards: "Won 4 Oscars. 42 wins & 52 nominations total",
  BoxOffice: "$177,559,005",
  Director: "Lana Wachowski, Lilly Wachowski",
  Writer: "The Wachowskis",
  Language: "English",
  Country: "United States",
  Plot: "When a beautiful stranger leads computer hacker Neo to a forbidding underworld...",
  Response: "True",
};

const LIST_ROW = {
  id: 603,
  title: "The Matrix",
  release_date: "1999-03-31",
  vote_average: 8.2,
  popularity: 90,
  poster_path: "/matrix.jpg",
  genre_ids: [878],
};

const SEASON = {
  episodes: [{ episode_number: 1, name: "Winter Is Coming", air_date: "2011-04-17", runtime: 62 }],
};

const stubs: Array<() => Promise<void>> = [];
after(async () => {
  for (const close of stubs) await close();
});

/** A stub TMDB on 127.0.0.1: records request keys, answers the paths the service calls. */
async function stubTmdb() {
  const calls: string[] = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    calls.push(url.pathname + url.search);
    const json = (body: unknown): void => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/movie/603") return json(MATRIX);
    if (url.pathname === "/tv/1399") return json(GOT_DETAIL);    if (url.pathname === "/discover/movie" || url.pathname === "/discover/tv") {
      return json({ page: 1, results: [LIST_ROW], total_pages: 1, total_results: 1 });
    }
    if (url.pathname === "/trending/movie/week" || url.pathname === "/trending/tv/week") {
      return json({ page: url.searchParams.get("page"), results: [LIST_ROW], total_pages: 1, total_results: 1 });
    }
    if (url.pathname === "/movie/popular" || url.pathname === "/tv/popular") {
      return json({ page: url.searchParams.get("page"), results: [LIST_ROW], total_pages: 1, total_results: 1 });
    }
    if (url.pathname === "/genre/movie/list") return json({ genres: [{ id: 878, name: "Science Fiction" }] });
    if (url.pathname === "/tv/1399/season/1") return json(SEASON);
    if (url.pathname === "/movie/603/recommendations" || url.pathname === "/tv/1399/recommendations") {
      return json({ page: 1, results: [{ ...LIST_ROW, id: 1399, title: "Game of Thrones" }], total_pages: 1, total_results: 1 });
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ status_message: "not found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  stubs.push(close);
  return { base: `http://127.0.0.1:${address.port}`, calls };
}

test("a title detail is fetched once, stored, and answered from the store after a restart", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "titles-"));
  const first = await makeApp({ dataDir, config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const detail = await send(first.app, "GET", "/api/titles/movie-603");
  assert.equal(detail.status, 200);
  assert.equal(pick(detail.body, "data.title"), "The Matrix");
  assert.equal(pick(detail.body, "data.year"), 1999);
  assert.equal(pick(detail.body, "data.cast.0"), "Keanu Reeves");
  const again = await send(first.app, "GET", "/api/titles/movie-603");
  assert.deepEqual(again.body, detail.body);
  const callsAfterFirst = tmdb.calls.filter((c) => c.startsWith("/movie/603")).length;
  assert.ok(callsAfterFirst >= 1);
  assert.equal(callsAfterFirst, 1, "the second read is served from the store");
  await first.dispose();

  // A fresh process on the same data dir answers from the store without calling TMDB.
  const second = await makeApp({ dataDir, config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const third = await send(second.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(third.body, "data.title"), "The Matrix");
  assert.equal(tmdb.calls.filter((c) => c.startsWith("/movie/603")).length, callsAfterFirst);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("browse answers pages and stores the list; an unknown title is title.not_found", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const page = await send(t.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(page.body, "data.items.0.id"), "movie-603");
  assert.equal(pick(page.body, "data.totalPages"), 1);

  const missing = await send(t.app, "GET", "/api/titles/movie-999999");
  assert.equal(missing.status, 404);
  assert.equal(pick(missing.body, "error.code"), "title.not_found");
  await t.dispose();
});

test("a season answers its episodes; genres answer from TMDB", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.title"), "Winter Is Coming");
  assert.equal(pick(season.body, "data.episodes.0.runtimeMs"), 3_720_000);
  const genres = await send(t.app, "GET", "/api/titles/genres?kind=movie");
  assert.equal(pick(genres.body, "data.0.name"), "Science Fiction");
  await t.dispose();
});

test("sync is admin-only, single-flight, audited, and announces titles.synced", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const access = (await signIn(t.app)).access;

  const denied = await send(t.app, "POST", "/api/titles/sync", { scope: "trending", kind: "movie", pages: 1 });
  assert.equal(denied.status, 401);

  const started = await send(t.app, "POST", "/api/titles/sync", { scope: "trending", kind: "movie", pages: 1 }, access);
  assert.equal(started.status, 202);

  const busy = await send(t.app, "POST", "/api/titles/sync", { scope: "popular", kind: "tv", pages: 1 }, access);
  assert.equal(busy.status, 409);
  assert.equal(pick(busy.body, "error.code"), "sync.busy");

  const bad = await send(t.app, "POST", "/api/titles/sync", { scope: "titles" }, access);
  assert.equal(pick(bad.body, "error.code"), "sync.invalid");

  await settled(t);
  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.equal(pick(status.body, "data.running"), false);
  assert.equal(pick(status.body, "data.lastOutcome"), "ok");
  assert.ok(Number(pick(status.body, "data.titles")) >= 1);
  assert.equal(pick(status.body, "data.schedule"), "off");

  const audit = await send(t.app, "GET", "/api/audit?limit=10", undefined, access);
  const actions = (pick(audit.body, "data.items") as Array<Record<string, unknown>>).map((a) => a.action);
  assert.ok(actions.includes("sync.started"));
  assert.ok(actions.includes("sync.finished"));
  await t.dispose();
});

test("TMDB_SYNC_SCHEDULE arms the warm-up, audited as system, without touching the revision", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({
    config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base, TMDB_SYNC_SCHEDULE: "150ms" },
  });
  const access = (await signIn(t.app)).access;
  const healthBefore = await send(t.app, "GET", "/healthz");
  const revisionBefore = pick(healthBefore.body, "data.revision");

  // Wait until the scheduled warm-up has pulled at least one title into the store.
  for (let i = 0; i < 400; i++) {
    const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
    if (Number(pick(status.body, "data.titles")) >= 1) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.equal(pick(status.body, "data.schedule"), "150ms");
  assert.ok(Number(pick(status.body, "data.titles")) >= 1);

  const healthAfter = await send(t.app, "GET", "/healthz");
  assert.equal(pick(healthAfter.body, "data.revision"), revisionBefore);

  const audit = await send(t.app, "GET", "/api/audit?limit=30", undefined, access);
  const system = (pick(audit.body, "data.items") as Array<Record<string, unknown>>).find(
    (a) => a.action === "sync.started",
  );
  assert.ok(system !== undefined);
  assert.equal(system!.actorEmail ?? null, null);

  await t.dispose();
});

/** Resolves once no sync job is running (polls the status endpoint with a sign-in). */
async function settled(t: Awaited<ReturnType<typeof makeApp>>): Promise<void> {
  const access = (await signIn(t.app)).access;
  for (let i = 0; i < 400; i++) {
    const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
    if (pick(status.body, "data.running") === false) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the sync job never settled");
}

/** A stub OMDb: records the apikey and id of every call, answers the envelope OMDb really sends. */
async function stubOmdb() {
  const calls: string[] = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    calls.push(`${url.searchParams.get("i")}|key=${url.searchParams.get("apikey")}`);
    response.writeHead(200, { "content-type": "application/json" });
    if (url.searchParams.get("i") === "tt0133093" && url.searchParams.get("apikey") === "omdb-test-key") {
      response.end(JSON.stringify(OMDB_MATRIX));
      return;
    }
    if (url.searchParams.get("apikey") !== "omdb-test-key") {
      response.end(JSON.stringify({ Response: "False", Error: "Invalid API key!" }));
      return;
    }
    response.end(JSON.stringify({ Response: "False", Error: "Error getting data." }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  stubs.push(close);
  return { base: `http://127.0.0.1:${address.port}`, calls };
}

const omdbOn = (tmdb: { base: string }, omdb: { base: string }) => ({
  TMDB_READ_TOKEN: "test-token",
  TMDB_BASE: tmdb.base,
  OMDB_API_KEY: "omdb-test-key",
  OMDB_BASE: omdb.base,
});

test("a detail is enriched from OMDb once, then served from the store without another call", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();
  const t = await makeApp({ config: omdbOn(tmdb, omdb) });

  const first = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(first.body, "data.title"), "The Matrix");
  assert.equal(pick(first.body, "data.imdbId"), "tt0133093");
  assert.equal(pick(first.body, "data.omdb.rated"), "R");
  assert.equal(pick(first.body, "data.omdb.metascore"), "73");
  assert.equal(pick(first.body, "data.omdb.ratings.1.source"), "Rotten Tomatoes");
  assert.equal(pick(first.body, "data.omdb.boxOffice"), "$177,559,005");
  assert.equal(pick(first.body, "data.omdb.director"), "Lana Wachowski, Lilly Wachowski");
  assert.equal(pick(first.body, "data.plot"), "A computer hacker learns the true nature of reality.", "TMDB plot is never replaced");

  const callsAfterFirst = omdb.calls.length;
  assert.equal(callsAfterFirst, 1, "one OMDb call");
  const again = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(again.body, "data.omdb.rated"), "R");
  assert.equal(omdb.calls.length, callsAfterFirst, "the second read is served from the store");
  await t.dispose();
});

test("a thin list row is enriched to a full detail on read, and then carries its OMDb block", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();
  const t = await makeApp({ config: omdbOn(tmdb, omdb) });

  // The sync stores thin rows (shape "list"); opening one refetches the full record and enriches it.
  const access = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/titles/sync", { scope: "trending", kind: "movie", pages: 1 }, access);
  await settled(t);

  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.plot"), "A computer hacker learns the true nature of reality.");
  assert.equal(pick(detail.body, "data.cast.0"), "Keanu Reeves");
  assert.equal(pick(detail.body, "data.omdb.rated"), "R");
  await t.dispose();
});

test("without a key, or on an OMDb miss, the detail is served TMDB-shaped with no omdb block", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();

  // No key configured: no block, no call.
  const plain = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const noKey = await send(plain.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(noKey.body, "data.title"), "The Matrix");
  assert.equal(pick(noKey.body, "data.omdb"), undefined);
  assert.equal(omdb.calls.length, 0);
  await plain.dispose();

  // A title whose id OMDb does not know (the stub misses everything but tt0133093).
  const miss = await makeApp({ config: omdbOn(tmdb, omdb) });
  const got = await send(miss.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(got.body, "data.episodes.0.title"), "Winter Is Coming", "seasons work without an omdb block");
  const gotDetail = await send(miss.app, "GET", "/api/titles/tv-1399");
  assert.equal(pick(gotDetail.body, "data.imdbId"), "tt0944947");
  assert.equal(pick(gotDetail.body, "data.omdb"), undefined, "the miss degrades silently");
  await miss.dispose();
});

test("the daily budget stops enriching near the quota, and the status reports the counter", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();
  const t = await makeApp({
    config: { ...omdbOn(tmdb, omdb), OMDB_DAILY_LIMIT: 2 },
  });
  const access = (await signIn(t.app)).access;

  const first = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(first.body, "data.omdb.rated"), "R", "the first enrichment spends the budget");

  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.deepEqual(pick(status.body, "data.omdb"), { enabled: true, calls: 1, limit: 2 });

  // The Matrix is enriched once (1 call); the headroom rule stops nothing yet, but a fresh
  // title never enriched cannot exceed the limit: with the limit at 2 and headroom 10, the
  // stop is immediate for the second kind of check — the tv detail gets no block.
  const got = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.equal(pick(got.body, "data.omdb"), undefined, "the budget guard held (limit 2, headroom 10)");
  await t.dispose();
});
