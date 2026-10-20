// A title the admin deletes or disables leaves the backend's catalog; the next sync's sweep removes it from the cache,
// so it is absent from every page, count, facet and search (docs/46 section B, docs/03 section 7.4).
import assert from "node:assert/strict";
import test from "node:test";

import { pick, send } from "./app-fixture.js";
import { manyMovies } from "./fake-titles.js";
import { allPages, bootTitles, idsOf, peek, syncTitles } from "./library-fixture.js";

test("a deleted title is absent from the next sync's cache: pages, total, search and its genre rows", async () => {
  const catalog = manyMovies(45);
  const { backend, t } = await bootTitles(catalog);
  await syncTitles(t);
  assert.equal(pick((await send(t.app, "GET", "/api/library")).body, "data.total"), 45);
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/library?q=Movie%20007")).body), ["movie-007"]);

  backend.publish(catalog.filter((one) => one.id !== "movie-007" && one.id !== "movie-040"));
  t.clock.advance(1_000);
  assert.equal((await syncTitles(t)).status, 200);

  const pages = await allPages(t, "sort=az");
  assert.deepEqual(pages.map((page) => idsOf(page.body).length), [20, 20, 3]);
  for (const page of pages) assert.equal(pick(page.body, "data.total"), 43);
  const all = pages.flatMap((page) => idsOf(page.body));
  assert.equal(all.includes("movie-007"), false);
  assert.equal(all.includes("movie-040"), false);
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/library?q=Movie%20007")).body), []);
  assert.deepEqual(peek(t, "SELECT COUNT(*) AS n FROM cached_title_genres WHERE title_id = 'movie-007'"), [{ n: 0 }]);
  await t.dispose();
});

test("a deleted title that was only in a watch entry is a skeleton row, never a failure", async () => {
  const catalog = manyMovies(3);
  const { backend, t } = await bootTitles(catalog);
  await syncTitles(t);
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "movie-002" }, positionMs: 100, durationMs: 90_000, playbackId: "p", seq: 1 });
  backend.publish(catalog.filter((one) => one.id !== "movie-002"));
  t.clock.advance(1_000);
  await syncTitles(t);
  const history = await send(t.app, "GET", "/api/library?view=history");
  assert.equal(history.status, 200);
  assert.equal(pick(history.body, "data.items.0.title"), "movie-002", "the id's readable form, no invented facts");
  await t.dispose();
});
