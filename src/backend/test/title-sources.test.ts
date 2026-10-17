import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

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
async function appWithProviders() {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const access = (await signIn(t.app)).access;
  for (const entry of [FIRST, SECOND, SLEEPY, STREAM, BARE]) {
    const created = await send(t.app, "POST", "/api/providers", entry, access);
    assert.equal(created.status, 201, `${entry.source} is created`);
  }
  deactivate(t, "sleepy");
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
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  const data = pick(detail.body, "data") as Record<string, unknown>;
  assert.equal(Object.hasOwn(data, "sources"), false);
  await t.dispose();
});

test("a series detail and a browse page never carry sources", async () => {
  const t = await appWithProviders();
  const series = await send(t.app, "GET", "/api/titles/tv-1399");
  const seriesData = pick(series.body, "data") as Record<string, unknown>;
  assert.equal(Object.hasOwn(seriesData, "sources"), false);

  const page = await send(t.app, "GET", "/api/titles?kind=movie&sort=trending&page=1");
  const row = pick(page.body, "data.items.0") as Record<string, unknown>;
  assert.equal(Object.hasOwn(row, "sources"), false);
  await t.dispose();
});
