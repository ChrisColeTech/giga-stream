// `GET /api/titles/catalog` (docs/46 D.1, docs/03 section 7.4): the fileserver's sync read. Enabled titles from the store
// alone (TMDB's stub watches for any call), keyset paged by id, public, with nothing a viewer must not get.
import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateRoute } from "../src/network-policy.js";
import type { Store } from "../src/store/store.js";
import { pageOf, seededDataDir } from "./paging-kit.js";
import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

const AT = Date.UTC(2026, 0, 1);
const BULK = 1_199;
const payloadOf = (id: string, kind: "movie" | "tv", n: number, extra: Record<string, unknown> = {}) => ({
  id, kind, tmdbId: n, shape: "list", title: `Title ${n}`, year: 1990 + (n % 30), rating: (n % 100) / 10,
  genres: ["18", "878"], posterUrl: `https://img.example/p${n}.jpg`, backdropUrl: `https://img.example/b${n}.jpg`,
  popularity: { score: n / 2, readAt: AT },
  // None of these may reach the answer.
  plot: "A plot.", cast: ["Someone"], runtimeMs: 5000, streamUrl: "https://s.example/x.m3u8", sources: [{ url: "https://s.example/y" }],
  ...extra,
});

async function seed(store: Store): Promise<void> {
  const put = async (kind: "movie" | "tv", n: number, extra: Record<string, unknown> = {}): Promise<void> =>
    store.titles.put({ kind, tmdbId: n, payload: payloadOf(`${kind}-${n}`, kind, n, extra), popularityScore: null, popularityReadAt: null, fetchedAt: AT });
  for (let i = 0; i < BULK; i++) await put(i % 2 === 0 ? "movie" : "tv", 100_000 + i);
  await put("movie", 5, { title: "Original" });
  await store.titles.updateRecord("movie-5", { payload: payloadOf("movie-5", "movie", 5, { title: "Edited Name" }), editedFields: ["title"], tmdbId: 5, enabled: true });
  await put("movie", 6);
  await store.titles.updateRecord("movie-6", { payload: payloadOf("movie-6", "movie", 6), editedFields: [], tmdbId: 6, enabled: false });
  await put("tv", 7);
  await put("movie", 8, { title: undefined });
  const manual = { id: "custom-1", kind: "tv" as const, shape: "detail", title: "By Hand", genres: ["Drama"], plot: "p", streamUrl: "https://s.example/m.m3u8" };
  await store.titles.insertManual({ id: "custom-1", kind: "tv", tmdbId: null, payload: manual, at: AT });
}

const ENABLED_IDS = [
  ...Array.from({ length: BULK }, (_, i) => `${i % 2 === 0 ? "movie" : "tv"}-${100_000 + i}`), "movie-5", "custom-1",
].sort();
let shared: { t: TestApp; calls: string[]; token: string } | undefined;
async function setup() {
  if (shared) return shared;
  const tmdb = await stubTmdb();
  const t = await makeApp({ dataDir: await seededDataDir(seed), config: tmdbOn(tmdb) });
  const token = (await signIn(t.app)).access;
  assert.equal((await send(t.app, "DELETE", "/api/admin/titles/tv-7", undefined, token)).status, 200);
  tmdb.calls.length = 0;
  shared = { t, calls: tmdb.calls, token };
  return shared;
}
const read = async (query: string, address?: string) => send((await setup()).t.app, "GET", `/api/titles/catalog${query}`, undefined, undefined, address);

async function walk(limit: number): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let after: string | undefined;
  for (let pages = 1; ; pages++) {
    const answer = await read(`?limit=${limit}${after === undefined ? "" : `&after=${after}`}`);
    assert.equal(answer.status, 200);
    const page = pageOf(answer.body);
    ids.push(...page.items.map((item) => String(item.id)));
    const next = pick(answer.body, "data.next");
    if (next === undefined) return { ids, pages };
    assert.equal(next, page.items[page.items.length - 1]?.id, "next is the last item's id");
    after = String(next);
  }
}

