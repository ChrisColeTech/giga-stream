import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { TITLE_ID_MAX } from "../src/constants/titles.js";
import { makeAdminDatabase } from "./admin-database.js";
import { makeApp, pick, send } from "./app-fixture.js";

const MANUAL_ID = `custom-${randomUUID()}`;
const TOO_LONG = "x".repeat(TITLE_ID_MAX + 1);

async function manualApp() {
  const database = await makeAdminDatabase();
  const manual = {
    id: MANUAL_ID, kind: "tv", title: "Home Video", year: 2020, genres: ["Home"], plot: "Our trip.",
    seasons: [{ season: 1, episodeCount: 1, episodes: [{ season: 1, episode: 1, title: "One" }] }],
  };
  const related = { id: "custom-other", kind: "tv", title: "Other", genres: ["Home"] };
  for (const [id, payload] of [[MANUAL_ID, manual], ["custom-other", related]] as const) {
    await database.execute({
      sql: `INSERT INTO titles
        (id, kind, tmdb_id, payload, fetched_at, origin, enabled) VALUES (?, 'tv', NULL, ?, 1, 'manual', 1)`,
      args: [id, JSON.stringify(payload)],
    });
  }
  return makeApp({ adminDatabase: database });
}

test("a custom-<uuid> id is inside the route limit", () => {
  assert.equal(MANUAL_ID.length, 43);
  assert.ok(MANUAL_ID.length <= TITLE_ID_MAX);
});

test("a manual tmdb_id-null payload serves detail, stored episodes and related", async () => {
  const t = await manualApp();
  const detail = await send(t.app, "GET", `/api/titles/${MANUAL_ID}`);
  assert.equal(pick(detail.body, "data.title"), "Home Video");
  assert.equal(pick(detail.body, "data.plot"), "Our trip.");
  assert.equal(pick(detail.body, "data.sources"), undefined);
  const season = await send(t.app, "GET", `/api/titles/${MANUAL_ID}/seasons/1`);
  assert.equal(pick(season.body, "data.episodes.0.episode"), 1);
  const related = await send(t.app, "GET", `/api/titles/${MANUAL_ID}/related`);
  assert.equal(pick(related.body, "data.items.0.ref.id"), "custom-other");
  await t.dispose();
});

test("an id over the limit is refused before any database read", async () => {
  const t = await manualApp();
  for (const url of [
    `/api/titles/${TOO_LONG}`,
    `/api/titles/${TOO_LONG}/seasons/1`,
    `/api/titles/${TOO_LONG}/related`,
  ]) {
    const refused = await send(t.app, "GET", url);
    assert.deepEqual([refused.status, pick(refused.body, "error.code")], [400, "request.invalid"]);
  }
  await t.dispose();
});
