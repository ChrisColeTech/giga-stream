import assert from "node:assert/strict";
import test from "node:test";

import { validateAdminSchema } from "../src/store/admin-database.js";
import { makeApp, pick, send } from "./app-fixture.js";
import { makeAdminDatabase, seedTitle } from "./admin-database.js";

const provider = {
  id: 4, name: "Embed", source: "embed", is_active: true, order: 0, family: "embed",
  movieTemplate: "https://player.example/movie/{tmdbId}",
  episodeTemplate: "https://player.example/tv/{tmdbId}/{season}/{episode}",
  created_at: "2026-10-20T00:00:00.000Z",
};

function providerFetch(seen: string[], fail = false): typeof fetch {
  return async (input, init) => {
    seen.push(`${init?.method ?? "GET"} ${String(input)}`);
    if (fail) throw new Error("provider offline");
    return new Response(JSON.stringify({ ok: true, data: { items: [provider] } }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
}

test("startup schema validation refuses an unsupported admin schema", async () => {
  const database = await makeAdminDatabase();
  await database.execute("UPDATE giga_stream_schema_version SET version = 31 WHERE id = 1");
  await assert.rejects(validateAdminSchema(database), /must be version 32/);
  database.close();
});

test("malformed stored channel data is classified as 502", async () => {
  const t = await makeApp();
  await t.adminDatabase.execute({
    sql: `INSERT INTO channels
      (id, name, category, stream_url, revision, created_at, kind, enabled)
      VALUES ('bad', 'Bad', 'Test', 'http://stream.test/bad', 'not-a-number', 1, 'stream', 1)`,
    args: [],
  });
  const bad = await send(t.app, "POST", "/api/channels/refresh");
  assert.deepEqual([bad.status, pick(bad.body, "error.code")], [502, "backend.bad_response"]);
  await t.dispose();
});

test("channel and title cache fills read the admin database without an admin API call", async () => {
  const seen: string[] = [];
  const t = await makeApp({ adminFetch: providerFetch(seen) });
  await t.adminDatabase.execute({
    sql: `INSERT INTO playlists (id, name, kind, file_name, enabled, created_at)
      VALUES (1, 'News list', 'file', 'news.m3u', 1, 1)`, args: [],
  });
  await t.adminDatabase.execute(`INSERT INTO channels
    (id, name, category, number, stream_url, revision, created_at, kind,
      live_mode, live_captions, live_variants, enabled)
    VALUES ('live', 'Live', 'News', '1', NULL, 7, 1, 'live', 'loop', 0, '[]', 1)`);
  await t.adminDatabase.execute(`INSERT INTO playlists
    (id, name, kind, file_name, enabled, created_at) VALUES (2, 'Hidden list', 'file', 'hidden.m3u', 0, 1)`);
  await t.adminDatabase.execute(`INSERT INTO channels
    (id, name, category, stream_url, revision, created_at, kind, sync_name, enabled, playlist_id)
    VALUES ('hidden', 'Hidden', 'News', 'http://stream.test/hidden', 7, 1, 'stream', 'Hidden', 1, 2)`);
  await t.adminDatabase.execute({
    sql: `INSERT INTO channels (id, name, category, number, logo_url, logo_file, stream_url, kind,
      revision, created_at, enabled, playlist_id, sync_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?)`,
    args: [
      "news", "News", "News", "2", null, "abcd.png", "http://stream.test/news", "stream", 7, "News",
    ],
  });
  await t.adminDatabase.execute("UPDATE backend_revision SET revision = 7 WHERE id = 1");
  await t.adminDatabase.execute({
    sql: "INSERT INTO title_genres (kind, genre_id, name) VALUES ('movie', 28, 'Action')", args: [],
  });
  await seedTitle(t.adminDatabase, {
    id: "movie-42", kind: "movie", title: "Direct", genres: ["Action"], popularity: 99,
    extra: { year: 2026, plot: "Stored metadata.", cast: ["One"] },
  });

  assert.equal((await send(t.app, "POST", "/api/channels/refresh")).status, 200);
  assert.equal((await send(t.app, "POST", "/api/library/refresh")).status, 200);
  const channels = await send(t.app, "GET", "/api/channels");
  const library = await send(t.app, "GET", "/api/library?q=Direct");
  assert.deepEqual(
    (pick(channels.body, "data.items") as Array<{ id: string }>).map((item) => item.id),
    ["live", "news"],
  );
  assert.equal(pick(channels.body, "data.items.0.streamUrl"), "http://127.0.0.1:8091/live/live/master.m3u8");
  assert.match(String(pick(channels.body, "data.items.0.logoUrl")), /^\/api\/images\//);
  assert.equal(pick(library.body, "data.items.0.title"), "Direct");
  assert.deepEqual(seen, [], "cache operations make no admin HTTP request");
  await t.dispose();
});

test("detail and episodes use stored payloads and only request providers", async () => {
  const seen: string[] = [];
  const t = await makeApp({ adminFetch: providerFetch(seen) });
  await seedTitle(t.adminDatabase, {
    id: "movie-42", kind: "movie", title: "Direct", genres: ["Action"],
    extra: { plot: "Stored metadata.", cast: ["One"] },
  });
  await seedTitle(t.adminDatabase, {
    id: "tv-7", kind: "tv", title: "Series", genres: ["Drama"],
    extra: { seasons: [{ season: 1, episodeCount: 1, episodes: [{ season: 1, episode: 1, title: "Pilot" }] }] },
  });
  const detail = await send(t.app, "GET", "/api/titles/movie-42");
  const season = await send(t.app, "GET", "/api/titles/tv-7/seasons/1");
  assert.equal(pick(detail.body, "data.plot"), "Stored metadata.");
  assert.equal(pick(detail.body, "data.sources.0.url"), "https://player.example/movie/42");
  assert.equal(pick(season.body, "data.episodes.0.sources.0.url"), "https://player.example/tv/7/1/1");
  assert.deepEqual(seen, [
    "GET http://127.0.0.1:8091/api/admin/providers",
    "GET http://127.0.0.1:8091/api/admin/providers",
  ]);
  await t.dispose();
});

test("provider failure keeps title metadata and forbidden proxy prefixes stay local", async () => {
  const seen: string[] = [];
  const t = await makeApp({ adminFetch: providerFetch(seen, true) });
  await seedTitle(t.adminDatabase, { id: "movie-9", kind: "movie", title: "Held", extra: { plot: "Still here." } });
  await seedTitle(t.adminDatabase, {
    id: "tv-9", kind: "tv", title: "Held Series",
    extra: { seasons: [{ season: 1, episodeCount: 1, episodes: [{ season: 1, episode: 1, title: "Held Pilot" }] }] },
  });
  const detail = await send(t.app, "GET", "/api/titles/movie-9");
  assert.equal(detail.status, 200);
  assert.equal(pick(detail.body, "data.plot"), "Still here.");
  assert.equal(pick(detail.body, "data.sources"), undefined);
  const season = await send(t.app, "GET", "/api/titles/tv-9/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.title"), "Held Pilot");
  assert.equal(pick(season.body, "data.episodes.0.sources"), undefined);
  for (const path of ["/api/admin/channels", "/api/account/not-a-route"]) {
    const answer = await send(t.app, "GET", path);
    assert.equal(answer.status, 404);
  }
  const localAdmin = await t.app.inject({ method: "GET", url: "/admin/" });
  assert.ok([200, 404].includes(localAdmin.statusCode));
  assert.equal(localAdmin.body.includes('"path":"/"'), false, "not an upstream echo");
  if (localAdmin.statusCode === 200) {
    assert.match(String(localAdmin.headers["content-type"]), /^text\/html/);
    assert.match(localAdmin.body, /^<!doctype html>/i);
  }
  assert.deepEqual(seen, [
    "GET http://127.0.0.1:8091/api/admin/providers",
    "GET http://127.0.0.1:8091/api/admin/providers",
  ]);
  await t.dispose();
});
