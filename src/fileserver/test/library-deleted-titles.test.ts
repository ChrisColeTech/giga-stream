// A backend page thinned by deleted titles (`skipped` in its answer) is topped up from the next page, so the library's
// pages stay full and no page is short with a cursor (docs/03 section 3.5, section 7.4).
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

const PAGES = 6;
const SKIPPED = 5;

/** A backend whose every page of 20 movies lost 5 to deleted titles: 15 rows and `skipped: 5`. */
const backend = ((async (input: string | URL | Request) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.pathname === "/healthz") {
    return json({ ok: true, data: { role: "admin-backend", version: "t", revision: 1, tmdb: "configured" } });
  }
  if (url.pathname === "/api/titles/genres") return json({ ok: true, data: [] });
  if (url.pathname === "/api/titles") {
    const page = Number(url.searchParams.get("page") ?? "1");
    const kept = Array.from({ length: 20 - SKIPPED }, (_, at) => page * 100 + SKIPPED + at);
    const items = kept.map((n) => ({ id: `movie-${n}`, kind: "movie", title: `movie ${n}`, year: 2000, genres: [] }));
    const data = { items, page, totalPages: PAGES, totalResults: PAGES * 20, skipped: SKIPPED };
    return json({ ok: true, data });
  }
  return json({ ok: false, error: { code: "title.not_found", message: "no such title" } }, 404);
}) as typeof fetch);

async function pagesOf(app: FastifyInstance): Promise<string[][]> {
  const pages: string[][] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 20; guard++) {
    const url = `/api/library?type=movie${cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`}`;
    const answer = await send(app, "GET", url);
    assert.equal(answer.status, 200);
    const items = pick(answer.body, "data.items") as Array<{ ref: { id: string } }>;
    const next = pick(answer.body, "data.nextCursor");
    assert.ok(!(items.length === 0 && next !== undefined), "an empty page never carries a cursor");
    pages.push(items.map((one) => one.ref.id));
    if (typeof next !== "string") return pages;
    cursor = next;
  }
  throw new Error("the cursor never ended");
}

test("pages the backend thinned are topped up: every page but the last holds at least a page, none twice", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-deleted-"));
  const app = await buildApp({ dataDir, adminFetch: backend, logger: false, syncOnStart: false });
  try {
    const pages = await pagesOf(app);
    assert.ok(pages.length > 1);
    // The library reads whole upstream pages until it holds a page (20): two thinned pages of 15 make 30.
    for (const page of pages.slice(0, -1)) assert.ok(page.length >= 20, `a full page, not ${page.length}`);
    const all = pages.flat();
    assert.equal(new Set(all).size, all.length, "no title twice");
    assert.equal(all.length, PAGES * (20 - SKIPPED), "every kept title once");
  } finally {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
