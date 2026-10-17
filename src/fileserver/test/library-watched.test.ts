import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/build-app.js";
import { pick, send } from "./app-fixture.js";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Every ninth-tenth year rule: titles whose number divides by `every` are from 2020, the rest from 1990. */
const yearOf = (n: number, every: number): number => (n % every === 0 ? 2020 : 1990);

/** A fake backend: `movies` movies and `shows` series, 20 a page; the year filter is NOT applied upstream. */
function catalogSeam(movies: number, shows: number, every: number): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const at = url.pathname;
    if (at === "/healthz") return json({ ok: true, data: { role: "admin-backend", version: "t", revision: 1, tmdb: "configured" } });
    if (at === "/api/titles/genres") return json({ ok: true, data: [] });
    if (at === "/api/titles") {
      const kind = url.searchParams.get("kind") === "tv" ? "tv" : "movie";
      const count = kind === "tv" ? shows : movies;
      const page = Number(url.searchParams.get("page") ?? "1");
      const rows = Array.from({ length: count }, (_, at) => at + 1)
        .slice((page - 1) * 20, page * 20)
        .map((n) => ({ id: `${kind}-${n}`, kind, title: `${kind} ${n}`, year: yearOf(n, every), genres: [] }));
      return json({ ok: true, data: { items: rows, page, totalPages: Math.ceil(count / 20), totalResults: count } });
    }
    const detail = /^\/api\/titles\/(movie|tv)-(\d+)$/.exec(at);
    if (detail !== null) {
      const n = Number(detail[2]);
      return json({
        ok: true,
        data: {
          id: `${detail[1]}-${n}`, tmdbId: n, kind: detail[1], title: `${detail[1]} ${n}`, year: n % 2 === 0 ? 2020 : 1999,
          genres: [n % 2 === 0 ? "Drama" : "Comedy"], plot: "p",
        },
      });
    }
    return json({ ok: false, error: { code: "title.not_found", message: "no such title" } }, 404);
  }) as typeof fetch;
}

async function seamApp(movies: number, shows: number, every = 10) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-watched-"));
  const app: FastifyInstance = await buildApp({ dataDir, adminFetch: catalogSeam(movies, shows, every), logger: false });
  return { app, close: async () => { await app.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

let playback = 0;
const watch = (app: FastifyInstance, id: string, positionMs: number) =>
  send(app, "PUT", "/api/watch", { item: { kind: "title", id }, positionMs, durationMs: 90_000, playbackId: `p${playback++}`, seq: 1 });

const idsOf = (body: unknown): string[] =>
  (pick(body, "data.items") as Array<{ ref: { id: string } }>).map((one) => one.ref.id);

/** Follows the cursor to the end; every page that carries a cursor must hold items. */
async function allPages(app: FastifyInstance, query: string): Promise<string[][]> {
  const pages: string[][] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 30; guard++) {
    const page = await send(app, "GET", `/api/library?${query}${cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`}`);
    assert.equal(page.status, 200);
    const ids = idsOf(page.body);
    const next = pick(page.body, "data.nextCursor");
    assert.ok(!(ids.length === 0 && next !== undefined), "an empty page never carries a cursor");
    pages.push(ids);
    if (typeof next !== "string") return pages;
    cursor = next;
  }
  throw new Error("the cursor never ended");
}

test("watched=watching and watched=watched answer the history items, full pages, no cursor at the end", async () => {
  const t = await seamApp(60, 40);
  for (let n = 1; n <= 25; n++) await watch(t.app, `movie-${n}`, 100);
  for (let n = 1; n <= 5; n++) await watch(t.app, `tv-${n}`, 100);
  for (let n = 31; n <= 33; n++) await watch(t.app, `movie-${n}`, 89_500);

  const first = await send(t.app, "GET", "/api/library?watched=watching");
  assert.equal(pick(first.body, "data.items.length"), 20);
  assert.equal(pick(first.body, "data.total"), 30);
  const pages = await allPages(t.app, "watched=watching");
  assert.deepEqual(pages.map((one) => one.length), [20, 10]);
  assert.equal(new Set(pages.flat()).size, 30, "no row repeats across pages");
  assert.ok(pages.flat().every((id) => !["movie-31", "movie-32", "movie-33"].includes(id)));

  const done = await allPages(t.app, "watched=watched");
  assert.deepEqual(done.map((one) => one.sort()), [["movie-31", "movie-32", "movie-33"]]);
  await t.close();
});

test("the history set honours a type scope, genre and year together", async () => {
  const t = await seamApp(60, 40);
  for (let n = 1; n <= 25; n++) await watch(t.app, `movie-${n}`, 100);
  for (let n = 1; n <= 5; n++) await watch(t.app, `tv-${n}`, 100);
  const tv = await allPages(t.app, "type=tv&watched=watching");
  assert.deepEqual(tv.map((one) => one.length), [5]);
  const movies = await allPages(t.app, "type=movie&watched=watching");
  assert.deepEqual(movies.map((one) => one.length), [20, 5]);
  const even = await allPages(t.app, "type=movie&watched=watching&year=2020&genre=Drama");
  assert.deepEqual(even.map((one) => one.length), [12], "the even numbers one to 25");
  const none = await send(t.app, "GET", "/api/library?type=movie&watched=watched");
  assert.deepEqual(idsOf(none.body), []);
  assert.equal(pick(none.body, "data.nextCursor"), undefined);
  await t.close();
});

test("old cursors still decode on the history-backed and the catalog paths", async () => {
  const t = await seamApp(60, 40);
  for (let n = 1; n <= 25; n++) await watch(t.app, `movie-${n}`, 100);
  const old = Buffer.from(JSON.stringify({ localOffset: 20, titlePage: 0 }), "utf-8").toString("base64url");
  const second = await send(t.app, "GET", `/api/library?watched=watching&cursor=${old}`);
  assert.equal(second.status, 200);
  assert.equal(pick(second.body, "data.items.length"), 5);
  const catalog = Buffer.from(JSON.stringify({ localOffset: 0, titlePage: 2 }), "utf-8").toString("base64url");
  const later = await send(t.app, "GET", `/api/library?type=movie&watched=unwatched&cursor=${catalog}`);
  assert.equal(later.status, 200);
  assert.equal(idsOf(later.body)[0], "movie-26", "the catalog resumes at its second page, skipping the 25 with progress");
  await t.close();
});

test("watched=unwatched fills the page across sparse upstream data", async () => {
  const t = await seamApp(60, 40);
  await watch(t.app, "movie-10", 100);
  const plain = await send(t.app, "GET", "/api/library?watched=unwatched");
  assert.equal(pick(plain.body, "data.items.length"), 39, "twenty a kind, less the one with progress");
  assert.ok(!idsOf(plain.body).includes("movie-10"), "a title with progress is not unwatched");
  const sparse = await allPages(t.app, "watched=unwatched&year=2020");
  assert.deepEqual(sparse.map((one) => one.length), [9], "six movies and four series from 2020, one with progress");
  await t.close();
});

test("past the upstream bound the page is returned with a cursor that carries on", async () => {
  const t = await seamApp(300, 0, 100);
  const first = await send(t.app, "GET", "/api/library?type=movie&watched=unwatched&year=2020");
  assert.deepEqual(idsOf(first.body), ["movie-100", "movie-200"], "ten upstream pages were read, then it stopped");
  assert.ok(typeof pick(first.body, "data.nextCursor") === "string");
  const pages = await allPages(t.app, "type=movie&watched=unwatched&year=2020");
  assert.deepEqual(pages.flat(), ["movie-100", "movie-200", "movie-300"]);
  await t.close();
});