test("1,201 enabled titles page to exhaustion in id order in pages of 500, each exactly once", async () => {
  const { ids, pages } = await walk(500);
  assert.equal(ids.length, 1_201);
  assert.equal(pages, 3);
  assert.deepEqual(ids, ENABLED_IDS);
  // The malformed row sits in the first 1,000 rows read, so 999 valid items precede the last page.
  const last = await read(`?limit=500&after=${ENABLED_IDS[998]}`);
  assert.equal(pick(last.body, "data.next"), undefined);
  assert.equal(pageOf(last.body).items.length, 202);
});

test("the default page is 100 and a smaller limit pages the same rows; an exact fit has no next", async () => {
  const first = await read("");
  assert.equal(pageOf(first.body).items.length, 100);
  assert.equal(pick(first.body, "data.next"), ENABLED_IDS[99]);
  assert.deepEqual((await walk(97)).ids, ENABLED_IDS);
  const rest = await read(`?after=${ENABLED_IDS[1_100]}&limit=100`);
  assert.equal(pageOf(rest.body).items.length, 100);
  assert.equal(pick(rest.body, "data.next"), undefined);
});

test("enabled only: a manual title is in; a disabled, a deleted and a malformed row are not; edits are in the row", async () => {
  const ids = (await walk(500)).ids;
  assert.equal(ids.includes("custom-1"), true);
  for (const absent of ["movie-6", "tv-7", "movie-8"]) assert.equal(ids.includes(absent), false, absent);
  const answer = await read(`?after=movie-4&limit=2`);
  const edited = pageOf(answer.body).items.find((item) => item.id === "movie-5");
  assert.equal(edited?.title, "Edited Name");
  const manual = (await read("?after=custom-0&limit=1")).body;
  assert.deepEqual(pageOf(manual).items[0], { id: "custom-1", kind: "tv", title: "By Hand", genres: ["Drama"] });
});

test("a row is the thin public shape: no stream address, sources, enabled, plot or cast; popularity is the score", async () => {
  const answer = await read("?limit=500");
  const allowed = new Set(["id", "kind", "title", "year", "rating", "popularity", "posterUrl", "backdropUrl", "genres"]);
  for (const item of pageOf(answer.body).items) {
    for (const key of Object.keys(item)) assert.equal(allowed.has(key), true, `${String(item.id)}: ${key}`);
  }
  const row = pageOf((await read("?after=custom-1&limit=1")).body).items[0];
  assert.deepEqual(row, {
    id: "movie-100000", kind: "movie", title: "Title 100000", year: 1990 + (100_000 % 30), rating: 0, popularity: 50_000,
    posterUrl: "https://img.example/p100000.jpg", backdropUrl: "https://img.example/b100000.jpg", genres: ["18", "878"],
  });
  assert.equal(JSON.stringify(answer.body).includes("s.example"), false);
});

test("it never asks TMDB, and it is public off loopback without a token", async () => {
  const { t, calls } = await setup();
  const lan = await send(t.app, "GET", "/api/titles/catalog?limit=3", undefined, undefined, "192.168.1.20");
  assert.equal(lan.status, 200);
  assert.equal(pageOf(lan.body).items.length, 3);
  assert.equal(isPrivateRoute("/api/titles/catalog?limit=3"), false);
  assert.equal(isPrivateRoute("/api/titles/catalog", "GET", true), true);
  assert.deepEqual(calls, [], "TMDB was never called");
});

// The house refusal for a bad query is `400 request.invalid` (docs/03 section 7.4 and the stored list), not 422.
test("a malformed or out-of-bounds query is 400 request.invalid", async () => {
  for (const query of ["?limit=0", "?limit=501", "?limit=-1", "?limit=abc", "?limit=1.5", "?after=", `?after=${"x".repeat(61)}`]) {
    const answer = await read(query);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [400, "request.invalid"], query);
  }
  assert.equal((await read("?limit=1&after=zzz-unknown")).status, 200);
});
