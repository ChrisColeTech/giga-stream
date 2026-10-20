import assert from "node:assert/strict";
import test from "node:test";

import { imageIdOf } from "../src/services/image-cache-service.js";
import { makeAdminDatabase, seedTitle } from "./admin-database.js";
import { makeApp, pick, send } from "./app-fixture.js";

const POSTER = "https://image.tmdb.org/t/p/w500/matrix.jpg";
const BACKDROP = "https://image.tmdb.org/t/p/w1280/matrix-b.jpg";
const STILL = "https://image.tmdb.org/t/p/w300/ep1.jpg";
const STREAM = "https://streams.example.test/movie-603.m3u8";

const providers = [
  {
    id: 2, name: "VidSrc", source: "vidsrc", is_active: true, order: 1, family: "embed",
    movieTemplate: "https://vidsrc.example/embed/movie?tmdbId={tmdbId}",
    episodeTemplate: "https://vidsrc.example/embed/tv?tmdbId={tmdbId}&season={season}&episode={episode}",
    origin: "https://vidsrc.example", startParam: "startAt", created_at: "2026-10-20T00:00:00Z",
  },
  {
    id: 4, name: "VidZee", source: "vidzee", is_active: true, order: 2, family: "embed",
    movieTemplate: "https://vidzee.example/embed/movie-{tmdbId}", origin: "https://vidzee.example",
    frameOrigins: ["https://vidzee.example"], created_at: "2026-10-20T00:00:00Z",
  },
];

const providerFetch: typeof fetch = async (input) => {
  assert.equal(new URL(String(input)).pathname, "/api/admin/providers");
  return new Response(JSON.stringify({ ok: true, data: { items: providers } }), {
    status: 200, headers: { "content-type": "application/json" },
  });
};

async function boot() {
  const database = await makeAdminDatabase();
  await database.executeMultiple(`
    INSERT INTO title_genres VALUES ('movie', 878, 'Science Fiction');
    INSERT INTO title_genres VALUES ('tv', 18, 'Drama');
  `);
  await seedTitle(database, {
    id: "movie-603", kind: "movie", title: "The Matrix", genres: ["Science Fiction"], popularity: 90,
    extra: {
      year: 1999, rating: 8.2, plot: "A computer hacker learns the truth.", posterUrl: POSTER,
      backdropUrl: BACKDROP, runtimeMs: 8_160_000, streamUrl: STREAM,
      cast: Array.from({ length: 11 }, (_, at) => `Actor ${at}`),
    },
  });
  await seedTitle(database, {
    id: "movie-550", kind: "movie", title: "Fight Club", genres: ["Science Fiction"],
    popularity: 80, extra: { year: 1999, rating: 8.4, posterUrl: POSTER },
  });
  await seedTitle(database, {
    id: "tv-1399", kind: "tv", title: "Game of Thrones", genres: ["Drama"], popularity: 70,
    extra: {
      year: 2011, rating: 8.4, seasons: [{
        season: 1, episodeCount: 2, episodes: [
          {
            season: 1, episode: 2, title: "The Kingsroad", airDate: "2011-04-24",
            runtimeMs: 3_300_000, stillUrl: "https://image.tmdb.org/t/p/w300/ep2.jpg",
          },
          {
            season: 1, episode: 1, title: "Winter Is Coming", airDate: "2011-04-17",
            runtimeMs: 3_720_000, stillUrl: STILL,
          },
        ],
      }],
    },
  });
  await seedTitle(database, {
    id: "tv-9999", kind: "tv", title: "Late Row", genres: ["Drama"],
    popularity: 60, extra: { year: 2020, rating: 7.1, posterUrl: POSTER },
  });
  return { database, t: await makeApp({ adminDatabase: database, adminFetch: providerFetch }) };
}

test("detail rewrites images, truncates cast, generates sources, and hides stored episodes", async () => {
  const { t } = await boot();
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.title"), "The Matrix");
  assert.equal(pick(detail.body, "data.posterUrl"), `/api/images/${imageIdOf(POSTER)}`);
  assert.equal(pick(detail.body, "data.backdropUrl"), `/api/images/${imageIdOf(BACKDROP)}`);
  assert.equal(pick(detail.body, "data.cast.length"), 10);
  assert.equal(pick(detail.body, "data.streamUrl"), STREAM);
  assert.equal(pick(detail.body, "data.sources.0.url"), "https://vidsrc.example/embed/movie?tmdbId=603");
  const series = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(series.body, "data.seasons"), [{ season: 1, episodeCount: 2 }]);
  assert.equal(pick(series.body, "data.seasons.0.episodes"), undefined);
  await t.dispose();
});

test("season answers episodes in order with rewritten stills and request-local sources", async () => {
  const { t } = await boot();
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.deepEqual([
    pick(season.body, "data.episodes.0.episode"), pick(season.body, "data.episodes.1.episode"),
  ], [1, 2]);
  assert.equal(pick(season.body, "data.episodes.0.stillUrl"), `/api/images/${imageIdOf(STILL)}`);
  assert.equal(
    pick(season.body, "data.episodes.0.sources.0.url"),
    "https://vidsrc.example/embed/tv?tmdbId=1399&season=1&episode=1",
  );
  await t.dispose();
});

test("related preserves tmdb basis and falls back to cached genre-year when authoritative rows disappear", async () => {
  const { database, t } = await boot();
  await send(t.app, "POST", "/api/library/refresh");
  const related = await send(t.app, "GET", "/api/titles/movie-603/related");
  assert.equal(pick(related.body, "data.basis"), "tmdb");
  assert.equal(pick(related.body, "data.items.0.ref.id"), "movie-550");
  await database.execute("DELETE FROM titles WHERE id = 'movie-550'");
  const fallback = await send(t.app, "GET", "/api/titles/movie-603/related");
  assert.equal(pick(fallback.body, "data.basis"), "genre-year");
  assert.equal(pick(fallback.body, "data.items.0.ref.id"), "movie-550");
  await t.dispose();
});

test("library catalog carries flags, decoded genres, facets, paging facts and exact total", async () => {
  const { t } = await boot();
  const page = await send(t.app, "GET", "/api/library");
  assert.equal(pick(page.body, "data.titlesAvailable"), true);
  assert.equal(pick(page.body, "data.trending"), true);
  assert.equal(pick(page.body, "data.total"), 4);
  assert.deepEqual(pick(page.body, "data.facets.genres"), ["Drama", "Science Fiction"]);
  assert.deepEqual(
    (pick(page.body, "data.items") as Array<{ ref: { id: string } }>).map((item) => item.ref.id),
    ["tv-9999", "tv-1399", "movie-603", "movie-550"],
  );
  await t.dispose();
});

test("unknown and malformed stored titles distinguish 404 and 502", async () => {
  const { database, t } = await boot();
  const missing = await send(t.app, "GET", "/api/titles/movie-999");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "title.not_found"]);
  await database.execute("UPDATE titles SET payload = '{}' WHERE id = 'movie-603'");
  const malformed = await send(t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual([malformed.status, pick(malformed.body, "error.code")], [502, "backend.bad_response"]);
  await t.dispose();
});
