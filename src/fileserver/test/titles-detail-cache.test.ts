// A title's detail is read live (it carries the Player's sources) and written through to the cache's display columns;
// offline it is answered from the cache without sources (docs/46 sections A and B).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { imageIdOf } from "../src/services/image-cache-service.js";
import { pick, send, type FileserverApp } from "./app-fixture.js";
import type { FakeTitle } from "./fake-titles.js";
import { bootTitles, idsOf, peek, syncTitles } from "./library-fixture.js";

const POSTER = "https://image.tmdb.org/t/p/w500/matrix.jpg";
const BACKDROP = "https://image.tmdb.org/t/p/w1280/matrix-b.jpg";
const STREAM = "https://streams.example.test/secret-movie-603.m3u8";
const SOURCE_URL = "https://vidsrc.example/embed/movie?tmdbId=603";

const CATALOG: FakeTitle[] = [
  { id: "movie-603", title: "The Matrix", year: 1999, popularity: 80, posterUrl: POSTER, genres: ["878"] },
  { id: "movie-550", title: "Fight Club", year: 1999, popularity: 60, genres: ["878"] },
  { id: "tv-1399", title: "Game of Thrones", year: 2011, genres: ["18"] },
];

const MATRIX = {
  id: "movie-603", tmdbId: 603, kind: "movie", title: "The Matrix", year: 1999, genres: ["Science Fiction"], rating: 8.2,
  plot: "A computer hacker learns the truth.", posterUrl: POSTER, backdropUrl: BACKDROP, runtimeMs: 8_160_000,
  cast: Array.from({ length: 12 }, (_, at) => `Actor ${at}`), streamUrl: STREAM,
  sources: [{ providerId: 2, name: "VidSrc", url: SOURCE_URL, origin: "https://vidsrc.example", order: 1 }],
};
const GOT = {
  id: "tv-1399", kind: "tv", title: "Game of Thrones", year: 2011, genres: ["Drama"],
  seasons: [{ season: 1, episodes: [{ episode: 1 }, { episode: 2 }] }, { season: 2, episodeCount: 10 }],
};

/** Every byte the app's database files hold (the main file and its write-ahead log). */
function databaseBytes(t: FileserverApp): Buffer {
  const files = readdirSync(t.dataDir).filter((name) => name.startsWith("giga-stream.db"));
  return Buffer.concat(files.map((name) => readFileSync(path.join(t.dataDir, name))));
}

async function openedMatrix() {
  const booted = await bootTitles(CATALOG);
  booted.backend.state.details["movie-603"] = MATRIX;
  booted.backend.state.details["tv-1399"] = GOT;
  await syncTitles(booted.t);
  return booted;
}

test("a live detail answers with its sources and stream, and only display fields reach the database", async () => {
  const { t } = await openedMatrix();
  const live = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(live.status, 200);
  assert.equal(pick(live.body, "data.streamUrl"), STREAM);
  assert.equal(pick(live.body, "data.sources.0.url"), SOURCE_URL);
  assert.equal(pick(live.body, "data.fromCache"), undefined);
  assert.equal(pick(live.body, "data.cast.length"), 10);

  const row = peek(t, "SELECT * FROM cached_titles WHERE id = 'movie-603'")[0] as Record<string, unknown>;
  assert.equal(row.plot, "A computer hacker learns the truth.");
  assert.equal(row.runtime_ms, 8_160_000);
  assert.equal(row.backdrop_url, BACKDROP);
  assert.equal(row.detail_at, t.clock.now());
  assert.equal(row.in_catalog, 1, "an in-catalog row stays in the catalog");
  assert.equal(row.popularity, 80, "the sync's popularity is not overwritten by a detail");
  assert.deepEqual(JSON.parse(String(row.cast_json)), MATRIX.cast.slice(0, 10));

  const bytes = databaseBytes(t);
  for (const secret of [STREAM, SOURCE_URL, "vidsrc.example", "secret-movie", "providerId"]) {
    assert.equal(bytes.includes(Buffer.from(secret)), false, `${secret} must not be in the database`);
  }
  assert.deepEqual(peek(t, "SELECT * FROM cached_titles").filter((one) => JSON.stringify(one).includes("stream")), []);
  await t.dispose();
});

