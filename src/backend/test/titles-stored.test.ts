// `GET /api/titles/stored` (docs/41 sections 3.2 and 3.4): 150 titles seeded in the store (movie and tv, synced and
// made by hand, edited, disabled), read page by page from the store alone, with TMDB's stub watching for any call.
import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateRoute } from "../src/network-policy.js";
import { type SeedTitle, pageOf, seedTitles, seededDataDir, writeTitles } from "./paging-kit.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

const titles = seedTitles();
let shared: { t: TestApp; token: string; calls: string[] } | undefined;

async function setup() {
  if (shared) return shared;
  const tmdb = await stubTmdb();
  const t = await makeApp({ dataDir: seededDataDir((store) => writeTitles(store, titles)), config: tmdbOn(tmdb) });
  shared = { t, token: (await signIn(t.app)).access, calls: tmdb.calls };
  return shared;
}

const read = async (query: string) => {
  const { t, token } = await setup();
  return send(t.app, "GET", `/api/titles/stored${query}`, undefined, token);
};

async function walk(query: string): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = pageOf((await read(`?limit=200&offset=${offset}${query}`)).body);
    ids.push(...page.items.map((item) => String(item.id)));
    if (page.items.length < 200) return ids;
  }
}

/** The order the store must give: the key (missing last either way), then the id. */
function ordered(rows: readonly SeedTitle[], key: (t: SeedTitle) => string | number | undefined, dir: "asc" | "desc") {
  return [...rows].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    if (x !== y) {
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return (x < y ? -1 : 1) * (dir === "asc" ? 1 : -1);
    }
    return a.id < b.id ? -1 : 1;
  }).map((t) => t.id);
}
const ids = (keep: (t: SeedTitle) => boolean) => titles.filter(keep).map((t) => t.id).sort();

test("the first page is 100 rows of 150 with the whole store's inventory; pages cover each title once", async () => {
  const first = pageOf((await read("")).body);
  const count = (keep: (t: SeedTitle) => boolean) => titles.filter(keep).length;
  assert.deepEqual([first.items.length, first.total, first.data.offset, first.data.limit], [100, 150, 0, 100]);
  assert.deepEqual(first.data.inventory, {
    movie: count((t) => t.kind === "movie"), tv: count((t) => t.kind === "tv"), manual: count((t) => t.origin === "manual"),
    edited: count((t) => t.edited), disabled: count((t) => !t.enabled),
  });
  assert.equal(first.data.version, `150:${Math.max(...titles.map((t) => t.fetchedAt))}`);
  const second = pageOf((await read("?offset=100")).body);
  assert.deepEqual([second.items.length, second.total], [50, 150]);
  const all = [...first.items, ...second.items].map((item) => String(item.id));
  assert.equal(new Set(all).size, 150);
  assert.deepEqual(pageOf((await read("")).body).items, first.items);
  const past = pageOf((await read("?offset=500")).body);
  assert.deepEqual([past.items.length, past.total], [0, 150]);
  const filtered = pageOf((await read("?kind=tv&limit=1")).body);
  assert.deepEqual([filtered.total, filtered.data.inventory], [count((t) => t.kind === "tv"), first.data.inventory]);
});

test("a row is the admin's title row with its state, enabled, edits and when it was stored", async () => {
  const items = pageOf((await read("?q=the%20matrix")).body).items;
  const manual = pageOf((await read("?origin=manual&limit=1")).body).items[0];
  assert.deepEqual(items.find((item) => item.id === "tv-1011"), {
    id: "tv-1011", kind: "tv", title: "the matrix", year: 1961, rating: 2.2, genres: ["Drama"], tmdbId: 1011,
    state: "synced", enabled: true, editedFields: [], fetchedAt: titles[11]?.fetchedAt,
  });
  assert.equal(manual?.state, "manual");
  const edited = pageOf((await read("?edited=true&limit=1")).body).items[0];
  assert.deepEqual([edited?.state, edited?.editedFields], ["edited", ["title"]]);
});

test("q is a case-insensitive contains over the title; % and _ are literal", async () => {
  // Title order: "the matrix" before "THE MATRIX II".
  assert.deepEqual(await walk("&q=THE%20matrix"), ["tv-1011", "movie-1012"]);
  assert.deepEqual(await walk("&q=%25"), ["tv-1005"]);
  assert.deepEqual(await walk("&q=_"), ["tv-1007"]);
  assert.deepEqual((await walk("&q=title%201")).sort(), ids((t) => t.title.toLowerCase().includes("title 1")));
  assert.equal((await walk("&q=%20")).length, 150);
});

