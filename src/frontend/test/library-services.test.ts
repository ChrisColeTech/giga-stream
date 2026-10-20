import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_QUERY, collectionSource } from "@/lib/library-query";
import { writeFavorite } from "@/services/favorites";
import {
  LibrarySearchSession,
  appendLibraryPage,
  canLoadLibraryPage,
  knownLibraryCount,
  libraryQueryKey,
  readAllLibraryPages,
  readContinue,
  readLibrary,
} from "@/services/library";
import { LibraryItemSchema } from "@/services/schemas/library-schema";
import { EpisodeSchema, TitleSchema } from "@/services/schemas/title-schema";
import { readRelated, readSeason, readTitle } from "@/services/titles";
import { clearWatch, removeWatch, writeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
/** These tests pin the fileserver transport's exact routes, so they run on the desktop runtime explicitly: the
 *  resolver reads a window-less node process as a signed-out browser, where the watch and library reads go to the
 *  local store and the favourites refuse without a request (`62` section 3.6). */
function desktopWindow(): void {
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" } };
}
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

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  desktopWindow();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
});

describe("library routes", () => {
  it("sends every all-view query field, including repeated genres", async () => {
    /* The watched filter is a watch read (`63` section 3.3): pinned under a session, the only state that issues it. */
    useAppStore.setState({ signedIn: true });
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.method, "GET");
      assert.equal(
        input,
        "/api/library?view=all&type=movie&type=local&q=space+opera&sort=trending&genre=Action&genre=Drama&year=1999&watched=watching",
      );
      return success(page);
    };
    const answer = await readLibrary({
      ...DEFAULT_QUERY, scope: ["movie", "local"], search: " space opera ", sort: "trending",
      genres: ["Action", "Drama"], year: "1999", watched: "watching",
    });
    assert.equal(answer.total, undefined);
    assert.deepEqual(answer.facets, page.facets);
    assert.equal(answer.trending, true);
  });

  it("sends history, favorites and collection views exactly", async () => {
    useAppStore.setState({ signedIn: true });
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return success(calls.length === 3 ? { ...page, items: [{ ...item, collectionSource: "manual" }] } : page);
    };
    await readLibrary({ ...DEFAULT_QUERY, source: "history" });
    await readLibrary({ ...DEFAULT_QUERY, source: "favorites" });
    await readLibrary({ ...DEFAULT_QUERY, source: collectionSource("kids/one") });
    assert.match(calls[0] ?? "", /^\/api\/library\?view=history&/);
    assert.match(calls[1] ?? "", /^\/api\/library\?view=favorites&/);
    assert.match(calls[2] ?? "", /^\/api\/library\?view=collection&collectionId=kids%2Fone&/);
    assert.match(calls[0] ?? "", /type=movie&type=tv&type=local/);
  });

  it("requires collectionSource on collection-view rows", async () => {
    globalThis.fetch = async () => success(page);
    await assert.rejects(readLibrary({ ...DEFAULT_QUERY, source: collectionSource("c1") }), {
      code: "response.invalid",
    });
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

describe("library pagination", () => {
  it("sends the cursor, drains pages, and deduplicates by watch row before item identity", async () => {
    useAppStore.setState({ signedIn: true });
    const calls: string[] = [];
    const first = { ...page, items: [{ ...item, watchId: "w1" }], nextCursor: "page/2" };
    const second = {
      ...page,
      items: [{ ...item, watchId: "w1" }, { ...item, watchId: "w2" }],
      nextCursor: undefined,
    };
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return success(calls.length === 1 ? first : second);
    };
    const answer = await readAllLibraryPages({ ...DEFAULT_QUERY, source: "history" });
    assert.equal(answer.items.length, 2);
    assert.deepEqual(answer.items.map((row) => row.watchId), ["w1", "w2"]);
    assert.match(calls[1] ?? "", /cursor=page%2F2/);
  });

  it("preserves the next cursor and never calls a partial first page a total", () => {
    const first = { ...page, nextCursor: "next" };
    const combined = appendLibraryPage(first, { ...page, items: [], nextCursor: "last" });
    assert.equal(combined.nextCursor, "last");
    assert.equal(knownLibraryCount(first), undefined);
    assert.equal(knownLibraryCount({ ...page, total: 40, nextCursor: "next" }), 40);
    assert.equal(knownLibraryCount(page), 1);
  });

  it("hides an old cursor as soon as the current query differs or starts loading", () => {
    const oldKey = libraryQueryKey(DEFAULT_QUERY);
    const nextKey = libraryQueryKey({ ...DEFAULT_QUERY, watched: "watching" });
    assert.equal(canLoadLibraryPage(oldKey, nextKey, false, false, "old-cursor"), false);
    assert.equal(canLoadLibraryPage(oldKey, oldKey, true, false, "old-cursor"), false);
    assert.equal(canLoadLibraryPage(oldKey, oldKey, false, false, "old-cursor"), true);
  });

  it("keys media arrays by canonical order and content", () => {
    assert.equal(libraryQueryKey({ ...DEFAULT_QUERY, scope: ["movie", "tv"] }),
      libraryQueryKey({ ...DEFAULT_QUERY, scope: ["movie", "tv"] }));
    assert.notEqual(libraryQueryKey({ ...DEFAULT_QUERY, scope: ["movie"] }),
      libraryQueryKey({ ...DEFAULT_QUERY, scope: ["movie", "local"] }));
  });

  it("deduplicates repeated rows within the appended page", () => {
    const duplicate = { ...item, watchId: "w2" };
    const combined = appendLibraryPage(
      { ...page, items: [{ ...item, watchId: "w1" }] },
      { ...page, items: [duplicate, duplicate] },
    );
    assert.deepEqual(combined.items.map((row) => row.watchId), ["w1", "w2"]);
  });
});

describe("image address schemas", () => {
  it("accepts only same-origin image-cache paths", () => {
    assert.equal(LibraryItemSchema.safeParse(item).success, true);
    assert.equal(LibraryItemSchema.safeParse({ ...item, posterUrl: "https://images.test/poster.jpg" }).success, false);
    const title = { id: "movie-1", kind: "movie", title: "One", genres: [], cast: [] };
    assert.equal(TitleSchema.safeParse({ ...title, backdropUrl: "/api/images/backdrop" }).success, true);
    assert.equal(TitleSchema.safeParse({ ...title, backdropUrl: "https://images.test/backdrop" }).success, false);
    assert.equal(EpisodeSchema.safeParse({ season: 1, episode: 1, stillUrl: "/api/images/still" }).success, true);
    assert.equal(EpisodeSchema.safeParse({ season: 1, episode: 1, stillUrl: "/relative/still" }).success, false);
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

  it("uses the exact favorite method and path on the desktop signed out, the fileserver's own (`62` 3.6)", async () => {
    const calls: Array<{ path: string; method?: string; body?: BodyInit | null }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ path: String(input), method: init?.method, body: init?.body });
      return success({ ref: item.ref, favorite: calls.length === 1 });
    };
    await writeFavorite(item.ref, true);
    await writeFavorite(item.ref, false);
    assert.deepEqual(calls.map((call) => [call.path, call.method]), [
      ["/api/favorites/title/movie-603", "PUT"], ["/api/favorites/title/movie-603", "DELETE"],
    ]);
  });

  it("uses exact watch methods, paths and bodies under the session (`63` section 3.2)", async () => {
    useAppStore.setState({ signedIn: true });
    const calls: Array<{ path: string; method?: string; body?: BodyInit | null }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ path: String(input), method: init?.method, body: init?.body });
      if (calls.length === 1) return success({ applied: true, entry: { watchId: "w1", item: item.ref, positionMs: 2, state: "watching", updatedAt: 3 } });
      if (calls.length === 2) return success({ removed: "w1" });
      return success({ cleared: 1 });
    };
    await writeWatch({ item: item.ref, positionMs: 2, playbackId: "play-1", seq: 1 });
    await removeWatch("w1");
    await clearWatch();
    assert.deepEqual(calls.map((call) => [call.path, call.method]), [
      ["/api/watch", "PUT"], ["/api/watch/w1", "DELETE"], ["/api/watch", "DELETE"],
    ]);
    assert.equal(calls[0]?.body, JSON.stringify({ item: item.ref, positionMs: 2, playbackId: "play-1", seq: 1 }));
  });
});
