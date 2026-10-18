import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/build-app.js";
import { TITLE_ID_MAX } from "../src/constants/titles.js";
import { pick, send } from "./app-fixture.js";

const MANUAL_ID = `custom-${randomUUID()}`;
const TOO_LONG = "x".repeat(TITLE_ID_MAX + 1);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MANUAL = {
  ok: true,
  data: { id: MANUAL_ID, tmdbId: 0, kind: "movie", title: "Home Video", year: 2020, genres: [], plot: "Our trip." },
};
const SEASON = { ok: true, data: { episodes: [{ season: 1, episode: 1, title: "One" }] } };
const OTHER = { id: "movie-550", kind: "movie", title: "Fight Club", year: 1999, genres: [], rating: 8.4 };
const RECOMMENDED = { ok: true, data: { items: [OTHER] } };

/** The backend as it answers a manual title: the three reads, each keyed by the full id. */
function manualSeam(seen: string[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const at = url.pathname;
    if (at === "/healthz") return json({ ok: true, data: { role: "admin-backend", version: "t", revision: 1, tmdb: "configured" } });
    if (at === "/api/titles/genres") return json({ ok: true, data: [] });
    if (at === "/api/titles/catalog") return json({ ok: true, data: { items: [] } });
    seen.push(at);
    if (at === `/api/titles/${MANUAL_ID}`) return json(MANUAL);
    if (at === `/api/titles/${MANUAL_ID}/seasons/1`) return json(SEASON);
    if (at === `/api/titles/${MANUAL_ID}/recommendations`) return json(RECOMMENDED);
    return json({ ok: false, error: { code: "title.not_found", message: "no such title" } }, 404);
  }) as typeof fetch;
}

async function manualApp(seen: string[]): Promise<{ app: FastifyInstance; close: () => Promise<void> }> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-titles-manual-"));
  const app = await buildApp({ dataDir, adminFetch: manualSeam(seen), logger: false, syncOnStart: false });
  return { app, close: async () => { await app.close(); rmSync(dataDir, { recursive: true, force: true }); } };
}

test("a custom-<uuid> id is 43 characters, inside the limit", () => {
  assert.equal(MANUAL_ID.length, 43);
  assert.ok(MANUAL_ID.length <= TITLE_ID_MAX);
});

test("a manual title's detail, season and related all reach the backend read", async () => {
  const seen: string[] = [];
  const t = await manualApp(seen);
  const detail = await send(t.app, "GET", `/api/titles/${MANUAL_ID}`);
  assert.equal(detail.status, 200);
  assert.equal(pick(detail.body, "data.title"), "Home Video");
  assert.equal(pick(detail.body, "data.plot"), "Our trip.");
  const season = await send(t.app, "GET", `/api/titles/${MANUAL_ID}/seasons/1`);
  assert.equal(season.status, 200);
  assert.equal(pick(season.body, "data.episodes.0.episode"), 1);
  const related = await send(t.app, "GET", `/api/titles/${MANUAL_ID}/related`);
  assert.equal(related.status, 200);
  assert.ok(seen.includes(`/api/titles/${MANUAL_ID}`));
  assert.ok(seen.includes(`/api/titles/${MANUAL_ID}/seasons/1`));
  assert.ok(seen.includes(`/api/titles/${MANUAL_ID}/recommendations`));
  await t.close();
});

test("an id over the limit is refused 400 on every title route, without reaching the backend", async () => {
  const seen: string[] = [];
  const t = await manualApp(seen);
  for (const url of [
    `/api/titles/${TOO_LONG}`,
    `/api/titles/${TOO_LONG}/seasons/1`,
    `/api/titles/${TOO_LONG}/related`,
  ]) {
    const refused = await send(t.app, "GET", url);
    assert.equal(refused.status, 400, url);
    assert.equal(pick(refused.body, "ok"), false);
    assert.equal(pick(refused.body, "error.code"), "request.invalid");
  }
  assert.deepEqual(seen, []);
  await t.close();
});
