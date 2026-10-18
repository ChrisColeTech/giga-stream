// Titles are ordinary records (docs/26 decision D20): create, read, edit, delete, revert, restore; auth, validation,
// the state word, and the titles made by hand in the lists. TMDB is a stub; nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";

import { FOUR_DAYS_MS, field, later, syncAll, titleApp } from "./title-edit-kit.js";
import { itemsOf } from "./live-channel-kit.js";
import { pick, send } from "./test-app.js";

const HOME = { kind: "movie", title: "Home Movie", year: 2020, genres: ["Drama"], rating: 7.5, plot: "Our holiday." };

test("every write needs a signed-in admin: 401 without a token, and for the deleted list", async () => {
  const { t } = await titleApp();
  const writes = [
    ["POST", "/api/titles", HOME],
    ["PATCH", "/api/titles/movie-603", { plot: "x" }],
    ["DELETE", "/api/titles/movie-603", undefined],
    ["POST", "/api/titles/movie-603/revert", undefined],
  ] as const;
  for (const [method, url, body] of writes) {
    for (const token of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
});

test("a title made by hand is created, read, edited, cleared and deleted; the revision and the channels are untouched", async () => {
  const { t, token } = await titleApp();
  const revision = async () => pick((await send(t.app, "GET", "/healthz")).body, "data.revision");
  const before = await revision();
  const made = await send(t.app, "POST", "/api/titles", { ...HOME, posterUrl: "https://img.example/p.jpg", streamUrl: "https://s.example/a.m3u8" }, token);
  assert.equal(made.status, 201);
  const id = String(field(made, "id"));
  assert.match(id, /^custom-[0-9a-f-]{36}$/);
  assert.deepEqual(["state", "kind", "title", "year", "shape"].map((f) => field(made, f)), ["manual", "movie", "Home Movie", 2020, "detail"]);
  const read = await send(t.app, "GET", `/api/titles/${id}`);
  assert.deepEqual([read.status, field(read, "streamUrl"), field(read, "genres"), field(read, "state")], [200, "https://s.example/a.m3u8", ["Drama"], "manual"]);

  const edited = await send(t.app, "PATCH", `/api/titles/${id}`, { title: "Home Movie 2", year: 2021, plot: null, cast: ["Me"], runtimeMs: 5_400_000 }, token);
  assert.deepEqual(["title", "year", "plot", "cast", "runtimeMs", "state"].map((f) => field(edited, f)), ["Home Movie 2", 2021, undefined, ["Me"], 5_400_000, "manual"]);
  assert.equal(await revision(), before, "titles are not channel data");

  const gone = await send(t.app, "DELETE", `/api/titles/${id}`, undefined, token);
  assert.deepEqual([gone.status, gone.body], [200, { ok: true, data: { id } }]);
  assert.equal((await send(t.app, "GET", `/api/titles/${id}`)).status, 404);
  assert.equal((await send(t.app, "DELETE", `/api/titles/${id}`, undefined, token)).status, 404);
  const actions = (pick((await send(t.app, "GET", "/api/audit?limit=10", undefined, token)).body, "data.items") as Array<Record<string, unknown>>).map((e) => e.action);
  assert.deepEqual(actions.slice(0, 3), ["title.deleted", "title.updated", "title.created"]);
});

test("a bad title is refused with the field named", async () => {
  const { t, token } = await titleApp();
  const refusal = async (body: unknown) => {
    const answer = await send(t.app, "POST", "/api/titles", body, token);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  const invalid = (f: string) => [422, "title.invalid", f];
  assert.deepEqual(await refusal({ ...HOME, title: undefined }), invalid("title"));
  assert.deepEqual(await refusal({ ...HOME, kind: "radio" }), invalid("kind"));
  assert.deepEqual(await refusal({ ...HOME, year: 1700 }), invalid("year"));
  assert.deepEqual(await refusal({ ...HOME, rating: 11 }), invalid("rating"));
  assert.deepEqual(await refusal({ ...HOME, genres: "Drama" }), invalid("genres"));
  assert.deepEqual(await refusal({ ...HOME, colour: "red" }), invalid("colour"));
  assert.deepEqual(await refusal({ ...HOME, posterUrl: "http://img.example/p.jpg" }), invalid("posterUrl"));
  assert.deepEqual(await refusal({ ...HOME, backdropUrl: "ftp://x" }), invalid("backdropUrl"));
  assert.deepEqual(await refusal({ ...HOME, streamUrl: "http://s.example/a.m3u8" }), invalid("streamUrl"));
  assert.deepEqual(await refusal({ ...HOME, kind: "tv", seasons: [{ season: 1, episodes: [{ episode: 1, streamUrl: "http://s.example/e.m3u8" }] }] }), invalid("seasons"));
  assert.equal((await send(t.app, "GET", "/api/titles?kind=movie")).status, 200);
  const id = String(field(await send(t.app, "POST", "/api/titles", HOME, token), "id"));
  const patch = async (target: string, body: unknown) => {
    const answer = await send(t.app, "PATCH", `/api/titles/${target}`, body, token);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  assert.deepEqual(await patch(id, { kind: "tv" }), invalid("kind"));
  assert.deepEqual(await patch(id, { title: null }), invalid("title"));
  assert.deepEqual(await patch(id, { posterUrl: "http://img.example/p.jpg" }), invalid("posterUrl"));
  assert.deepEqual(await patch("custom-missing", { plot: "x" }), [404, "title.not_found", undefined]);
  assert.deepEqual(await patch("movie-603", { tmdbId: 5 }), invalid("tmdbId"));
});

test("a manual series carries its seasons; a manual title with a TMDB id gets provider sources, one without does not", async () => {
  const { t, token } = await titleApp();
  await send(t.app, "POST", "/api/providers", {
    name: "First", source: "first", order: 1, family: "embed",
    movieTemplate: "https://first.example/movie/{tmdbId}", episodeTemplate: "https://first.example/tv/{tmdbId}/{season}/{episode}",
  }, token);
  const series = await send(t.app, "POST", "/api/titles", {
    kind: "tv", title: "Home Show", tmdbId: 1399,
    seasons: [{ season: 1, episodes: [{ episode: 1, title: "Pilot", runtimeMs: 60_000 }, { episode: 2 }] }],
  }, token);
  const id = String(field(series, "id"));
  const season = await send(t.app, "GET", `/api/titles/${id}/seasons/1`);
  assert.deepEqual((pick(season.body, "data.episodes") as Array<Record<string, unknown>>).map((e) => [e.season, e.episode, e.title]), [[1, 1, "Pilot"], [1, 2, undefined]]);
  assert.equal(pick(season.body, "data.episodes.0.sources.0.url"), "https://first.example/tv/1399/1/1");
  assert.deepEqual((await send(t.app, "GET", `/api/titles/${id}/seasons/9`)).body, { ok: true, data: { episodes: [] } });
  assert.deepEqual((await send(t.app, "GET", `/api/titles/${id}/recommendations`)).body, { ok: true, data: { items: [] } });

  const withId = String(field(await send(t.app, "POST", "/api/titles", { kind: "movie", title: "With", tmdbId: 603 }, token), "id"));
  const without = String(field(await send(t.app, "POST", "/api/titles", { kind: "movie", title: "Without", streamUrl: "https://s.example/w.m3u8" }, token), "id"));
  assert.equal(pick((await send(t.app, "GET", `/api/titles/${withId}`)).body, "data.sources.0.url"), "https://first.example/movie/603");
  const plain = await send(t.app, "GET", `/api/titles/${without}`);
  assert.deepEqual([pick(plain.body, "data.sources"), pick(plain.body, "data.streamUrl")], [undefined, "https://s.example/w.m3u8"]);
  const gained = await send(t.app, "PATCH", `/api/titles/${without}`, { tmdbId: 603 }, token);
  assert.equal(field(gained, "tmdbId"), 603);
  assert.equal(pick((await send(t.app, "GET", `/api/titles/${without}`)).body, "data.sources.0.url"), "https://first.example/movie/603");
});

test("manual titles join the lists: filtered by kind, genre, year and search, sorted, last under trending", async () => {
  const { t, token } = await titleApp();
  await send(t.app, "POST", "/api/titles", HOME, token);
  await send(t.app, "POST", "/api/titles", { kind: "movie", title: "Alpha Tape", year: 1990, genres: ["Comedy"] }, token);
  await send(t.app, "POST", "/api/titles", { kind: "tv", title: "Home Show" }, token);
  const titles = async (query: string) => itemsOf((await send(t.app, "GET", `/api/titles?${query}`)).body).map((i) => i.title);
  assert.deepEqual(await titles("kind=movie&sort=newest"), ["Home Movie", "The Matrix", "Alpha Tape"]);
  assert.deepEqual(await titles("kind=movie&sort=oldest"), ["Alpha Tape", "The Matrix", "Home Movie"]);
  assert.deepEqual(await titles("kind=movie&sort=az"), ["Alpha Tape", "Home Movie", "The Matrix"]);
  const trending = await titles("kind=movie&sort=trending");
  assert.deepEqual([trending[0], trending.slice(1).sort()], ["The Matrix", ["Alpha Tape", "Home Movie"]], "no popularity: after TMDB's");
  assert.deepEqual(await titles("kind=movie&sort=newest&genre=comedy"), ["The Matrix", "Alpha Tape"], "a genre name matches the manual title");
  assert.deepEqual(await titles("kind=movie&sort=newest&year=1999"), ["The Matrix"]);
  assert.deepEqual((await titles("kind=tv&sort=newest")).sort(), ["Game of Thrones", "Home Show"]);
  assert.deepEqual((await titles("kind=all&sort=az")).length, 5);
  const search = itemsOf((await send(t.app, "GET", "/api/titles/search?kind=movie&q=alpha")).body).map((i) => i.title);
  assert.ok(search.includes("Alpha Tape"));
  const page = await send(t.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(page.body, "data.totalResults"), 3);
  assert.equal((itemsOf((await send(t.app, "GET", "/api/titles?kind=movie&sort=newest&page=2")).body).map((i) => i.state)).includes("manual"), false, "page one only");
});

test("without TMDB the list shows the titles made by hand; with none it is still the outage", async () => {
  const { t, token } = await titleApp({ tmdb: false });
  const outage = await send(t.app, "GET", "/api/titles?kind=movie&sort=newest");
  assert.equal(pick(outage.body, "error.code"), "tmdb.unavailable");
  await send(t.app, "POST", "/api/titles", HOME, token);
  const shown = await send(t.app, "GET", "/api/titles?kind=movie&sort=newest");
  assert.deepEqual([shown.status, itemsOf(shown.body).map((i) => i.title)], [200, ["Home Movie"]]);
});

test("every item carries its state: synced, edited or manual", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  await send(t.app, "POST", "/api/titles", HOME, token);
  const states = async () => itemsOf((await send(t.app, "GET", "/api/titles?kind=movie&sort=az")).body).map((i) => [i.title, i.state]);
  assert.deepEqual(await states(), [["Home Movie", "manual"], ["The Matrix", "synced"]]);
  await send(t.app, "PATCH", "/api/titles/movie-603", { plot: "Mine" }, token);
  assert.deepEqual(await states(), [["Home Movie", "manual"], ["The Matrix", "edited"]]);
  assert.equal(field(await send(t.app, "GET", "/api/titles/movie-603"), "state"), "edited");
  const revert = await send(t.app, "POST", "/api/titles/movie-603/revert", undefined, token);
  assert.equal(field(revert, "state"), "synced");
  assert.deepEqual(await states(), [["Home Movie", "manual"], ["The Matrix", "synced"]]);
});

test("revert has nothing to go back to for a title made by hand, and a missing title is 404", async () => {
  const { t, token } = await titleApp();
  const id = String(field(await send(t.app, "POST", "/api/titles", HOME, token), "id"));
  const refused = await send(t.app, "POST", `/api/titles/${id}/revert`, undefined, token);
  assert.deepEqual([refused.status, pick(refused.body, "error.code")], [409, "title.manual"]);
  assert.equal((await send(t.app, "POST", "/api/titles/movie-999/revert", undefined, token)).status, 404);
});

test("enabled is a field of the title: a disabled title leaves the public reads, and an admin's read keeps it", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  const manual = String(field(await send(t.app, "POST", "/api/titles", HOME, token), "id"));
  assert.equal(field(await send(t.app, "GET", `/api/titles/${manual}?includeDisabled=true`, undefined, token), "enabled"), true);
  await send(t.app, "GET", "/api/titles/movie-603");
  for (const id of ["movie-603", manual]) {
    const off = await send(t.app, "PATCH", `/api/titles/${id}`, { enabled: false }, token);
    assert.deepEqual([off.status, field(off, "enabled"), field(off, "state")], [200, false, id === manual ? "manual" : "synced"], "enabled is not an edit");
  }
  const titles = async (query: string, token?: string) =>
    itemsOf((await send(t.app, "GET", `/api/titles?kind=movie&sort=az${query}`, undefined, token)).body).map((i) => [i.title, i.enabled]);
  assert.deepEqual(await titles(""), [], "public: nothing disabled");
  assert.deepEqual(await titles("&includeDisabled=true"), [], "the option is ignored without a token");
  assert.deepEqual(await titles("&includeDisabled=true", "not-a-token"), []);
  assert.deepEqual(await titles("&includeDisabled=true", token), [["Home Movie", false], ["The Matrix", false]]);
  const search = await send(t.app, "GET", "/api/titles/search?kind=movie&q=home");
  assert.deepEqual(itemsOf(search.body).map((i) => i.title), []);
  for (const id of ["movie-603", manual]) {
    assert.equal((await send(t.app, "GET", `/api/titles/${id}`)).status, 404, id);
    assert.equal((await send(t.app, "GET", `/api/titles/${id}?includeDisabled=true`)).status, 404, `${id} without a token`);
    assert.equal((await send(t.app, "GET", `/api/titles/${id}?includeDisabled=true`, undefined, token)).status, 200, id);
  }
  // A sync neither re-enables it nor skips it.
  await later(h, FOUR_DAYS_MS);
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  assert.equal(field(await send(t.app, "GET", "/api/titles/movie-603?includeDisabled=true", undefined, await later(h, 0)), "enabled"), false);
  await send(t.app, "PATCH", "/api/titles/movie-603", { enabled: true }, await later(h, 0));
  assert.equal(field(await send(t.app, "GET", "/api/titles/movie-603"), "title"), "The Matrix");
  assert.equal(pick((await send(t.app, "GET", "/api/titles/movie-603")).body, "data.enabled"), undefined, "no enabled on a public answer");
});
