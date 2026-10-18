import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { fillLibrary, stubTmdb, tmdbOn } from "./title-stubs.js";
import type { Config } from "../src/config.js";

const MOVIE_TEMPLATE = "https://streams.example/movie/{tmdbId}/index.m3u8";
const EPISODE_TEMPLATE = "https://streams.example/tv/{tmdbId}/{season}/{episode}/index.m3u8";
const HTTP_TEMPLATE = "http://127.0.0.1:8091/live/fx-sports/master.m3u8";

const FIRST = {
  name: "First", source: "first", order: 1, family: "embed",
  movieTemplate: "https://first.example/movie/{tmdbId}",
  episodeTemplate: "https://first.example/tv/{tmdbId}/{season}/{episode}",
  startParam: "startAt",
  origin: "https://first.example",
  messageShape: "player-event",
};

const SECOND = {
  name: "Second", source: "second", order: 2, family: "embed",
  movieTemplate: "https://second.example/embed/movie/{tmdbId}",
  episodeTemplate: "https://second.example/embed/tv/{tmdbId}/{season}/{episode}",
};

const SLEEPY = { name: "Sleepy", source: "sleepy", order: 0, family: "embed",
  movieTemplate: "https://sleepy.example/movie/{tmdbId}",
  episodeTemplate: "https://sleepy.example/tv/{tmdbId}/{season}/{episode}" };

const STREAM = { name: "Strm", source: "strm", order: 0, family: "stream",
  movieTemplate: "https://strm.example/movie/{tmdbId}" };

const BARE = { name: "Bare", source: "bare", order: 0, family: "embed" };

/** An app whose providers cover every rule: two active templated embeds, an inactive one, a stream and a bare one. */
async function appWithProviders(config: Partial<Config> = {}) {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { ...tmdbOn(tmdb), ...config } });
  const access = (await signIn(t.app)).access;
  for (const entry of [FIRST, SECOND, SLEEPY, STREAM, BARE]) {
    const created = await send(t.app, "POST", "/api/providers", entry, access);
    assert.equal(created.status, 201, `${entry.source} is created`);
  }
  deactivate(t, "sleepy");
  await fillLibrary(t);
  return t;
}

/** POST cannot create an inactive provider, so the test writes the row as the store holds it. */
function deactivate(t: Awaited<ReturnType<typeof makeApp>>, source: string): void {
  const db = new DatabaseSync(path.join(t.dataDir, "admin.db"));
  db.exec(`UPDATE providers SET is_active = 0 WHERE source = '${source}'`);
  db.close();
}

test("a movie detail answers one source per active templated embed provider, in order", async () => {
  const t = await appWithProviders();
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(detail.status, 200);
  assert.equal(pick(detail.body, "data.sources.length"), 2);
  assert.equal(pick(detail.body, "data.sources.0.name"), "First");
  assert.equal(pick(detail.body, "data.sources.0.url"), "https://first.example/movie/603");
  assert.equal(pick(detail.body, "data.sources.0.origin"), "https://first.example");
  assert.equal(pick(detail.body, "data.sources.0.order"), 1);
  assert.equal(pick(detail.body, "data.sources.0.startParam"), "startAt");
  assert.equal(pick(detail.body, "data.sources.0.messageShape"), "player-event");
  assert.equal(pick(detail.body, "data.sources.1.name"), "Second");
  assert.equal(pick(detail.body, "data.sources.1.url"), "https://second.example/embed/movie/603");
  // An originless provider's source speaks for its own embed page.
  assert.equal(pick(detail.body, "data.sources.1.origin"), "https://second.example");
  assert.equal(pick(detail.body, "data.sources.1.startParam"), undefined);
  await t.dispose();
});

test("a season's episodes carry each episode's exact sources", async () => {
  const t = await appWithProviders();
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(season.status, 200);
  assert.equal(pick(season.body, "data.episodes.0.sources.length"), 2);
  assert.equal(pick(season.body, "data.episodes.0.sources.0.url"), "https://first.example/tv/1399/1/1");
  assert.equal(pick(season.body, "data.episodes.0.sources.1.url"), "https://second.example/embed/tv/1399/1/1");
  await t.dispose();
});

