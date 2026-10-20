import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_QUERY } from "@/lib/library-query";
import type { LibraryItem } from "@/types/library";
import { setAccountWatchReader } from "@/services/account-watch";
import { readContinueRows, readLibrary } from "@/services/library";
import type { WatchEntry } from "@/services/schemas/watch-schema";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
const refusal = () => new Response(JSON.stringify({
  ok: false, error: { code: "titles.not_found", message: "There is no such title." },
}), { status: 404 });

function browserWindow(): void {
  (globalThis as { window?: unknown }).window = {};
}

function desktopWindow(): void {
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" } };
}

const entry = (over: Partial<WatchEntry> & Pick<WatchEntry, "updatedAt">): WatchEntry => ({
  watchId: `w${over.updatedAt}`,
  item: { kind: "title", id: "t1" },
  positionMs: 300,
  durationMs: 1_000,
  state: "watching",
  ...over,
});

const memoryItem = (id: string, title: string): LibraryItem => ({
  ref: { kind: "title", id }, kind: "movie", title, genres: ["Drama"], favorite: true,
});

const serverRow = (id: string): LibraryItem => ({
  ref: { kind: "title", id }, kind: "movie", title: `Server ${id}`, genres: [], favorite: false,
});

const CATALOG_PAGE = {
  items: [serverRow("m1"), serverRow("plain")],
  facets: { genres: [] as string[], years: [] as number[] },
  trending: false,
  titlesAvailable: true,
};

interface Seams {
  readonly libraryUrls: string[];
  readonly titleIds: string[];
  accountReads: number;
}

/** Mounts a browser window, the signed-in session and an account reader over `entries`; fetch answers the catalog,
 *  the titles and a refused id. */
function mountBrowser(entries: readonly WatchEntry[]): Seams {
  const seams: Seams = { libraryUrls: [], titleIds: [], accountReads: 0 };
  browserWindow();
  useAppStore.setState({ signedIn: true });
  setAccountWatchReader(() => {
    seams.accountReads += 1;
    return Promise.resolve([...entries]);
  });
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("/api/library/continue")) {
      seams.libraryUrls.push(url);
      return success({ items: [serverRow("m1")] });
    }
    if (url.startsWith("/api/library")) {
      seams.libraryUrls.push(url);
      return success(CATALOG_PAGE);
    }
    const id = decodeURIComponent(url.slice("/api/titles/".length));
    seams.titleIds.push(id);
    return id === "gone" ? refusal() : success({
      id, kind: id.startsWith("tv-") ? "tv" : "movie", title: `Fetched ${id}`, genres: ["Action"], cast: [],
    });
  };
  return seams;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ libraryItems: [memoryItem("m1", "Memory Title")] });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
  setAccountWatchReader(null);
});

const ACCOUNT_ENTRY_COUNT = 25;

