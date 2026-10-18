// Recommendations are computed from the store (docs/47 section 3.2): same kind, a shared genre, most popular first, the
// title itself left out, disabled titles left out, at most 12.
import assert from "node:assert/strict";
import test from "node:test";

import { RECOMMENDATIONS_MAX } from "../src/constants/limits.js";
import { pick } from "./test-app.js";
import { fillApp, walkTmdb } from "./walk-kit.js";

const idsOf = (body: unknown): unknown[] => (pick(body, "data.items") as Array<Record<string, unknown>>).map((i) => i.id);

test("recommendations: same kind, shared genre, popularity DESC then id, the title and disabled titles left out", async () => {
  const tmdb = await walkTmdb({ movie: 3, tv: 2 });
  const f = await fillApp(tmdb, 3);
  await f.api("POST", "/api/jobs/1/run");
  await f.finished();
  const related = await f.api("GET", "/api/titles/movie-1010/recommendations");
  assert.deepEqual(idsOf(related.body), ["movie-1021", "movie-1020", "movie-1011", "movie-1031", "movie-1030"], "no series, not itself");
  assert.deepEqual(pick(related.body, "data.items.0.genres"), ["Drama"]);
  assert.equal(pick(related.body, "data.items.0.seasons"), undefined);
  assert.equal(pick(related.body, "data.items.0.state"), "synced");
  assert.deepEqual(idsOf((await f.api("GET", "/api/titles/tv-2010/recommendations")).body), ["tv-2021", "tv-2020", "tv-2011"]);

  await f.api("PATCH", "/api/titles/movie-1021", { enabled: false });
  assert.deepEqual(idsOf((await f.api("GET", "/api/titles/movie-1010/recommendations")).body).slice(0, 2), ["movie-1020", "movie-1011"]);
  assert.equal((await f.api("GET", "/api/titles/movie-999/recommendations")).status, 404);
  assert.equal(tmdb.pages().length, 5, "the reads made no walk call");
});

test("a title with no genre in common with the others has no recommendations, and the list is capped", async () => {
  const tmdb = await walkTmdb({ movie: 8, tv: 1 });
  const f = await fillApp(tmdb, 8);
  await f.api("POST", "/api/jobs/1/run");
  await f.finished();
  const many = await f.api("GET", "/api/titles/movie-1010/recommendations");
  assert.equal((pick(many.body, "data.items") as unknown[]).length, RECOMMENDATIONS_MAX);
  await f.api("PATCH", "/api/titles/movie-1010", { genres: ["Western"] });
  assert.deepEqual(idsOf((await f.api("GET", "/api/titles/movie-1010/recommendations")).body), []);
});