test("an inactive provider stops yielding sources at once", async () => {
  const t = await appWithProviders();
  deactivate(t, "first");
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.sources.length"), 1);
  assert.equal(pick(detail.body, "data.sources.0.name"), "Second");
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.sources.length"), 1);
  await t.dispose();
});

test("a title with no sources carries no sources key at all", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) }); // no providers seeded
  await fillLibrary(t);
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  const data = pick(detail.body, "data") as Record<string, unknown>;
  assert.equal(Object.hasOwn(data, "sources"), false);
  await t.dispose();
});

test("a series detail, a recommendation and a catalog row never carry sources", async () => {
  const t = await appWithProviders();
  const series = await send(t.app, "GET", "/api/titles/tv-1399");
  const seriesData = pick(series.body, "data") as Record<string, unknown>;
  assert.equal(Object.hasOwn(seriesData, "sources"), false);

  const catalog = await send(t.app, "GET", "/api/titles/catalog");
  const row = pick(catalog.body, "data.items.0") as Record<string, unknown>;
  assert.equal(Object.hasOwn(row, "sources"), false);
  const related = (pick((await send(t.app, "GET", "/api/titles/movie-603/recommendations")).body, "data.items") as unknown[]);
  assert.ok(related.every((item) => !Object.hasOwn(item as Record<string, unknown>, "sources")));
  await t.dispose();
});

test("a set movie template fills the detail's streamUrl", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { ...tmdbOn(tmdb), MOVIE_STREAM_TEMPLATE: MOVIE_TEMPLATE } });
  await fillLibrary(t);
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.streamUrl"), "https://streams.example/movie/603/index.m3u8");
  await t.dispose();
});

test("a set episode template fills each episode's streamUrl", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { ...tmdbOn(tmdb), EPISODE_STREAM_TEMPLATE: EPISODE_TEMPLATE } });
  await fillLibrary(t);
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.streamUrl"), "https://streams.example/tv/1399/1/1/index.m3u8");
  await t.dispose();
});

test("a template that is not set answers no streamUrl key", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  await fillLibrary(t);
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  const data = pick(detail.body, "data") as Record<string, unknown>;
  assert.equal(Object.hasOwn(data, "streamUrl"), false);
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  const episode = pick(season.body, "data.episodes.0") as Record<string, unknown>;
  assert.equal(Object.hasOwn(episode, "streamUrl"), false);
  await t.dispose();
});

test("a plain http template fills the dev stream; one with credentials or another scheme is omitted", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: { ...tmdbOn(tmdb), MOVIE_STREAM_TEMPLATE: HTTP_TEMPLATE } });
  await fillLibrary(t);
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.streamUrl"), HTTP_TEMPLATE);
  await t.dispose();
  for (const bad of ["http://u:p@127.0.0.1:8091/{tmdbId}.m3u8", "ftp://streams.example/{tmdbId}.m3u8"]) {
    const other = await makeApp({ config: { ...tmdbOn(tmdb), MOVIE_STREAM_TEMPLATE: bad } });
    await fillLibrary(other);
    const data = pick((await send(other.app, "GET", "/api/titles/movie-603")).body, "data") as Record<string, unknown>;
    assert.equal(Object.hasOwn(data, "streamUrl"), false, bad);
    await other.dispose();
  }
});

test("a movie may carry streamUrl and sources together; neither displaces the other", async () => {
  const t = await appWithProviders({ MOVIE_STREAM_TEMPLATE: MOVIE_TEMPLATE });
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.streamUrl"), "https://streams.example/movie/603/index.m3u8");
  assert.equal(pick(detail.body, "data.sources.length"), 2);
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.sources.length"), 2);
  assert.equal(pick(season.body, "data.episodes.0.streamUrl"), undefined, "only the episode template fills episodes");
  await t.dispose();
});