describe("the signed-in browser's library joins (`63` section 3.3)", () => {
  it("decorates catalog rows with the account's newest marks, without the server watched param", async () => {
    const seams = mountBrowser([entry({ updatedAt: 300, item: { kind: "title", id: "m1" } })]);
    const page = await readLibrary({ ...DEFAULT_QUERY });
    assert.equal(seams.libraryUrls.length, 1);
    assert.equal(seams.libraryUrls[0]?.includes("watched="), false);
    const decorated = page.items.find((item) => item.ref.id === "m1");
    assert.equal(decorated?.watchId, "w300");
    assert.equal(decorated?.progress?.positionMs, 300);
    assert.equal(page.items.find((item) => item.ref.id === "plain")?.progress, undefined);
    assert.equal(seams.accountReads, 1);
  });

  it("answers History from the account's entries: memory hit, titles fallback, then the id's skeleton", async () => {
    const seams = mountBrowser([
      entry({ updatedAt: 300, item: { kind: "title", id: "m1" } }),
      entry({ updatedAt: 200, item: { kind: "title", id: "tv-7" } }),
      entry({ updatedAt: 100, item: { kind: "title", id: "gone" } }),
    ]);
    const page = await readLibrary({ ...DEFAULT_QUERY, source: "history" });
    assert.deepEqual(seams.libraryUrls, []);
    assert.deepEqual(seams.titleIds.sort(), ["gone", "tv-7"]);
    assert.equal(page.total, 3);
    assert.deepEqual(page.items.map((item) => item.title), ["Memory Title", "Fetched tv-7", "gone"]);
    assert.equal(page.items[1]?.kind, "tv");
    assert.equal(page.items[2]?.kind, "movie");
    assert.equal(page.items[0]?.favorite, true);
    assert.equal(page.items[0]?.progress?.state, "watching");
    assert.equal(page.nextCursor, undefined);
    // The fallback's facts joined the store's title memory, so the next read hits it.
    assert.ok(useAppStore.getState().libraryItems.some((item) => item.ref.id === "tv-7"));
  });

  it("pages the account's history client-side at the server's page size", async () => {
    mountBrowser(Array.from({ length: ACCOUNT_ENTRY_COUNT }, (_, at) => entry({
      updatedAt: at + 1, item: { kind: "local", id: `f${at}` },
    })));
    const first = await readLibrary({ ...DEFAULT_QUERY, source: "history" });
    assert.equal(first.total, ACCOUNT_ENTRY_COUNT);
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, "1");
    assert.equal(first.titlesAvailable, true);
    const second = await readLibrary({ ...DEFAULT_QUERY, source: "history" }, undefined, "1");
    assert.equal(second.items.length, 5);
    assert.equal(second.nextCursor, undefined);
    // The rows arrive newest first: the last page holds the oldest entries.
    assert.equal(second.items[0]?.ref.id, "f4");
  });

  it("narrows the account's history by the query and keeps the chosen facets listed", async () => {
    mountBrowser([
      entry({ updatedAt: 300, item: { kind: "title", id: "m1" } }),
      entry({ updatedAt: 200, item: { kind: "title", id: "tv-7" } }),
    ]);
    const page = await readLibrary({ ...DEFAULT_QUERY, source: "history", search: "memory", genres: ["Drama"] });
    assert.deepEqual(page.items.map((item) => item.title), ["Memory Title"]);
    assert.equal(page.total, 1);
    assert.ok(page.facets.genres.includes("Drama"));
  });

  it("answers the watching and watched sets from the items' newest account entries", async () => {
    const seams = mountBrowser([
      entry({ updatedAt: 300, item: { kind: "title", id: "m1" } }),
      entry({ updatedAt: 200, item: { kind: "title", id: "m2" }, state: "watched", positionMs: 999 }),
      entry({ updatedAt: 100, item: { kind: "title", id: "m2" } }),
    ]);
    const watching = await readLibrary({ ...DEFAULT_QUERY, watched: "watching" });
    assert.deepEqual(seams.libraryUrls, []);
    assert.deepEqual(watching.items.map((item) => item.ref.id), ["m1"]);
    const watched = await readLibrary({ ...DEFAULT_QUERY, watched: "watched" });
    assert.deepEqual(watched.items.map((item) => item.ref.id), ["m2"]);
    assert.equal(watched.items[0]?.progress?.state, "watched");
  });

  it("reads the Continue strip from the shared selection over the account's entries", async () => {
    mountBrowser([
      entry({ updatedAt: 300, item: { kind: "title", id: "m1" } }),
      entry({ updatedAt: 200, item: { kind: "title", id: "tv-7" } }),
      entry({ updatedAt: 100, item: { kind: "title", id: "m2" }, state: "watched" }),
    ]);
    const rows = await readContinueRows();
    assert.deepEqual(rows.map((item) => item.title), ["Memory Title", "Fetched tv-7"]);
  });

  it("on the desktop nothing changes: the watched param goes out and the answers stand as fetched", async () => {
    const seams = mountBrowser([entry({ updatedAt: 300, item: { kind: "title", id: "m1" } })]);
    desktopWindow();
    const page = await readLibrary({ ...DEFAULT_QUERY, watched: "watching" });
    assert.equal(seams.libraryUrls.length, 1);
    assert.ok(seams.libraryUrls[0]?.includes("watched=watching"));
    assert.equal(seams.accountReads, 0);
    const undecorated = page.items.find((item) => item.ref.id === "m1");
    assert.equal(undecorated?.progress, undefined);
    const continuing = await readContinueRows();
    assert.deepEqual(continuing.map((item) => item.ref.id), ["m1"]);
    assert.equal(seams.libraryUrls.at(-1)?.includes("/api/library/continue"), true);
  });
});

describe("signed out, the watch-derived reads answer none (`63` sections 3.3 and 3.4)", () => {
  it("issues no call for History, the watched sets, Continue or decoration, and decorates nothing", async () => {
    browserWindow();
    globalThis.fetch = async () => {
      throw new Error("no request may leave the page");
    };
    const history = await readLibrary({ ...DEFAULT_QUERY, source: "history" });
    assert.deepEqual(history.items, []);
    assert.equal(history.total, 0);
    const watching = await readLibrary({ ...DEFAULT_QUERY, watched: "watching" });
    assert.deepEqual(watching.items, []);
    const continuing = await readContinueRows();
    assert.deepEqual(continuing, []);
  });

  it("a catalog page stands as fetched, undecorated", async () => {
    browserWindow();
    globalThis.fetch = async () => success(CATALOG_PAGE);
    const page = await readLibrary({ ...DEFAULT_QUERY });
    assert.deepEqual(page.items.map((item) => item.progress), [undefined, undefined]);
    assert.equal(page.total, 2);
  });
});
