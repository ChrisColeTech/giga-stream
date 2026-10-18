import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/build-app.js";
import { imageIdOf } from "../src/services/image-cache-service.js";
import { makeApp, pick, pointAt, send, startBackend } from "./app-fixture.js";

const backend = await startBackend();

const POSTER = "https://image.tmdb.org/t/p/w500/matrix.jpg";
const BACKDROP = "https://image.tmdb.org/t/p/w1280/matrix-b.jpg";
const STILL = "https://image.tmdb.org/t/p/w300/ep1.jpg";
const STREAM = "https://streams.example.test/movie-603.m3u8";
const cast = (name: string, at: number): string => `${name} ${at}`;

const MOVIE_SOURCES = [
  {
    providerId: 2,
    name: "VidSrc",
    url: "https://vidsrc.example/embed/movie?tmdbId=603",
    origin: "https://vidsrc.example",
    order: 1,
    startParam: "startAt",
  },
  {
    providerId: 4,
    name: "VidZee",
    url: "https://vidzee.example/embed/movie-603",
    origin: "https://vidzee.example",
    order: 2,
    frameOrigins: ["https://vidzee.example"],
  },
];
const EPISODE_SOURCES = [
  {
    providerId: 2,
    name: "VidSrc",
    url: "https://vidsrc.example/embed/tv?tmdbId=1399&season=1&episode=1",
    origin: "https://vidsrc.example",
    order: 1,
  },
];

const MATRIX = {
  ok: true,
  data: {
    id: "movie-603", tmdbId: 603, kind: "movie", title: "The Matrix", year: 1999,
    genres: ["Science Fiction"], rating: 8.2, plot: "A computer hacker learns the truth.",
    posterUrl: POSTER, backdropUrl: BACKDROP, runtimeMs: 8_160_000, streamUrl: STREAM,
    sources: MOVIE_SOURCES,
    cast: Array.from({ length: 11 }, (_, at) => cast("Actor", at)),
  },
};
const GOT = {
  ok: true,
  data: {
    id: "tv-1399", tmdbId: 1399, kind: "tv", title: "Game of Thrones", year: 2011,
    genres: ["Drama"], rating: 8.4, plot: "Winters come.", posterUrl: "https://image.tmdb.org/t/p/w500/got.jpg",
    seasons: [{ season: 1, episodes: [{ episode: 1 }, { episode: 2 }] }],
  },
};
const SEASON = {
  ok: true,
  data: {
    episodes: [
      { season: 1, episode: 2, title: "The Kingsroad", airDate: "2011-04-24", runtimeMs: 3_300_000, stillUrl: "https://image.tmdb.org/t/p/w300/ep2.jpg", streamUrl: "https://streams.example.test/tv-1399-1-2.m3u8" },
      { season: 1, episode: 1, title: "Winter Is Coming", airDate: "2011-04-17", runtimeMs: 3_720_000, stillUrl: STILL, streamUrl: "https://streams.example.test/tv-1399-1-1.m3u8", sources: EPISODE_SOURCES },
    ],
  },
};
const GENRES = { ok: true, data: [{ id: 878, name: "Science Fiction" }] };
const TV_GENRES = { ok: true, data: [{ id: 18, name: "Drama" }] };
const FIGHT_CLUB_ROW = { id: "movie-550", kind: "movie", title: "Fight Club", year: 1999, genres: ["878"], rating: 8.4, posterUrl: POSTER };
const LATE_TV_ROW = { id: "tv-9999", kind: "tv", title: "Late Row", year: 2020, genres: ["18"], rating: 7.1, posterUrl: POSTER };
const RECOMMENDED = { ok: true, data: { items: [{ ...FIGHT_CLUB_ROW }] } };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The seam over the admin client's fetch: hand-written answers shaped as the backend answers
 * them (the style of test/image-cache.test.ts's live-view lane). */
function titlesSeam(overrides: Record<string, unknown> = {}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const at = url.pathname;
    if (overrides[at] !== undefined) return json(overrides[at]);
    if (at === "/healthz") return json({ ok: true, data: { role: "admin-backend", version: "t", revision: 1, tmdb: "configured" } });
    if (at === "/api/titles/genres") return json(url.searchParams.get("kind") === "tv" ? TV_GENRES : GENRES);
    if (at === "/api/titles/movie-603") return json(MATRIX);
    if (at === "/api/titles/tv-1399") return json(GOT);
    if (at === "/api/titles/tv-1399/seasons/1") return json(SEASON);
    if (at === "/api/titles/movie-603/recommendations") return json(RECOMMENDED);
    if (at === "/api/titles") {
      if (url.searchParams.get("genre") !== null) return json({ ok: true, data: { items: [FIGHT_CLUB_ROW], page: 1, totalPages: 1, totalResults: 1 } });
      const page = Number(url.searchParams.get("page") ?? "1");
      const rows = url.searchParams.get("kind") === "tv" ? [{ id: "tv-1399", kind: "tv", title: "Game of Thrones", year: 2011, genres: ["18"], rating: 8.4, posterUrl: POSTER }, LATE_TV_ROW] : [{ id: "movie-603", kind: "movie", title: "The Matrix", year: 1999, genres: ["878"], rating: 8.2, posterUrl: POSTER }, FIGHT_CLUB_ROW];
      return json({ ok: true, data: { items: page === 1 ? [rows[0]] : [rows[1]], page, totalPages: 2, totalResults: 2 } });
    }
    return json({ ok: false, error: { code: "title.not_found", message: "no such title" } }, 404);
  }) as typeof fetch;
}

