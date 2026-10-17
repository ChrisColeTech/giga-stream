import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_QUERY, collectionSource } from "@/lib/library-query";
import { writeFavorite } from "@/services/favorites";
import { LibrarySearchSession, readContinue, readLibrary } from "@/services/library";
import { readRelated, readSeason, readTitle } from "@/services/titles";
import { clearWatch, removeWatch, writeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const item = {
  ref: { kind: "title" as const, id: "movie-603" }, kind: "movie" as const, title: "The Matrix",
  year: 1999, posterUrl: "/api/images/matrix", genres: ["Action"], favorite: false,
};
type ServicePage = Awaited<ReturnType<typeof readLibrary>>;
const page: ServicePage = {
  items: [item], facets: { genres: ["Action"], years: [1999] }, trending: true, titlesAvailable: true,
};
const success = (data: unknown): Response =>
  new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => { globalThis.fetch = originalFetch; });

describe("library routes", () => {
  it("sends every all-view query field, including repeated genres", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.method, "GET");
      assert.equal(
        input,
        "/api/library?view=all&type=movie&q=space+opera&sort=trending&genre=Action&genre=Drama&year=1999&watched=watching",
      );
      return success(page);
    };
    const answer = await readLibrary({
      ...DEFAULT_QUERY, scope: "movie", search: " space opera ", sort: "trending",
      genres: ["Action", "Drama"], year: "1999", watched: "watching",
    });
    assert.equal(answer.total, undefined);
    assert.deepEqual(answer.facets, page.facets);
    assert.equal(answer.trending, true);
  });

  it("sends history, favorites and collection views exactly", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input) => { calls.push(String(input)); return success(page); };
    await readLibrary({ ...DEFAULT_QUERY, source: "history" });
    await readLibrary({ ...DEFAULT_QUERY, source: "favorites" });
    await readLibrary({ ...DEFAULT_QUERY, source: collectionSource("kids/one") });
    assert.match(calls[0] ?? "", /^\/api\/library\?view=history&/);
    assert.match(calls[1] ?? "", /^\/api\/library\?view=favorites&/);
    assert.match(calls[2] ?? "", /^\/api\/library\?view=collection&collectionId=kids%2Fone&/);
  });

  it("reads Continue and refuses malformed pages and server errors", async () => {
    globalThis.fetch = async () => success({ items: [item] });
    assert.deepEqual(await readContinue(), [item]);
    globalThis.fetch = async () => success({ ...page, total: null });
    await assert.rejects(readLibrary(DEFAULT_QUERY), { code: "response.invalid" });
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false, error: { code: "library.invalid", message: "Trending is unavailable." },
    }), { status: 422 });
    await assert.rejects(readLibrary(DEFAULT_QUERY), { code: "library.invalid", message: "Trending is unavailable." });
  });
});

describe("latest-only Library search", () => {
  it("waits 250 ms, aborts the old request, keeps old rows, and accepts only the latest answer", async () => {
    const scheduled = new Map<number, { run: () => void; delay: number }>();
    const pending: Array<{ signal?: AbortSignal; resolve: (answer: ServicePage) => void }> = [];
    const answers: ServicePage[] = [page];
    let handle = 0;
    const session = new LibrarySearchSession(answers.push.bind(answers), () => assert.fail("unexpected refusal"), {
      read: (_query, signal) => new Promise((resolve) => pending.push({ signal, resolve })),
      schedule: (run, delay) => { const id = ++handle; scheduled.set(id, { run, delay }); return id; },
      cancel: (id) => { scheduled.delete(id); },
    });
    session.search({ ...DEFAULT_QUERY, search: "m" });
    assert.equal(scheduled.get(1)?.delay, 250);
    scheduled.get(1)?.run();
    session.search({ ...DEFAULT_QUERY, search: "matrix" });
    assert.equal(pending[0]?.signal?.aborted, true);
    scheduled.get(2)?.run();
    pending[0]?.resolve({ ...page, total: 1 });
    pending[1]?.resolve({ ...page, total: 2 });
    await Promise.resolve();
    assert.deepEqual(answers.map((answer) => answer.total), [undefined, 2]);
  });
});

describe("title, favorite and watch routes", () => {
  it("passes title and episode sources and streamUrl through all title reads", async () => {
    const source = { providerId: 7, name: "VidSrc", url: "https://embed.test/movie/603", origin: "https://embed.test", order: 1 };
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      if (calls.length === 1) return success({ id: "movie-603", kind: "movie", title: "Matrix", genres: [], cast: [], streamUrl: "https://stream.test/movie.m3u8", sources: [source] });
      if (calls.length === 2) return success({ episodes: [{ season: 1, episode: 1, streamUrl: "https://stream.test/e1.m3u8", sources: [source] }] });
      return success({ basis: "tmdb", items: [item] });
    };
    assert.equal((await readTitle("movie-603")).sources?.[0]?.url, source.url);
    assert.equal((await readSeason("tv-1", 1)).episodes[0]?.sources?.[0]?.url, source.url);
    assert.equal((await readRelated("movie-603")).basis, "tmdb");
    assert.deepEqual(calls, ["/api/titles/movie-603", "/api/titles/tv-1/seasons/1", "/api/titles/movie-603/related"]);
  });

  it("uses exact favorite and watch methods, paths and bodies", async () => {
    const calls: Array<{ path: string; method?: string; body?: BodyInit | null }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ path: String(input), method: init?.method, body: init?.body });
      if (calls.length <= 2) return success({ ref: item.ref, favorite: calls.length === 1 });
      if (calls.length === 3) return success({ applied: true, entry: { watchId: "w1", item: item.ref, positionMs: 2, state: "watching", updatedAt: 3 } });
      if (calls.length === 4) return success({ removed: "w1" });
      return success({ cleared: 1 });
    };
    await writeFavorite(item.ref, true);
    await writeFavorite(item.ref, false);
    await writeWatch({ item: item.ref, positionMs: 2, playbackId: "play-1", seq: 1 });
    await removeWatch("w1");
    await clearWatch();
    assert.deepEqual(calls.map((call) => [call.path, call.method]), [
      ["/api/favorites/title/movie-603", "PUT"], ["/api/favorites/title/movie-603", "DELETE"],
      ["/api/watch", "PUT"], ["/api/watch/w1", "DELETE"], ["/api/watch", "DELETE"],
    ]);
    assert.equal(calls[2]?.body, JSON.stringify({ item: item.ref, positionMs: 2, playbackId: "play-1", seq: 1 }));
  });
});