test("offline the detail comes from the cache: fromCache true, no sources, no stream, images through the cache", async () => {
  const { backend, t } = await openedMatrix();
  await send(t.app, "GET", "/api/titles/movie-603");
  backend.state.down = true;

  const offline = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(offline.status, 200);
  assert.equal(pick(offline.body, "data.fromCache"), true);
  assert.equal(pick(offline.body, "data.sources"), undefined);
  assert.equal(pick(offline.body, "data.streamUrl"), undefined);
  assert.equal(pick(offline.body, "data.plot"), "A computer hacker learns the truth.");
  assert.equal(pick(offline.body, "data.runtimeMs"), 8_160_000);
  assert.deepEqual(pick(offline.body, "data.genres"), ["Science Fiction"]);
  assert.equal(pick(offline.body, "data.cast.length"), 10);
  assert.equal(pick(offline.body, "data.posterUrl"), `/api/images/${imageIdOf(POSTER)}`);
  assert.equal(pick(offline.body, "data.backdropUrl"), `/api/images/${imageIdOf(BACKDROP)}`);

  const unopened = await send(t.app, "GET", "/api/titles/movie-550");
  assert.equal(pick(unopened.body, "data.title"), "Fight Club", "a title never opened answers from its list columns");
  assert.equal(pick(unopened.body, "data.fromCache"), true);
  assert.equal(pick(unopened.body, "data.plot"), undefined);
  await t.dispose();
});

test("the backend no longer knowing a cached title answers from the cache; an uncached one keeps its error", async () => {
  const { backend, t } = await openedMatrix();
  delete backend.state.details["movie-603"];
  const gone = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(gone.status, 200);
  assert.equal(pick(gone.body, "data.fromCache"), true);

  const unknown = await send(t.app, "GET", "/api/titles/movie-999");
  assert.equal(unknown.status, 404);
  assert.equal(pick(unknown.body, "error.code"), "title.not_found");
  backend.state.down = true;
  const down = await send(t.app, "GET", "/api/titles/movie-999");
  assert.equal(down.status, 503);
  assert.equal(pick(down.body, "error.code"), "backend.unreachable");
  await t.dispose();
});

test("a series' season counts are written through and answered offline", async () => {
  const { backend, t } = await openedMatrix();
  const live = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(live.body, "data.seasons"), [{ season: 1, episodeCount: 2 }, { season: 2, episodeCount: 10 }]);
  backend.state.down = true;
  const offline = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(offline.body, "data.seasons"), [{ season: 1, episodeCount: 2 }, { season: 2, episodeCount: 10 }]);
  assert.equal(pick(offline.body, "data.runtimeMs"), undefined);
  await t.dispose();
});

test("a title opened off the catalog is inserted as off-catalog and the sweep spares it", async () => {
  const { backend, t } = await openedMatrix();
  backend.state.details["custom-home"] = { id: "custom-home", kind: "movie", title: "Home Video", year: 2020, genres: [], plot: "Our trip." };
  const opened = await send(t.app, "GET", "/api/titles/custom-home");
  assert.equal(pick(opened.body, "data.title"), "Home Video");
  assert.deepEqual(peek(t, "SELECT in_catalog, seen_run FROM cached_titles WHERE id = 'custom-home'"), [{ in_catalog: 0, seen_run: 0 }]);

  backend.publish(CATALOG.filter((one) => one.id !== "movie-550"));
  t.clock.advance(1_000);
  assert.equal((await syncTitles(t)).status, 200);
  const kept = peek(t, "SELECT id, in_catalog FROM cached_titles ORDER BY id").map((row) => `${row.id}:${row.in_catalog}`);
  assert.deepEqual(kept, ["custom-home:0", "movie-603:1", "tv-1399:1"], "the catalog title that left was swept, the off-catalog one spared");
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/library?q=home")).body), ["custom-home"]);

  backend.publish([...CATALOG, { id: "custom-home", title: "Home Video", year: 2020 }]);
  t.clock.advance(1_000);
  await syncTitles(t);
  assert.deepEqual(peek(t, "SELECT in_catalog FROM cached_titles WHERE id = 'custom-home'"), [{ in_catalog: 1 }], "listed later: in the catalog");
  await t.dispose();
});