async function seamApp(overrides: Record<string, unknown> = {}): Promise<{ app: FastifyInstance; close: () => Promise<void> }> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-titles-"));
  const app = await buildApp({ dataDir, adminFetch: titlesSeam(overrides), logger: false, syncOnStart: false });
  return { app, close: async () => { await app.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

test("a detail passes through with rewritten images, cast of ten, and the backend's sources", async () => {
  const t = await seamApp();
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(detail.status, 200);
  assert.equal(pick(detail.body, "data.title"), "The Matrix");
  assert.equal(pick(detail.body, "data.posterUrl"), `/api/images/${imageIdOf(POSTER)}`);
  assert.equal(pick(detail.body, "data.backdropUrl"), `/api/images/${imageIdOf(BACKDROP)}`);
  assert.equal(pick(detail.body, "data.cast.length"), 10, "at most ten names (03 section 3.6)");
  assert.equal(pick(detail.body, "data.runtimeMs"), 8_160_000);
  assert.equal(pick(detail.body, "data.streamUrl"), STREAM, "passed through as the backend filled it");
  assert.deepEqual(pick(detail.body, "data.sources"), MOVIE_SOURCES, "in the backend's preference order (03 section 7.5)");
  assert.equal(pick(detail.body, "data.providers"), undefined, "provider records stop at the fileserver (22 section 8.4)");
  await t.close();
});

test("a series answers seasons; a season answers episodes in order with rewritten stills", async () => {
  const t = await seamApp();
  const series = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(series.body, "data.seasons"), [{ season: 1, episodeCount: 2 }]);
  assert.equal(pick(series.body, "data.runtimeMs"), undefined, "a series carries no movie runtime");
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  const episodes = pick(season.body, "data.episodes") as Array<{ episode: number; stillUrl?: string; streamUrl?: string; sources?: unknown }>;
  assert.deepEqual(episodes.map((one) => one.episode), [1, 2], "in episode order (03 section 3.6)");
  assert.equal(episodes[0]?.stillUrl, `/api/images/${imageIdOf(STILL)}`);
  assert.equal(episodes[0]?.streamUrl, "https://streams.example.test/tv-1399-1-1.m3u8");
  assert.deepEqual(episodes[0]?.sources, EPISODE_SOURCES, "the episode's own sources (03 section 7.5)");
  assert.equal(episodes[1]?.sources, undefined, "an episode without sources answers none");
  assert.equal(pick(season.body, "data.providers"), undefined);
  await t.close();
});

test("related answers TMDB's recommendations, the row's genres decoded", async () => {
  const t = await seamApp();
  const related = await send(t.app, "GET", "/api/titles/movie-603/related");
  assert.equal(pick(related.body, "data.basis"), "tmdb");
  assert.equal(pick(related.body, "data.items.0.ref.id"), "movie-550");
  assert.equal(pick(related.body, "data.items.0.title"), "Fight Club");
  assert.deepEqual(pick(related.body, "data.items.0.genres"), ["Science Fiction"], "ids decoded through the genre list");
  await t.close();
});

test("with no recommendations the band falls back to genre and year", async () => {
  const t = await seamApp({ "/api/titles/movie-603/recommendations": { ok: true, data: { items: [] } } });
  const related = await send(t.app, "GET", "/api/titles/movie-603/related");
  assert.equal(pick(related.body, "data.basis"), "genre-year");
  assert.equal(pick(related.body, "data.items.0.ref.id"), "movie-550");
  await t.close();
});

test("an unknown title is 404 title.not_found", async () => {
  const t = await seamApp();
  const missing = await send(t.app, "GET", "/api/titles/movie-999");
  assert.equal(missing.status, 404);
  assert.equal(pick(missing.body, "error.code"), "title.not_found");
  await t.close();
});

test("the library browses the backend's pages with flags, facets and a cursor", async () => {
  const t = await seamApp();
  const first = await send(t.app, "GET", "/api/library");
  assert.equal(pick(first.body, "data.titlesAvailable"), true);
  assert.equal(pick(first.body, "data.trending"), true);
  assert.equal(pick(first.body, "data.total"), 4);
  assert.deepEqual(pick(first.body, "data.facets.genres"), ["Science Fiction", "Drama"]);
  assert.equal(pick(first.body, "data.items.0.ref.id"), "movie-603");
  assert.equal(pick(first.body, "data.items.0.posterUrl"), `/api/images/${imageIdOf(POSTER)}`);
  assert.equal(pick(first.body, "data.items.1.ref.id"), "tv-1399");
  assert.equal(pick(first.body, "data.items.0.rating"), 8.2, "the card carries the rating, unrounded");
  assert.equal(pick(first.body, "data.items.1.rating"), 8.4);
  const cursor = pick(first.body, "data.nextCursor");
  assert.ok(typeof cursor === "string");
  const second = await send(t.app, "GET", `/api/library?cursor=${encodeURIComponent(String(cursor))}`);
  assert.deepEqual((pick(second.body, "data.items") as Array<{ ref: { id: string } }>).map((one) => one.ref.id), ["movie-550", "tv-9999"]);
  assert.equal(pick(second.body, "data.nextCursor"), undefined);
  await t.close();
});

test("the backend down answers 503; the library stays usable and refuses trending", async () => {
  const t = await makeApp();
  await send(t.app, "PATCH", "/api/settings", { adminUrl: "http://127.0.0.1:1" });
  const down = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(down.status, 503);
  assert.equal(pick(down.body, "error.code"), "backend.unreachable");
  const library = await send(t.app, "GET", "/api/library");
  assert.equal(library.status, 200);
  assert.equal(pick(library.body, "data.titlesAvailable"), false);
  const trending = await send(t.app, "GET", "/api/library?sort=trending");
  assert.equal(trending.status, 422);
  assert.equal(pick(trending.body, "error.code"), "library.invalid");
  await t.dispose();
});

test("against the real backend (TMDB absent) the pass-through answers honestly", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);
  const title = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(title.status, 503);
  assert.equal(pick(title.body, "error.code"), "backend.unreachable");
  const library = await send(t.app, "GET", "/api/library");
  assert.equal(pick(library.body, "data.titlesAvailable"), false);
  assert.equal(pick(library.body, "data.trending"), false);
  await t.dispose();
});
