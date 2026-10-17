// TMDB already sorted the rows it answers: with no title made by hand the list is TMDB's, untouched; a manual title
// is slotted in by the requested sort's key and the TMDB rows keep their order.
import assert from "node:assert/strict";
import test from "node:test";

import { itemsOf } from "./live-channel-kit.js";
import { makeApp, send, signIn } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

/** Three rows in an order no sort of ours would give: 2026, 1999, 2010. */
const ROWS = [
  { id: 701, title: "Zed", release_date: "2026-01-01", vote_average: 5, popularity: 9, genre_ids: [] },
  { id: 603, title: "Matrix", release_date: "1999-03-31", vote_average: 8, popularity: 8, genre_ids: [] },
  { id: 702, title: "Alpha", release_date: "2010-01-01", vote_average: 6, popularity: 7, genre_ids: [] },
];

async function setup() {
  const tmdb = await stubTmdb({ movieRows: ROWS });
  const t = await makeApp({ config: tmdbOn(tmdb) });
  return { t, token: (await signIn(t.app)).access };
}
const titles = async (t: Awaited<ReturnType<typeof setup>>["t"], url: string) =>
  itemsOf((await send(t.app, "GET", url)).body).map((i) => i.title);

test("with no manual title, browse and search answer TMDB's rows in TMDB's order, whatever the sort", async () => {
  const { t } = await setup();
  for (const sort of ["newest", "oldest", "az", "year", "trending"]) {
    assert.deepEqual(await titles(t, `/api/titles?kind=movie&sort=${sort}`), ["Zed", "Matrix", "Alpha"], sort);
  }
  assert.deepEqual(await titles(t, "/api/titles/search?kind=movie&q=a"), ["Zed", "Matrix", "Alpha"]);
});

test("a manual title is placed by the sort's key; the TMDB rows keep their order around it", async () => {
  const { t, token } = await setup();
  await send(t.app, "POST", "/api/titles", { kind: "movie", title: "Mine", year: 2015 }, token);
  // Newest first: Mine (2015) goes before the first row it outranks, 1999.
  assert.deepEqual(await titles(t, "/api/titles?kind=movie&sort=newest"), ["Zed", "Mine", "Matrix", "Alpha"]);
  // Oldest first: before the first row that is newer than 2015, which is 2026.
  assert.deepEqual(await titles(t, "/api/titles?kind=movie&sort=oldest"), ["Mine", "Zed", "Matrix", "Alpha"]);
  // A-Z: "Mine" sorts before "Zed".
  assert.deepEqual(await titles(t, "/api/titles?kind=movie&sort=az"), ["Mine", "Zed", "Matrix", "Alpha"]);
  // Trending: a manual title has no popularity, so it ends the page.
  assert.deepEqual(await titles(t, "/api/titles?kind=movie&sort=trending"), ["Zed", "Matrix", "Alpha", "Mine"]);
  // A filter it does not match leaves TMDB's answer alone.
  assert.deepEqual(await titles(t, "/api/titles?kind=movie&sort=newest&year=1999"), ["Zed", "Matrix", "Alpha"]);
});

test("manual titles are ordered among themselves by the sort", async () => {
  const { t, token } = await setup();
  for (const [title, year] of [["Old", 1980], ["New", 2024]] as const) {
    await send(t.app, "POST", "/api/titles", { kind: "movie", title, year }, token);
  }
  // 2024 goes before 1999 (the first row it outranks), 1980 after every row.
  assert.deepEqual(await titles(t, "/api/titles?kind=movie&sort=newest"), ["Zed", "New", "Matrix", "Alpha", "Old"]);
});