test("every filter alone and combined keeps exactly the matching titles", async () => {
  const cases: Array<[string, (t: SeedTitle) => boolean]> = [
    ["&kind=movie", (t) => t.kind === "movie"],
    ["&kind=tv", (t) => t.kind === "tv"],
    ["&kind=all&origin=all", () => true],
    ["&origin=tmdb", (t) => t.origin === "tmdb"],
    ["&origin=manual", (t) => t.origin === "manual"],
    ["&edited=true", (t) => t.edited],
    ["&edited=false", (t) => !t.edited],
    ["&enabled=false", (t) => !t.enabled],
    ["&enabled=true", (t) => t.enabled],
    ["&kind=movie&origin=tmdb&enabled=false", (t) => t.kind === "movie" && t.origin === "tmdb" && !t.enabled],
    ["&origin=manual&edited=true", () => false],
  ];
  for (const [query, keep] of cases) {
    assert.deepEqual((await walk(query)).sort(), ids(keep), query);
    assert.equal(pageOf((await read(`?limit=1${query}`)).body).total, ids(keep).length, query);
  }
});

test("every sort in both directions is total: the key, missing values last, then the id", async () => {
  const keys: Record<string, (t: SeedTitle) => string | number | undefined> = {
    title: (t) => t.title.toLowerCase(),
    year: (t) => t.year,
    rating: (t) => t.rating,
    fetched: (t) => t.fetchedAt,
  };
  for (const [sort, key] of Object.entries(keys)) {
    for (const dir of ["asc", "desc"] as const) {
      assert.deepEqual(await walk(`&sort=${sort}&dir=${dir}`), ordered(titles, key, dir), `${sort} ${dir}`);
      const paged = [];
      for (const offset of [0, 50, 100]) {
        const page = pageOf((await read(`?limit=50&offset=${offset}&sort=${sort}&dir=${dir}`)).body);
        paged.push(...page.items.map((item) => String(item.id)));
      }
      assert.deepEqual(paged, ordered(titles, key, dir), `${sort} ${dir} by pages`);
    }
  }
  assert.deepEqual((await walk("")).slice(0, 3), ordered(titles, keys.title ?? (() => undefined), "asc").slice(0, 3));
});

test("invalid values are 400 request.invalid naming the field", async () => {
  const cases: Array<[string, string]> = [
    ["?limit=0", "limit"], ["?limit=201", "limit"], ["?offset=-1", "offset"], ["?kind=anime", "kind"],
    ["?origin=x", "origin"], ["?edited=1", "edited"], ["?enabled=no", "enabled"], ["?sort=popularity", "sort"],
    ["?dir=down", "dir"], [`?q=${"x".repeat(201)}`, "q"],
  ];
  for (const [query, field] of cases) {
    const answer = await read(query);
    assert.deepEqual([answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")],
      [400, "request.invalid", field], query);
  }
});

test("the stored list is signed in, no-store and never a public read", async () => {
  const { t } = await setup();
  const anonymous = await send(t.app, "GET", "/api/titles/stored");
  assert.deepEqual([anonymous.status, pick(anonymous.body, "error.code")], [401, "auth.unauthorized"]);
  assert.equal(anonymous.headers["cache-control"], "no-store");
  assert.equal((await read("?limit=5")).headers["cache-control"], "no-store");
  for (const url of ["/api/titles/stored", "/api/titles/stored?limit=5&q=x", "/api/titles/stored/"]) {
    assert.equal(isPrivateRoute(url), true, url);
  }
  assert.equal(isPrivateRoute("/api/titles?kind=movie"), false);
});

test("a soft-deleted title leaves the list; nothing ever asked TMDB", async () => {
  const { t, token, calls } = await setup();
  const before = pageOf((await read("?limit=1")).body).data.inventory as Record<string, number>;
  assert.equal((await send(t.app, "DELETE", "/api/titles/movie-1002", undefined, token)).status, 200);
  const after = pageOf((await read("?limit=200")).body);
  assert.equal(after.total, 149);
  assert.equal(after.items.some((item) => item.id === "movie-1002"), false);
  assert.equal((after.data.inventory as Record<string, number>).movie, (before.movie ?? 0) - 1);
  assert.equal(String(after.data.version).startsWith("149:"), true);
  const deleted = pick((await send(t.app, "GET", "/api/titles/deleted", undefined, token)).body, "data.items");
  assert.equal(JSON.stringify(deleted).includes("1002"), true);
  assert.deepEqual(calls, []);
});
