import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { makeApp, pick, send } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

test("detail and browse caches retain separate shapes and fresh popularity after restart", async () => {
  const tmdb = await stubTmdb({ movieRows: [{ id: 603, title: "The Matrix", popularity: 321, genre_ids: [878] }] });
  const dataDir = mkdtempSync(path.join(tmpdir(), "catalog-shapes-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  try {
    await send(first.app, "GET", "/api/titles/movie-603");
    const initial = await send(first.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
    const cached = await send(first.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
    assert.equal(initial.status, 200);
    assert.deepEqual(cached.body, initial.body);
    assert.equal(pick(cached.body, "data.items.0.popularity.score"), 321);
    const detail = await send(first.app, "GET", "/api/titles/movie-603");
    assert.equal(pick(detail.body, "data.cast.0"), "Keanu Reeves");
    assert.equal(pick(detail.body, "data.listSnapshot"), undefined);
    await first.dispose();
    const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
    try {
      const restarted = await send(second.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
      assert.deepEqual(restarted.body, initial.body);
      assert.equal(tmdb.calls.filter((call) => call.startsWith("/discover/movie")).length, 1);
    } finally { await second.dispose(); }
  } finally { await first.dispose(); rmSync(dataDir, { recursive: true, force: true }); }
});

test("browse refills a cached row with malformed public fields rather than publishing it", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(tmpdir(), "catalog-invalid-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  await send(first.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  await first.dispose();
  const db = new DatabaseSync(path.join(dataDir, "admin.db"));
  db.prepare("UPDATE titles SET payload = ? WHERE tmdb_id = 603").run(JSON.stringify({
    id: "movie-603", tmdbId: 603, kind: "movie", shape: "list", title: "The Matrix", genres: 7,
  }));
  db.close();
  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  try {
    const refilled = await send(second.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
    assert.equal(refilled.status, 200);
    assert.deepEqual(pick(refilled.body, "data.items.0.genres"), ["878"]);
    assert.equal(tmdb.calls.filter((call) => call.startsWith("/discover/movie")).length, 2);
  } finally { await second.dispose(); rmSync(dataDir, { recursive: true, force: true }); }
});

test("TV discover uses TV date, title and year parameters", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  try {
    for (const [sort, expected] of [["newest", "first_air_date.desc"], ["az", "name.asc"]]) {
      await send(t.app, "GET", `/api/titles?kind=tv&sort=${sort}&year=2020&page=1`);
      const request = new URL(tmdb.calls.filter((call) => call.startsWith("/discover/tv")).at(-1)!, tmdb.base);
      assert.equal(request.searchParams.get("sort_by"), expected);
      assert.equal(request.searchParams.get("first_air_date_year"), "2020");
      assert.equal(request.searchParams.has("primary_release_year"), false);
      assert.equal(request.searchParams.get("vote_count.gte"), "50");
    }
  } finally { await t.dispose(); }
});
